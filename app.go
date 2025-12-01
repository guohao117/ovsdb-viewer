package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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
func (a *App) ConnectOVSDB(host, user, keyFile, endpoint string, port int, jumpHosts []string, localForwarderType string) error {
	config := ovsdb.ConnectionConfig{
		Host:               host,
		Port:               port,
		User:               user,
		KeyFile:            keyFile,
		JumpHosts:          jumpHosts,
		LocalForwarderType: localForwarderType,
	}

	a.ovsdbClient = &ovsdb.OVSDBClient{}
	err := a.ovsdbClient.Connect(a.ctx, config, endpoint)
	if err == nil {
		a.AddToHistory(ConnectionHistory{
			Host:               host,
			Port:               port,
			User:               user,
			KeyFile:            keyFile,
			Endpoint:           endpoint,
			JumpHosts:          jumpHosts,
			LocalForwarderType: localForwarderType,
			Timestamp:          time.Now().Unix(),
		})
		a.SaveHistory()
	}
	return err
}

// DisconnectOVSDB disconnects from the OVSDB server
func (a *App) DisconnectOVSDB() error {
	if a.ovsdbClient != nil {
		return a.ovsdbClient.Disconnect()
	}
	return nil
}

// ConnectionHistory represents a saved connection configuration
type ConnectionHistory struct {
	Host               string   `json:"host"`
	Port               int      `json:"port"`
	User               string   `json:"user"`
	KeyFile            string   `json:"keyFile"`
	Endpoint           string   `json:"endpoint"`
	JumpHosts          []string `json:"jumpHosts"`
	LocalForwarderType string   `json:"localForwarderType"`
	Timestamp          int64    `json:"timestamp"`
}

// GetHistory returns the connection history
func (a *App) GetHistory() []ConnectionHistory {
	return a.history
}

// AddToHistory adds a new connection to history
func (a *App) AddToHistory(conn ConnectionHistory) {
	// Remove duplicates and keep only last 10
	a.history = append([]ConnectionHistory{conn}, a.history...)
	seen := make(map[string]bool)
	var unique []ConnectionHistory
	for _, h := range a.history {
		key := fmt.Sprintf("%s:%d:%s:%s", h.Host, h.Port, h.User, h.Endpoint)
		if !seen[key] {
			seen[key] = true
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
	return json.Unmarshal(data, &a.history)
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
	return a.ovsdbClient.GetSchema(), nil
}

// GetTable retrieves all rows from the specified table as a slice of maps
func (a *App) GetTable(table string) ([]map[string]any, error) {
	if a.ovsdbClient == nil {
		return nil, fmt.Errorf("not connected")
	}
	return a.ovsdbClient.GetTable(a.ctx, table)
}
