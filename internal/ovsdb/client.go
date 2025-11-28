package ovsdb

import (
	"context"
	"fmt"
	"log"

	vswitch "ovsdb-viewer/internal/ovsdb/model/vswitch"

	ovsdbclient "github.com/ovn-kubernetes/libovsdb/client"
)

// OVSDBClient wraps the libovsdb client with SSH tunneling support
type OVSDBClient struct {
	client ovsdbclient.Client
	tunnel *Tunnel
}

// Connect establishes a connection to the OVSDB server, optionally through an SSH tunnel
func (c *OVSDBClient) Connect(config ConnectionConfig, endpoint string) error {
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
	dbModel, err := vswitch.FullDatabaseModel()
	if err != nil {
		if tunnel != nil {
			tunnel.Stop()
		}
		return fmt.Errorf("failed to create DB model: %w", err)
	}
	log.Printf("Connecting to database: %s", dbModel.Name())
	ovsdbClient, err := ovsdbclient.NewOVSDBClient(dbModel, ovsdbclient.WithEndpoint(localEndpoint))
	if err != nil {
		if tunnel != nil {
			tunnel.Stop()
		}
		return fmt.Errorf("failed to create OVSDB client: %w", err)
	}

	// Connect
	ctx := context.Background()
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

// GetBridges retrieves all bridges from the OVSDB
func (c *OVSDBClient) GetBridges() ([]vswitch.Bridge, error) {
	var bridges []vswitch.Bridge
	err := c.client.List(context.Background(), &bridges)
	log.Printf("GetBridges: bridges=%+v, err=%v", bridges, err)
	return bridges, err
}

// GetPorts retrieves all ports from the OVSDB
func (c *OVSDBClient) GetPorts() ([]vswitch.Port, error) {
	var ports []vswitch.Port
	err := c.client.List(context.Background(), &ports)
	log.Printf("GetPorts: ports=%+v, err=%v", ports, err)
	return ports, err
}

// GetInterfaces retrieves all interfaces from the OVSDB
func (c *OVSDBClient) GetInterfaces() ([]vswitch.Interface, error) {
	var interfaces []vswitch.Interface
	err := c.client.List(context.Background(), &interfaces)
	log.Printf("GetInterfaces: interfaces=%+v, err=%v", interfaces, err)
	return interfaces, err
}

// GetOpenvSwitch retrieves the Open_vSwitch table data
func (c *OVSDBClient) GetOpenvSwitch() ([]vswitch.OpenvSwitch, error) {
	var ovs []vswitch.OpenvSwitch
	err := c.client.List(context.Background(), &ovs)
	log.Printf("GetOpenvSwitch: ovs=%+v, err=%v", ovs, err)
	return ovs, err
}
