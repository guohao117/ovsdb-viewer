package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"ovsdb-viewer/internal/ovsdb"

	ovsdbovsdb "github.com/ovn-kubernetes/libovsdb/ovsdb"
)

// App struct
type App struct {
	ctx         context.Context
	ovsdbClient *ovsdb.OVSDBClient
	history     []ConnectionHistory
}

const historyVersion = 2

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.LoadHistory()
}

// ConnectOVSDB connects to the OVSDB server using the provided configuration
func (a *App) ConnectOVSDB(req ConnectRequest) error {
	return a.ConnectDynamic(req, "Open_vSwitch")
}

// ConnectDynamic connects to the OVSDB server using the dynamic client
func (a *App) ConnectDynamic(req ConnectRequest, dbName string) error {
	endpoints := normalizeEndpoints(req.Endpoints)
	if len(endpoints) == 0 {
		return fmt.Errorf("no endpoints provided")
	}

	if a.ovsdbClient != nil {
		a.ovsdbClient.Disconnect()
		a.ovsdbClient = nil
	}

	var lastErr error
	for _, ep := range endpoints {
		client := &ovsdb.OVSDBClient{}
		cfg := ovsdb.ConnectionConfig{}
		if ep.Tunnel != nil {
			cfg = tunnelConfigToConnectionConfig(ep.Tunnel)
		}
		err := client.Connect(a.ctx, cfg, ep.Endpoint, dbName)
		if err == nil {
			a.ovsdbClient = client
			a.AddToHistory(ConnectionHistory{
				Version:   historyVersion,
				Endpoints: cloneEndpoints(endpoints),
				Timestamp: time.Now().Unix(),
			})
			_ = a.SaveHistory()
			return nil
		}
		lastErr = err
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("all endpoints were empty")
	}
	return fmt.Errorf("failed to connect to any endpoint: %w", lastErr)
}

// DisconnectOVSDB disconnects from the OVSDB server
func (a *App) DisconnectOVSDB() error {
	if a.ovsdbClient != nil {
		a.ovsdbClient.Disconnect()
	}
	return nil
}

// ConnectionHistory represents a saved connection configuration
type ConnectRequest struct {
	Endpoints []EndpointConfig `json:"endpoints"`
}

type EndpointConfig struct {
	Endpoint string        `json:"endpoint"`
	Tunnel   *TunnelConfig `json:"tunnel,omitempty"`
}

type TunnelConfig struct {
	Host               string   `json:"host"`
	Port               int      `json:"port"`
	User               string   `json:"user"`
	KeyFile            string   `json:"keyFile"`
	JumpHosts          []string `json:"jumpHosts"`
	LocalForwarderType string   `json:"localForwarderType"`
}

// ConnectionHistory represents a saved connection configuration
type ConnectionHistory struct {
	Version   int              `json:"version"`
	Endpoints []EndpointConfig `json:"endpoints"`
	Timestamp int64            `json:"timestamp"`

	// Legacy fields kept for upgrade path
	Host               string   `json:"host,omitempty"`
	Port               int      `json:"port,omitempty"`
	User               string   `json:"user,omitempty"`
	KeyFile            string   `json:"keyFile,omitempty"`
	Endpoint           string   `json:"endpoint,omitempty"`
	JumpHosts          []string `json:"jumpHosts,omitempty"`
	LocalForwarderType string   `json:"localForwarderType,omitempty"`
}

// GetHistory returns the connection history
func (a *App) GetHistory() []ConnectionHistory {
	return a.history
}

// AddToHistory adds a new connection to history
func (a *App) AddToHistory(conn ConnectionHistory) {
	conn.Version = historyVersion
	a.history = append([]ConnectionHistory{conn}, a.history...)
	seen := make(map[string]bool)
	var unique []ConnectionHistory
	for _, h := range a.history {
		sig := historySignature(h.Endpoints)
		if sig == "" {
			sig = fmt.Sprintf("entry-%d", len(unique))
		}
		if !seen[sig] {
			seen[sig] = true
			unique = append(unique, h)
		}
	}
	if len(unique) > 10 {
		unique = unique[:10]
	}
	a.history = unique
}

// SaveHistory saves the history to a file
func (a *App) SaveHistory() error {
	data, err := json.Marshal(a.history)
	if err != nil {
		return err
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dir := filepath.Join(homeDir, ".ovsdb-viewer")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "connection_history.json"), data, 0644)
}

// LoadHistory loads the history from a file
func (a *App) LoadHistory() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		a.history = []ConnectionHistory{}
		return nil
	}
	filePath := filepath.Join(homeDir, ".ovsdb-viewer", "connection_history.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			a.history = []ConnectionHistory{}
			return nil
		}
		return err
	}
	if err := json.Unmarshal(data, &a.history); err != nil {
		return err
	}
	upgraded := false
	for i, record := range a.history {
		updated, changed := upgradeHistoryRecord(record)
		if changed {
			upgraded = true
			a.history[i] = updated
		}
	}
	if upgraded {
		return a.SaveHistory()
	}
	return nil
}

