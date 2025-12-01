package ovsdb

import (
	"context"
	"fmt"
	"log"
	"reflect"

	vswitch "ovsdb-viewer/internal/ovsdb/model/vswitch"

	ovsdbclient "github.com/ovn-kubernetes/libovsdb/client"
	ovsdbmodel "github.com/ovn-kubernetes/libovsdb/model"
	ovsdbovsdb "github.com/ovn-kubernetes/libovsdb/ovsdb"
)

// OVSDBClient wraps the libovsdb client with SSH tunneling support
type OVSDBClient struct {
	client  ovsdbclient.Client
	dbModel ovsdbmodel.DatabaseModel
	tunnel  *Tunnel
}

// Connect establishes a connection to the OVSDB server, optionally through an SSH tunnel
func (c *OVSDBClient) Connect(ctx context.Context, config ConnectionConfig, endpoint string) error {
	var localEndpoint string
	var tunnel *Tunnel
	var err error

	if config.Host != "" {
		// Use SSH tunnel
		tunnel, err = EstablishTunnel(config, endpoint)
		if err != nil {
			return fmt.Errorf("failed to establish tunnel: %w", err)
		}
		localEndpoint = tunnel.LocalEndpoint
	} else {
		// Direct connection
		localEndpoint = endpoint
	}

	// Create OVSDB client
	schema := vswitch.Schema()
	clientModel, err := vswitch.FullDatabaseModel()
	if err != nil {
		if tunnel != nil {
			tunnel.Stop()
		}
		return fmt.Errorf("failed to create DB model: %w", err)
	}
	dbModel, verr := ovsdbmodel.NewDatabaseModel(schema, clientModel)
	if verr != nil {
		if tunnel != nil {
			tunnel.Stop()
		}
		return fmt.Errorf("failed to create database model: %v", verr)
	}
	c.dbModel = dbModel
	log.Printf("Connecting to database: %s", clientModel.Name())
	ovsdbClient, err := ovsdbclient.NewOVSDBClient(clientModel, ovsdbclient.WithEndpoint(localEndpoint))
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

	// Start monitoring all tables to populate the cache
	_, err = ovsdbClient.MonitorAll(ctx)
	if err != nil {
		if tunnel != nil {
			tunnel.Stop()
		}
		return fmt.Errorf("failed to start monitoring: %w", err)
	}

	c.client = ovsdbClient
	c.tunnel = tunnel
	return nil
}

// Disconnect closes the OVSDB connection and stops the tunnel if active
func (c *OVSDBClient) Disconnect() error {
	if c.client != nil {
		c.client.Disconnect()
	}
	if c.tunnel != nil {
		c.tunnel.Stop()
	}
	return nil
}

// GetClient returns the underlying libovsdb client for direct operations
func (c *OVSDBClient) GetClient() ovsdbclient.Client {
	return c.client
}

func (c *OVSDBClient) GetSchema() *ovsdbovsdb.DatabaseSchema {
	return &c.dbModel.Schema
}

func (c *OVSDBClient) GetTable(ctx context.Context, table string) ([]map[string]any, error) {
	modelType, ok := c.dbModel.Client().Types()[table]
	if !ok {
		return nil, fmt.Errorf("table %s not found in database model", table)
	}

	sliceType := reflect.SliceOf(modelType)
	sliceValue := reflect.New(sliceType).Interface()
	err := c.client.List(ctx, sliceValue)
	if err != nil {
		return nil, fmt.Errorf("failed to list table %s: %w", table, err)
	}

	result := []map[string]any{}
	slice := reflect.ValueOf(sliceValue).Elem()
	for i := 0; i < slice.Len(); i++ {
		model := slice.Index(i).Interface()
		rowMap := structToMap(model)
		result = append(result, rowMap)
	}

	return result, nil
}

func structToMap(model any) map[string]any {
	result := make(map[string]any)
	val := reflect.ValueOf(model)

	// Handle pointer types safely
	for val.Kind() == reflect.Ptr {
		if val.IsNil() {
			return result
		}
		val = val.Elem()
	}

	// Ensure we have a struct
	if val.Kind() != reflect.Struct {
		return result
	}

	typ := val.Type()

	for i := 0; i < val.NumField(); i++ {
		field := typ.Field(i)
		fieldValue := val.Field(i).Interface()
		ovsdbTag := field.Tag.Get("ovsdb")
		if ovsdbTag != "" {
			result[ovsdbTag] = fieldValue
		}
	}

	return result
}
