import React, { useState, useEffect } from "react";
import "./App.css";
import schema from "./schema.json";
import {
  Layout,
  Menu,
  Button,
  Breadcrumb,
  Modal,
  ConfigProvider,
  theme,
  Form,
  Input,
  Select,
  Checkbox,
  List,
  Space,
} from "antd";
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
  const [form] = Form.useForm();

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
        <div
          className="table-section"
          style={{ height: "100%", overflow: "auto", padding: "24px" }}
        >
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
      <div
        className="table-section"
        style={{ height: "100%", overflow: "auto", padding: "24px" }}
      >
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
              {data.map((item: any, index) => {
                const expandedKeys = Object.keys(expandedCells).filter((key) =>
                  key.startsWith(`${tableName}-${index}-`),
                );
                const hasExpanded = expandedKeys.length > 0;
                return (
                  <>
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
                          <td key={col.field}>
                            {isComplex ? (
                              small ? (
                                <span>{JSON.stringify(value)}</span>
                              ) : (
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
                              )
                            ) : (
                              value || "-"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {hasExpanded && (
                      <tr key={`${index}-expanded`}>
                        <td
                          colSpan={columns.length}
                          style={{ padding: "1rem", background: "#2d2d30" }}
                        >
                          {expandedKeys.map((key) => {
                            const colField = key.split("-").slice(2).join("-");
                            const value = item[colField];
                            return (
                              <div key={key} style={{ marginBottom: "1rem" }}>
                                <strong>{colField}:</strong>
                                <pre
                                  style={{
                                    margin: "0.5rem 0",
                                    whiteSpace: "pre-wrap",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              </div>
                            );
                          })}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
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
    form.setFieldsValue({
      host: conn.host,
      port: conn.port,
      user: conn.user,
      keyFile: conn.keyFile,
      endpoint: conn.endpoint,
      jumpHosts: conn.jumpHosts,
      localForwarderType: conn.localForwarderType,
    });
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
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, cssVar: true }}>
      <Layout style={{ height: "100vh" }}>
        <Layout.Sider width={250}>
          <div className="logo">OVSDB Viewer</div>
          <Menu
            mode="inline"
            selectedKeys={selectedTable ? [selectedTable] : []}
            onClick={({ key }: { key: string }) => setSelectedTable(key)}
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
              };
            })}
          />
        </Layout.Sider>
        <Layout
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          <Layout.Header>
            <Breadcrumb>
              <Breadcrumb.Item>OVSDB</Breadcrumb.Item>
              <Breadcrumb.Item>
                {selectedTable
                  ? tableOptions.find((o) => o.key === selectedTable)?.label
                  : "Home"}
              </Breadcrumb.Item>
            </Breadcrumb>
            {selectedTable && (
              <span>({dataMap[selectedTable]?.length || 0} rows)</span>
            )}
          </Layout.Header>
          <Layout.Content style={{ flex: 1, overflow: "hidden" }}>
            {selectedTable ? (
              (() => {
                const option = tableOptions.find(
                  (o) => o.key === selectedTable,
                );
                return option ? (
                  renderTable(
                    option.label,
                    dataMap[selectedTable],
                    option.tableName,
                  )
                ) : (
                  <p>Table not found</p>
                );
              })()
            ) : (
              <div className="welcome" style={{ padding: "24px" }}>
                <h2>Welcome to OVSDB Viewer</h2>
                <p>Select a table from the sidebar to view data.</p>
                <div className="status">Status: {dataStatus}</div>
              </div>
            )}
          </Layout.Content>
        </Layout>
        <Layout.Footer
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<ApiOutlined />}
            onClick={() =>
              connected ? disconnectOVSDB() : setShowConnectModal(true)
            }
          >
            {connected ? "Disconnect" : "Connect"}
          </Button>
        </Layout.Footer>
        <Modal
          title="Connect to OVSDB"
          open={showConnectModal}
          onCancel={() => setShowConnectModal(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={connectOVSDB}
            initialValues={{
              host,
              port,
              user,
              keyFile,
              endpoint,
              jumpHosts,
              localForwarderType,
              selectedTables,
            }}
          >
            <Form.Item label="Host" name="host">
              <Input placeholder="e.g., 192.168.1.100" />
            </Form.Item>
            <Form.Item label="Port" name="port">
              <Input type="number" />
            </Form.Item>
            <Form.Item label="User" name="user">
              <Input placeholder="e.g., root" />
            </Form.Item>
            <Form.Item label="Key File" name="keyFile">
              <Input placeholder="e.g., /home/user/.ssh/id_rsa" />
            </Form.Item>
            <Form.Item label="Endpoint" name="endpoint">
              <Input placeholder="e.g., tcp:127.0.0.1:6640 or unix:/var/run/ovsdb.sock" />
            </Form.Item>
            <Form.Item label="Jump Hosts (comma-separated)" name="jumpHosts">
              <Input placeholder="e.g., user@jump1:22, user@jump2:22" />
            </Form.Item>
            <Form.Item label="Local Forwarder Type" name="localForwarderType">
              <Select>
                <Select.Option value="tcp">TCP</Select.Option>
                <Select.Option value="unix">Unix</Select.Option>
                <Select.Option value="auto">Auto</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Select Tables to Monitor" name="selectedTables">
              <Checkbox.Group>
                {tableOptions.map((option) => (
                  <Checkbox key={option.key} value={option.key}>
                    {option.label}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Connect
                </Button>
                <Button onClick={() => setShowConnectModal(false)}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
          <div>Status: {connectionStatus}</div>
          <div>
            <h3>Connection History</h3>
            {history.length === 0 ? (
              <p>No connection history yet.</p>
            ) : (
              <List
                dataSource={history}
                renderItem={(conn, index) => (
                  <List.Item
                    actions={[
                      <Button size="small" onClick={() => loadConnection(conn)}>
                        Load
                      </Button>,
                      <Button
                        size="small"
                        danger
                        onClick={() => deleteConnection(index)}
                      >
                        Delete
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={`${conn.host}:${conn.port} - ${conn.user} - ${conn.endpoint}`}
                      description={new Date(conn.timestamp).toLocaleString()}
                    />
                  </List.Item>
                )}
              />
            )}
          </div>
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