func normalizeEndpoints(endpoints []EndpointConfig) []EndpointConfig {
	cleaned := make([]EndpointConfig, 0, len(endpoints))
	for _, ep := range endpoints {
		ep.Endpoint = strings.TrimSpace(ep.Endpoint)
		if ep.Endpoint == "" {
			continue
		}
		if ep.Tunnel != nil {
			ep.Tunnel.Host = strings.TrimSpace(ep.Tunnel.Host)
			ep.Tunnel.User = strings.TrimSpace(ep.Tunnel.User)
			ep.Tunnel.KeyFile = strings.TrimSpace(ep.Tunnel.KeyFile)
			if ep.Tunnel.Host == "" {
				ep.Tunnel = nil
			} else {
				if ep.Tunnel.Port == 0 {
					ep.Tunnel.Port = 22
				}
				if ep.Tunnel.LocalForwarderType == "" {
					ep.Tunnel.LocalForwarderType = "tcp"
				}
				if len(ep.Tunnel.JumpHosts) > 0 {
					trimmed := make([]string, 0, len(ep.Tunnel.JumpHosts))
					for _, jump := range ep.Tunnel.JumpHosts {
						jump = strings.TrimSpace(jump)
						if jump != "" {
							trimmed = append(trimmed, jump)
						}
					}
					ep.Tunnel.JumpHosts = trimmed
				}
			}
		}
		cleaned = append(cleaned, ep)
	}
	return cleaned
}

func tunnelConfigToConnectionConfig(t *TunnelConfig) ovsdb.ConnectionConfig {
	if t == nil {
		return ovsdb.ConnectionConfig{}
	}
	cfg := ovsdb.ConnectionConfig{
		Host:               t.Host,
		Port:               t.Port,
		User:               t.User,
		KeyFile:            t.KeyFile,
		JumpHosts:          append([]string{}, t.JumpHosts...),
		LocalForwarderType: t.LocalForwarderType,
	}
	if cfg.Port == 0 {
		cfg.Port = 22
	}
	return cfg
}

func cloneEndpoints(endpoints []EndpointConfig) []EndpointConfig {
	clones := make([]EndpointConfig, len(endpoints))
	for i, ep := range endpoints {
		clones[i].Endpoint = ep.Endpoint
		if ep.Tunnel != nil {
			tunnelCopy := *ep.Tunnel
			if len(ep.Tunnel.JumpHosts) > 0 {
				tunnelCopy.JumpHosts = append([]string{}, ep.Tunnel.JumpHosts...)
			}
			clones[i].Tunnel = &tunnelCopy
		}
	}
	return clones
}

func historySignature(endpoints []EndpointConfig) string {
	if len(endpoints) == 0 {
		return ""
	}
	data, err := json.Marshal(endpoints)
	if err != nil {
		return ""
	}
	return string(data)
}

func upgradeHistoryRecord(record ConnectionHistory) (ConnectionHistory, bool) {
	changed := false
	if len(record.Endpoints) == 0 && record.Endpoint != "" {
		upgraded := EndpointConfig{Endpoint: record.Endpoint}
		if record.Host != "" {
			tunnel := &TunnelConfig{
				Host:               record.Host,
				Port:               record.Port,
				User:               record.User,
				KeyFile:            record.KeyFile,
				JumpHosts:          append([]string{}, record.JumpHosts...),
				LocalForwarderType: record.LocalForwarderType,
			}
			if tunnel.Port == 0 {
				tunnel.Port = 22
			}
			if tunnel.LocalForwarderType == "" {
				tunnel.LocalForwarderType = "tcp"
			}
			upgraded.Tunnel = tunnel
		}
		record.Endpoints = []EndpointConfig{upgraded}
		changed = true
	}
	if record.Version != historyVersion {
		record.Version = historyVersion
		changed = true
	}
	if changed {
		record.Host = ""
		record.Port = 0
		record.User = ""
		record.KeyFile = ""
		record.Endpoint = ""
		record.JumpHosts = nil
		record.LocalForwarderType = ""
	}
	return record, changed
}

// DeleteHistory removes a connection from history by index
func (a *App) DeleteHistory(index int) error {
	if index < 0 || index >= len(a.history) {
		return fmt.Errorf("invalid index")
	}
	a.history = append(a.history[:index], a.history[index+1:]...)
	return a.SaveHistory()
}

// GetOVSDBClient returns the underlying OVSDB client for direct operations
func (a *App) GetOVSDBClient() *ovsdb.OVSDBClient {
	return a.ovsdbClient
}

// GetSchema returns the OVSDB schema
func (a *App) GetSchema() (*ovsdbovsdb.DatabaseSchema, error) {
	if a.ovsdbClient == nil {
		return nil, fmt.Errorf("not connected")
	}
	// Default to Open_vSwitch for legacy compatibility if needed,
	// but GetSchema on client now takes dbName.
	// However, the client implementation of GetSchema ignores dbName and returns schema of connected client.
	return a.ovsdbClient.GetSchema(a.ctx, "")
}

// GetTable retrieves all rows from the specified table as a slice of maps
func (a *App) GetTable(table string) ([]map[string]any, error) {
	if a.ovsdbClient == nil {
		return nil, fmt.Errorf("not connected")
	}
	return a.ovsdbClient.GetTableData(a.ctx, table)
}

// ListDatabases returns a list of available database names
func (a *App) ListDatabases() ([]string, error) {
	if a.ovsdbClient == nil {
		return nil, fmt.Errorf("not connected")
	}
	return a.ovsdbClient.ListDatabases(a.ctx)
}

// GetSchemaDynamic returns the OVSDB schema for a specific database
func (a *App) GetSchemaDynamic(dbName string) (*ovsdbovsdb.DatabaseSchema, error) {
	if a.ovsdbClient == nil {
		return nil, fmt.Errorf("not connected")
	}
	return a.ovsdbClient.GetSchema(a.ctx, dbName)
}

// GetTableDynamic retrieves all rows from the specified table using the dynamic client
func (a *App) GetTableDynamic(dbName string, tableName string) ([]map[string]any, error) {
	if a.ovsdbClient == nil {
		return nil, fmt.Errorf("not connected")
	}
	// Note: dbName is currently ignored by the client as it uses the connected DB,
	// but we keep it in the signature for future flexibility or validation.
	return a.ovsdbClient.GetTableData(a.ctx, tableName)
}
