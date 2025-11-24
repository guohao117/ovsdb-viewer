import React, { useState, useEffect } from "react";
import "./App.css";
import {
  ConnectOVSDB,
  DisconnectOVSDB,
  GetHistory,
  DeleteHistory,
  GetBridges,
  GetPorts,
  GetInterfaces,
  GetOpenvSwitch,
  GetSchema,
} from "../wailsjs/go/main/App";

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

  // OVSDB data states
  const [bridges, setBridges] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [interfaces, setInterfaces] = useState<any[]>([]);
  const [openvSwitch, setOpenvSwitch] = useState<any[]>([]);
  const [dataStatus, setDataStatus] = useState("");
  const [schema, setSchema] = useState<any>(null);
  const [expandedCells, setExpandedCells] = useState<{
    [key: string]: boolean;
  }>({});

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
      loadHistory(); // Reload history after successful connection
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
    } catch (error) {
      setConnectionStatus(`Disconnect failed: ${error}`);
    }
  }

  async function loadData() {
    try {
      setDataStatus("Loading data...");
      const [bridgesData, portsData, interfacesData, ovsData, schemaData] =
        await Promise.all([
          GetBridges(),
          GetPorts(),
          GetInterfaces(),
          GetOpenvSwitch(),
          GetSchema(),
        ]);
      console.log("Bridges data:", bridgesData);
      console.log("Ports data:", portsData);
      console.log("Interfaces data:", interfacesData);
      console.log("OVS data:", ovsData);
      console.log("Schema:", schemaData);
      setBridges(bridgesData);
      setPorts(portsData);
      setInterfaces(interfacesData);
      setOpenvSwitch(ovsData);
      setSchema(JSON.parse(schemaData));
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
    if (!schema || !schema.tables || !schema.tables[tableName]) {
      return (
        <div className="table-section">
          <h3>{title}</h3>
          <p>Schema not loaded or table not found</p>
        </div>
      );
    }

    const tableSchema = schema.tables[tableName];
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

  return (
    <div id="App">
      <div className="ovsdb-section">
        <h2>OVSDB Connection</h2>
        <div className="form-group">
          <label>Host:</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="e.g., 192.168.1.100"
          />
        </div>
        <div className="form-group">
          <label>Port:</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(parseInt(e.target.value) || 22)}
          />
        </div>
        <div className="form-group">
          <label>User:</label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="e.g., root"
          />
        </div>
        <div className="form-group">
          <label>Key File:</label>
          <input
            type="text"
            value={keyFile}
            onChange={(e) => setKeyFile(e.target.value)}
            placeholder="e.g., /home/user/.ssh/id_rsa"
          />
        </div>
        <div className="form-group">
          <label>Endpoint:</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="e.g., tcp:127.0.0.1:6640 or unix:/var/run/ovsdb.sock"
          />
        </div>
        <div className="form-group">
          <label>Jump Hosts (comma-separated):</label>
          <input
            type="text"
            value={jumpHosts}
            onChange={(e) => setJumpHosts(e.target.value)}
            placeholder="e.g., user@jump1:22, user@jump2:22"
          />
        </div>
        <div className="form-group">
          <label>Local Forwarder Type:</label>
          <select
            value={localForwarderType}
            onChange={(e) => setLocalForwarderType(e.target.value)}
          >
            <option value="tcp">TCP</option>
            <option value="unix">Unix</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        <div className="button-group">
          <button className="btn" onClick={connectOVSDB} disabled={connected}>
            Connect
          </button>
          <button
            className="btn"
            onClick={disconnectOVSDB}
            disabled={!connected}
          >
            Disconnect
          </button>
        </div>
        <div className="status">Status: {connectionStatus}</div>
      </div>

      {connected && (
        <div className="data-section">
          <h2>OVSDB Data</h2>
          <button className="btn" onClick={loadData}>
            Load Data
          </button>
          <div className="status">Status: {dataStatus}</div>

          {renderTable("Bridges", bridges, "Bridge")}

          {renderTable("Ports", ports, "Port")}

          {renderTable("Interfaces", interfaces, "Interface")}

          {renderTable("Open vSwitch", openvSwitch, "Open_vSwitch")}
        </div>
      )}

      <div className="history-section">
        <h2>Connection History</h2>
        {history.length === 0 ? (
          <p>No connection history yet.</p>
        ) : (
          <ul className="history-list">
            {history.map((conn, index) => (
              <li key={conn.id} className="history-item">
                <div className="history-info">
                  <strong>
                    {conn.host}:{conn.port}
                  </strong>{" "}
                  - {conn.user} - {conn.endpoint}
                  <br />
                  <small>{new Date(conn.timestamp).toLocaleString()}</small>
                </div>
                <div className="history-actions">
                  <button
                    className="btn-small"
                    onClick={() => loadConnection(conn)}
                  >
                    Load
                  </button>
                  <button
                    className="btn-small delete"
                    onClick={() => deleteConnection(index)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
