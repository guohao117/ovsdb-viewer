import React, { useState, useEffect } from "react";
import "./App.css";
import schema from "./schema.json";
import { Layout, Menu, Button, Breadcrumb, Modal } from "antd";
import {
  DatabaseOutlined,
  ApiOutlined,
  GlobalOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  ConnectOVSDB,
  DisconnectOVSDB,
  GetHistory,
  DeleteHistory,
  GetBridges,
  GetPorts,
  GetInterfaces,
  GetOpenvSwitch,
} from "../wailsjs/go/main/App";
const tableOptions = [
  {
    key: "bridges",
    label: "Bridges",
    method: "GetBridges",
    tableName: "Bridge",
  },
  { key: "ports", label: "Ports", method: "GetPorts", tableName: "Port" },
  {
    key: "interfaces",
    label: "Interfaces",
    method: "GetInterfaces",
    tableName: "Interface",
  },
  {
    key: "openvSwitch",
    label: "Open vSwitch",
    method: "GetOpenvSwitch",
    tableName: "Open_vSwitch",
  },
];

interface ConnectionHistory {
  id: string;
  host: string;
  port: number;
  user: string;
  keyFile: string;
  endpoint: string;
  jumpHosts: string;
  localForwarderType: string;
  timestamp: number;
}

function App() {
  // OVSDB connection states
  const [host, setHost] = useState("");
  const [port, setPort] = useState(22);
  const [user, setUser] = useState("");
  const [keyFile, setKeyFile] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [jumpHosts, setJumpHosts] = useState("");
  const [localForwarderType, setLocalForwarderType] = useState("tcp");
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [history, setHistory] = useState<ConnectionHistory[]>([]);

  // UI states
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [monitoredTables, setMonitoredTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // OVSDB data states
  const [bridges, setBridges] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [interfaces, setInterfaces] = useState<any[]>([]);
  const [openvSwitch, setOpenvSwitch] = useState<any[]>([]);
  const [dataStatus, setDataStatus] = useState("");
  const [expandedCells, setExpandedCells] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedTables, setSelectedTables] = useState<string[]>([
    "bridges",
    "ports",
    "interfaces",
    "openvSwitch",
  ]);

  async function connectOVSDB() {
    try {
      setConnectionStatus("Connecting...");
      const jumpHostsArray = jumpHosts
        .split(",")
        .map((h) => h.trim())
        .filter((h) => h);
      await ConnectOVSDB(
        host,
        user,
        keyFile,
        endpoint,
        port,
        jumpHostsArray,
        localForwarderType,
      );
      setConnected(true);
      setConnectionStatus("Connected successfully!");
      setMonitoredTables(selectedTables);
      setSelectedTable(selectedTables[0] || null);
      setShowConnectModal(false);
      loadHistory(); // Reload history after successful connection
      loadData(); // Auto-load data after connection
    } catch (error) {
      setConnectionStatus(`Connection failed: ${error}`);
    }
  }

  async function disconnectOVSDB() {
    try {
      await DisconnectOVSDB();
      setConnected(false);
      setConnectionStatus("Disconnected");
      // Clear data
      setBridges([]);
      setPorts([]);
      setInterfaces([]);
      setOpenvSwitch([]);
      setMonitoredTables([]);
      setSelectedTable(null);
    } catch (error) {
      setConnectionStatus(`Disconnect failed: ${error}`);
    }
  }

  async function loadData() {
    try {
      setDataStatus("Loading data...");
      const promises: Promise<any>[] = [];
      const dataSetters: string[] = [];
      monitoredTables.forEach((key) => {
        const option = tableOptions.find((o) => o.key === key);
        if (option) {
          promises.push(
            key === "bridges"
              ? GetBridges()
              : key === "ports"
                ? GetPorts()
                : key === "interfaces"
                  ? GetInterfaces()
                  : key === "openvSwitch"
                    ? GetOpenvSwitch()
                    : Promise.resolve([]),
          );
          dataSetters.push(key);
        }
      });
      const results = await Promise.all(promises);
      dataSetters.forEach((key, index) => {
        const setter =
          key === "bridges"
            ? setBridges
            : key === "ports"
              ? setPorts
              : key === "interfaces"
                ? setInterfaces
                : key === "openvSwitch"
                  ? setOpenvSwitch
                  : () => {};
        setter(results[index]);
      });
      setDataStatus("Data loaded successfully");
    } catch (error) {
      setDataStatus(`Failed to load data: ${error}`);
    }
  }

  function toCamelCase(str: string): string {
    return str
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  }

  function toggleCell(tableName: string, index: number, field: string) {
    const key = `${tableName}-${index}-${field}`;
    setExpandedCells((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isSmallComplex(value: any): boolean {
    if (Array.isArray(value)) {
      return value.length < 3;
    }
    if (typeof value === "object" && value !== null) {
      return Object.keys(value).length < 3;
    }
    return false;
  }

  function renderTable(title: string, data: any[], tableName: string) {
    if (!schema || !schema.tables || !(schema.tables as any)[tableName]) {
      return (
        <div className="table-section">
          <h3>{title}</h3>
          <p>Schema not loaded or table not found</p>
        </div>
      );
    }

    const tableSchema = (schema.tables as any)[tableName];
    const columns = Object.keys(tableSchema.columns).map((field) => ({
      field: toCamelCase(field), // Convert to Go struct field name
      label: field.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()), // Human readable label
    }));

    return (
      <div className="table-section">
        <h3>
          {title} ({data.length})
        </h3>
        {data.length === 0 ? (
          <p className="no-data">No data available</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.field}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item: any, index) => (
                <tr key={index}>
                  {columns.map((col) => {
                    const value = item[col.field];
                    const isComplex =
                      Array.isArray(value) ||
                      (typeof value === "object" && value !== null);
                    const key = `${tableName}-${index}-${col.field}`;
                    const isExpanded = expandedCells[key];
                    const small = isComplex && isSmallComplex(value);
                    return (
                      <td key={col.field} style={{ position: "relative" }}>
                        {isComplex ? (
                          small ? (
                            <span>{JSON.stringify(value)}</span>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  toggleCell(tableName, index, col.field)
                                }
                                className="btn-small"
                              >
                                {Array.isArray(value)
                                  ? `${value.length} items`
                                  : "View"}
                              </button>
                              {isExpanded && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    background: "white",
                                    border: "1px solid #ccc",
                                    zIndex: 1000,
                                    padding: "0.5rem",
                                    maxWidth: "300px",
                                    whiteSpace: "pre-wrap",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  {JSON.stringify(value, null, 2)}
                                </div>
                              )}
                            </>
                          )
                        ) : (
                          value || "-"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // Load history from backend on component mount
  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const hist = await GetHistory();
      console.log("Loaded history from backend:", hist);
      const mappedHistory = hist.map((h: any) => {
        console.log("History item:", h);
        return {
          id: `${h.host}:${h.port}:${h.user}:${h.endpoint}:${h.timestamp}`,
          host: h.host,
          port: h.port,
          user: h.user,
          keyFile: h.keyFile,
          endpoint: h.endpoint,
          jumpHosts: (h.jumpHosts || []).join(", "),
          localForwarderType: h.localForwarderType,
          timestamp: h.timestamp * 1000, // Convert to milliseconds
        };
      });
      console.log("Mapped history:", mappedHistory);
      setHistory(mappedHistory);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }

  function loadConnection(conn: ConnectionHistory) {
    setHost(conn.host);
    setPort(conn.port);
    setUser(conn.user);
    setKeyFile(conn.keyFile);
    setEndpoint(conn.endpoint);
    setJumpHosts(conn.jumpHosts);
    setLocalForwarderType(conn.localForwarderType);
  }

  async function deleteConnection(index: number) {
    try {
      await DeleteHistory(index);
      loadHistory(); // Reload after delete
    } catch (error) {
      console.error("Failed to delete history:", error);
    }
  }

  const dataMap: { [key: string]: any[] } = {
    bridges,
    ports,
    interfaces,
    openvSwitch,
  };

  return (
    <Layout style={{ height: "100vh", background: "#1e1e1e" }}>
      <Layout.Sider
        width={250}
        style={{
          position: "relative",
          background: "#252526",
          borderRight: "1px solid #444",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div className="logo" style={{ color: "#d4d4d4" }}>
          OVSDB Viewer
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedTable ? [selectedTable] : []}
          onClick={({ key }: { key: string }) => setSelectedTable(key)}
          style={{
            background: "transparent",
            border: "none",
            flex: 1,
          }}
          items={monitoredTables.map((key) => {
            const option = tableOptions.find((o) => o.key === key);
            let icon;
            switch (key) {
              case "bridges":
                icon = <DatabaseOutlined />;
                break;
              case "ports":
                icon = <ApiOutlined />;
                break;
              case "interfaces":
                icon = <GlobalOutlined />;
                break;
              case "openvSwitch":
                icon = <SettingOutlined />;
                break;
              default:
                icon = <DatabaseOutlined />;
            }
            return {
              key,
              icon,
              label: option?.label,
              style: {
                color: "#d4d4d4",
              },
            };
          })}
        />
      </Layout.Sider>
      <Layout
        style={{
          background: "#1e1e1e",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Layout.Header
          style={{
            background: "#252526",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #444",
            color: "#d4d4d4",
          }}
        >
          <Breadcrumb style={{ color: "#d4d4d4" }}>
            <Breadcrumb.Item>OVSDB</Breadcrumb.Item>
            <Breadcrumb.Item>
              {selectedTable
                ? tableOptions.find((o) => o.key === selectedTable)?.label
                : "Home"}
            </Breadcrumb.Item>
          </Breadcrumb>
          {selectedTable && (
            <span style={{ color: "#d4d4d4" }}>
              ({dataMap[selectedTable]?.length || 0} rows)
            </span>
          )}
        </Layout.Header>
        <Layout.Content
          style={{
            flex: 1,
            background: "#1e1e1e",
            padding: "24px",
            color: "#d4d4d4",
          }}
        >
          {selectedTable ? (
            (() => {
              const option = tableOptions.find((o) => o.key === selectedTable);
              return option ? (
                renderTable(
                  option.label,
                  dataMap[selectedTable],
                  option.tableName,
                )
              ) : (
                <p style={{ color: "#d4d4d4" }}>Table not found</p>
              );
            })()
          ) : (
            <div className="welcome" style={{ color: "#d4d4d4" }}>
              <h2>Welcome to OVSDB Viewer</h2>
              <p>Select a table from the sidebar to view data.</p>
              <div className="status">Status: {dataStatus}</div>
            </div>
          )}
        </Layout.Content>
        <Layout.Footer
          style={{
            background: "#007acc",
            borderTop: "1px solid #444",
            padding: "8px 16px",
            height: "auto",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Button
            type="text"
            onClick={() => setShowConnectModal(true)}
            style={{
              color: "#d4d4d4",
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            {connected ? "Reconnect" : "Connect"}
          </Button>
        </Layout.Footer>
      </Layout>
      <Modal
        title="Connect to OVSDB"
        open={showConnectModal}
        onCancel={() => setShowConnectModal(false)}
        footer={null}
        width={600}
        style={{ color: "#d4d4d4" }}
      >
        <div className="form-group" style={{ color: "#d4d4d4" }}>
          <label style={{ color: "#d4d4d4" }}>Host:</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="e.g., 192.168.1.100"
            style={{
              background: "#3c3c3c",
              color: "#d4d4d4",
              border: "1px solid #555",
            }}
          />
        </div>
        <div className="form-group" style={{ color: "#d4d4d4" }}>
          <label style={{ color: "#d4d4d4" }}>Port:</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 22)}
            style={{
              background: "#3c3c3c",
              color: "#d4d4d4",
              border: "1px solid #555",
            }}
          />
        </div>
        <div className="form-group" style={{ color: "#d4d4d4" }}>
          <label style={{ color: "#d4d4d4" }}>User:</label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="e.g., root"
            style={{
              background: "#3c3c3c",
              color: "#d4d4d4",
              border: "1px solid #555",
            }}
          />
        </div>
        <div className="form-group" style={{ color: "#d4d4d4" }}>
          <label style={{ color: "#d4d4d4" }}>Key File:</label>
          <input
            type="text"
            value={keyFile}
            onChange={(e) => setKeyFile(e.target.value)}
            placeholder="e.g., /home/user/.ssh/id_rsa"
            style={{
              background: "#3c3c3c",
              color: "#d4d4d4",
              border: "1px solid #555",
            }}
          />
        </div>
        <div className="form-group" style={{ color: "#d4d4d4" }}>
          <label style={{ color: "#d4d4d4" }}>Endpoint:</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="e.g., tcp:127.0.0.1:6640 or unix:/var/run/ovsdb.sock"
            style={{
              background: "#3c3c3c",
              color: "#d4d4d4",
              border: "1px solid #555",
            }}
          />
        </div>
        <div className="form-group" style={{ color: "#d4d4d4" }}>
          <label style={{ color: "#d4d4d4" }}>
            Jump Hosts (comma-separated):
          </label>
          <input
            type="text"
            value={jumpHosts}
            onChange={(e) => setJumpHosts(e.target.value)}
            placeholder="e.g., user@jump1:22, user@jump2:22"
            style={{
              background: "#3c3c3c",
              color: "#d4d4d4",
              border: "1px solid #555",
            }}
          />
        </div>
        <div className="form-group" style={{ color: "#d4d4d4" }}>
          <label style={{ color: "#d4d4d4" }}>Local Forwarder Type:</label>
          <select
            value={localForwarderType}
            onChange={(e) => setLocalForwarderType(e.target.value)}
            style={{
              background: "#3c3c3c",
              color: "#d4d4d4",
              border: "1px solid #555",
            }}
          >
            <option value="tcp">TCP</option>
            <option value="unix">Unix</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        <div className="table-selection" style={{ color: "#d4d4d4" }}>
          <h3 style={{ color: "#d4d4d4" }}>Select Tables to Monitor:</h3>
          {tableOptions.map((option) => (
            <label
              key={option.key}
              className="checkbox-label"
              style={{ color: "#d4d4d4" }}
            >
              <input
                type="checkbox"
                checked={selectedTables.includes(option.key)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTables([...selectedTables, option.key]);
                  } else {
                    setSelectedTables(
                      selectedTables.filter((t) => t !== option.key),
                    );
                  }
                }}
                style={{ background: "#3c3c3c", border: "1px solid #555" }}
              />
              {option.label}
            </label>
          ))}
        </div>
        <div className="button-group">
          <Button type="primary" onClick={connectOVSDB}>
            Connect
          </Button>
          <Button onClick={() => setShowConnectModal(false)}>Cancel</Button>
        </div>
        <div className="status" style={{ color: "#d4d4d4" }}>
          Status: {connectionStatus}
        </div>
        <div
          className="history-section"
          style={{
            color: "#d4d4d4",
            background: "#1e1e1e",
            padding: "16px",
            borderRadius: "4px",
          }}
        >
          <h3 style={{ color: "#d4d4d4" }}>Connection History</h3>
          {history.length === 0 ? (
            <p style={{ color: "#888" }}>No connection history yet.</p>
          ) : (
            <ul
              className="history-list"
              style={{
                color: "#d4d4d4",
                listStyle: "none",
                padding: 0,
                background: "#252526",
                border: "1px solid #444",
                borderRadius: "4px",
              }}
            >
              {history.map((conn, index) => (
                <li
                  key={conn.id}
                  className="history-item"
                  style={{
                    color: "#d4d4d4",
                    padding: "8px 12px",
                    borderBottom:
                      index < history.length - 1 ? "1px solid #444" : "none",
                    background: index % 2 === 0 ? "#2d2d30" : "#252526",
                  }}
                >
                  <div className="history-info">
                    <strong>
                      {conn.host}:{conn.port}
                    </strong>{" "}
                    - {conn.user} - {conn.endpoint}
                    <br />
                    <small style={{ color: "#888" }}>
                      {new Date(conn.timestamp).toLocaleString()}
                    </small>
                  </div>
                  <div className="history-actions" style={{ marginTop: "8px" }}>
                    <Button
                      size="small"
                      onClick={() => loadConnection(conn)}
                      style={{ marginRight: "8px" }}
                    >
                      Load
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => deleteConnection(index)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </Layout>
  );
}

export default App;
