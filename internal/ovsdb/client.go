package ovsdb

import (
	"context"
	"fmt"

	ovsdbclient "github.com/ovn-kubernetes/libovsdb/client"
	"github.com/ovn-kubernetes/libovsdb/model"
	"github.com/ovn-kubernetes/libovsdb/ovsdb"
	"github.com/ovn-kubernetes/libovsdb/ovsdb/serverdb"
)

// OVSDBClient handles dynamic OVSDB interactions without generated models
type OVSDBClient struct {
	client        ovsdbclient.Client
	tunnel        *Tunnel
	localEndpoint string
}

// Connect connects to OVSDB without a specific schema model
func (c *OVSDBClient) Connect(ctx context.Context, config ConnectionConfig, endpoint string, dbName string) error {
	var localEndpoint string
	var tunnel *Tunnel
	var err error

	if config.Host != "" {
		tunnel, err = EstablishTunnel(config, endpoint)
		if err != nil {
			return fmt.Errorf("failed to establish tunnel: %w", err)
		}
		localEndpoint = tunnel.LocalEndpoint
	} else {
		localEndpoint = endpoint
	}

	if dbName == "" {
		dbName = "Open_vSwitch"
	}

	// We use a dummy model because libovsdb requires one to initialize.
	// However, we won't use the cache or monitor features that rely on it.
	// We'll use raw Transact/RPC calls.
	dummyModel, err := model.NewClientDBModel(dbName, nil)
	if err != nil {
		if tunnel != nil {
			tunnel.Stop()
		}
		return fmt.Errorf("failed to create dummy model: %w", err)
	}

	// Create OVSDB client
	// We don't call MonitorAll here because we don't have a model to map to.
	ovsdbClient, err := ovsdbclient.NewOVSDBClient(dummyModel, ovsdbclient.WithEndpoint(localEndpoint))
	if err != nil {
		if tunnel != nil {
			tunnel.Stop()
		}
		return fmt.Errorf("failed to create OVSDB client: %w", err)
	}

	// Connect
	if err := ovsdbClient.Connect(ctx); err != nil {
		if tunnel != nil {
			tunnel.Stop()
		}
		return fmt.Errorf("failed to connect to OVSDB: %w", err)
	}

	c.client = ovsdbClient
	c.tunnel = tunnel
	c.localEndpoint = localEndpoint
	return nil
}

// Disconnect closes the connection
func (c *OVSDBClient) Disconnect() {
	if c.client != nil {
		c.client.Disconnect()
	}
	if c.tunnel != nil {
		c.tunnel.Stop()
	}
}

// ListDatabases returns a list of available database names
func (c *OVSDBClient) ListDatabases(ctx context.Context) ([]string, error) {
	if c.localEndpoint == "" {
		return nil, fmt.Errorf("not connected")
	}

	// Connect to _Server database to list databases
	serverModel, err := serverdb.FullDatabaseModel()
	if err != nil {
		return nil, fmt.Errorf("failed to create server model: %w", err)
	}

	serverClient, err := ovsdbclient.NewOVSDBClient(serverModel, ovsdbclient.WithEndpoint(c.localEndpoint))
	if err != nil {
		return nil, fmt.Errorf("failed to create server client: %w", err)
	}

	if err := serverClient.Connect(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to server db: %w", err)
	}
	defer serverClient.Disconnect()

	var dbs []serverdb.Database
	if err := serverClient.List(ctx, &dbs); err != nil {
		return nil, fmt.Errorf("failed to list databases: %w", err)
	}

	names := make([]string, 0, len(dbs))
	for _, db := range dbs {
		names = append(names, db.Name)
	}
	return names, nil
}

// GetSchema returns the schema for a specific database
func (c *OVSDBClient) GetSchema(ctx context.Context, dbName string) (*ovsdb.DatabaseSchema, error) {
	schema := c.client.Schema()
	return &schema, nil
}

// GetTableData fetches all rows from a table using a raw Select operation
func (c *OVSDBClient) GetTableData(ctx context.Context, tableName string) ([]map[string]interface{}, error) {
	// Construct a Select operation
	op := ovsdb.Operation{
		Op:    "select",
		Table: tableName,
		Where: []ovsdb.Condition{}, // Select all
	}

	// Execute transaction
	results, err := c.client.Transact(ctx, op)
	if err != nil {
		return nil, fmt.Errorf("transaction failed: %w", err)
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("no results returned")
	}

	if results[0].Error != "" {
		return nil, fmt.Errorf("server error: %s - %s", results[0].Error, results[0].Details)
	}

	// Convert rows to generic maps
	rows := make([]map[string]interface{}, 0, len(results[0].Rows))
	for _, row := range results[0].Rows {
		rows = append(rows, normalizeRow(row))
	}

	return rows, nil
}

func normalizeRow(row ovsdb.Row) map[string]interface{} {
	out := make(map[string]interface{})
	for k, v := range row {
		out[k] = normalizeValue(v)
	}
	return out
}

func normalizeValue(val interface{}) interface{} {
	switch v := val.(type) {
	case ovsdb.OvsSet:
		newSet := make([]interface{}, len(v.GoSet))
		for i, elem := range v.GoSet {
			newSet[i] = normalizeValue(elem)
		}
		return newSet
	case *ovsdb.OvsSet:
		newSet := make([]interface{}, len(v.GoSet))
		for i, elem := range v.GoSet {
			newSet[i] = normalizeValue(elem)
		}
		return newSet
	case ovsdb.OvsMap:
		// Convert to map[string]interface{} for JSON compatibility
		out := make(map[string]interface{})
		for k, val := range v.GoMap {
			out[fmt.Sprintf("%v", normalizeValue(k))] = normalizeValue(val)
		}
		return out
	case *ovsdb.OvsMap:
		out := make(map[string]interface{})
		for k, val := range v.GoMap {
			out[fmt.Sprintf("%v", normalizeValue(k))] = normalizeValue(val)
		}
		return out
	case ovsdb.UUID:
		return v.GoUUID
	case []interface{}:
		// Standard array handling (recursive)
		newSlice := make([]interface{}, len(v))
		for i, elem := range v {
			newSlice[i] = normalizeValue(elem)
		}
		return newSlice
	default:
		return v
	}
}
