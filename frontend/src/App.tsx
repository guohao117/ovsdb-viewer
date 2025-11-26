import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import schema from "./schema.json";
import {
  Layout,
  Button,
  Breadcrumb,
  Modal,
  ConfigProvider,
  theme,
  Form,
  Input,
  Select,
  List,
  Space,
  Tabs,
  Table,
  Drawer,
  Tree,
} from "antd";
import {
  VscJson,
  VscTable,
  VscDebugStart,
  VscDebugStop,
} from "react-icons/vsc";
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
  // refs & offsets for sticky tab & table calculations
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [tabsOffset, setTabsOffset] = useState<number>(0);
  const tableSectionRef = useRef<HTMLDivElement | null>(null);
  const [tableBodyHeight, setTableBodyHeight] = useState<number | undefined>(
    undefined,
  );

  // OVSDB data states
  const [bridges, setBridges] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [interfaces, setInterfaces] = useState<any[]>([]);
  const [openvSwitch, setOpenvSwitch] = useState<any[]>([]);
  const [dataStatus, setDataStatus] = useState("");
  const [expandedCells, setExpandedCells] = useState<{
    [key: string]: boolean;
  }>({});
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState<string | null>(null);
  const [drawerContent, setDrawerContent] = useState<any | null>(null);
  // NOTE: 'selectedTables' state removed. Use Sider to open/close tables and
  // keep a single source of truth in `monitoredTables`.

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
      setShowConnectModal(false);
      loadHistory(); // Reload history after successful connection
      // If a table is already selected, load just that one (useEffect also covers this)
      if (selectedTable) {
        loadDataForTable(selectedTable);
      }
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

  async function loadDataForTable(key: string) {
    try {
      if (!connected) {
        setDataStatus("Not connected");
        return;
      }
      setDataStatus(`Loading ${key}...`);
      console.log("loadDataForTable: key =", key);
      if (key === "bridges") {
        const res = await GetBridges();
        setBridges(res);
      } else if (key === "ports") {
        const res = await GetPorts();
        setPorts(res);
      } else if (key === "interfaces") {
        const res = await GetInterfaces();
        setInterfaces(res);
      } else if (key === "openvSwitch") {
        const res = await GetOpenvSwitch();
        setOpenvSwitch(res);
      } else {
        // unknown key - nothing to load
      }
      setDataStatus("Data loaded successfully");
    } catch (error) {
      console.log("loadDataForTable error:", error);
      setDataStatus(`Failed to load data for ${key}: ${error}`);
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

  function openDrawer(title: string, content: any) {
    setDrawerTitle(title);
    setDrawerContent(content);
    setDrawerVisible(true);
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
        <div className="table-section" ref={tableSectionRef}>
          <h3>{title}</h3>
          <p>Schema not loaded or table not found</p>
        </div>
      );
    }

    const tableSchema = (schema.tables as any)[tableName];
    const columns = Object.keys(tableSchema.columns).map((field) => {
      const dataIndex = toCamelCase(field); // Convert to Go struct field name field -> data key
      const label = field
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      return {
        title: label,
        dataIndex,
        key: dataIndex,
        render: (value: any, record: any, rowIndex: number) => {
          const cellKey = `${tableName}-${rowIndex}-${dataIndex}`;
          const isComplex =
            Array.isArray(value) ||
            (typeof value === "object" && value !== null);
          const small = isComplex && isSmallComplex(value);
          if (!isComplex) {
            return value || "-";
          }
          if (small) {
            return <span>{JSON.stringify(value)}</span>;
          }
          if (expandedCells[cellKey]) {
            return (
              <>
                <Button
                  size="small"
                  onClick={() => toggleCell(tableName, rowIndex, dataIndex)}
                >
                  Collapse
                </Button>
                <pre className="complex-value">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </>
            );
          }
          return (
            <Button
              size="small"
              onClick={() => toggleCell(tableName, rowIndex, dataIndex)}
            >
              {Array.isArray(value) ? `${value.length} items` : "View"}
            </Button>
          );
        },
      };
    });

    const dataSource = (data || []).map((row: any, i: number) => ({
      ...row,
      key: `${tableName}-${i}`,
    }));

    return (
      <div className="table-section">
        <h3>
          {title} ({data.length})
        </h3>
        {data.length === 0 ? (
          <p className="no-data">No data available</p>
        ) : (
          <Table
            columns={columns}
            dataSource={dataSource}
            size="small"
            pagination={false}
            rowKey={(record) => record.key}
            // Use scroll to allow horizontal scroll if many columns and set internal body height
            scroll={
              tableBodyHeight
                ? { x: "max-content", y: tableBodyHeight }
                : { x: "max-content" }
            }
            // Enable antd Table sticky header and offset the header by the tabs row height
            sticky={{ offsetHeader: tabsOffset }}
            expandable={{
              // Row-level expand: show the full record as JSON when row expanded
              expandedRowRender: (record) => (
                <pre className="complex-value">
                  {JSON.stringify(record, null, 2)}
                </pre>
              ),
              // By default allow all rows to be expandable
              rowExpandable: () => true,
            }}
          />
        )}
      </div>
    );
  }

  // Load history from backend on component mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Compute table body scroll y (so Table uses an internal scroll area and header becomes fixed inside the table)
  useEffect(() => {
    function computeHeight() {
      const el = tableSectionRef.current;
      if (!el) {
        setTableBodyHeight(undefined);
        return;
      }
      const sectionHeight = el.clientHeight || 0;
      const titleEl = el.querySelector("h3") as HTMLElement | null;
      const titleHeight = titleEl ? titleEl.offsetHeight : 36;
      const style = window.getComputedStyle(el);
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      // Subtract title + padding to find available height for the table body
      const computed = sectionHeight - titleHeight - paddingTop - paddingBottom;
      setTableBodyHeight(computed > 0 ? computed : undefined);
    }
    computeHeight();

    let ro: any;
    const el = tableSectionRef.current;
    if (el && typeof window !== "undefined" && (window as any).ResizeObserver) {
      ro = new (window as any).ResizeObserver(() => computeHeight());
      ro.observe(el);
    } else {
      window.addEventListener("resize", computeHeight);
    }
    return () => {
      if (ro && ro.disconnect) {
        ro.disconnect();
      } else {
        window.removeEventListener("resize", computeHeight);
      }
    };
  }, [monitoredTables, selectedTable, tabsOffset]);

  // Load data for the selected table when the selected table or connection changes
  useEffect(() => {
    if (connected && selectedTable) {
      loadDataForTable(selectedTable);
    }
  }, [selectedTable, connected]);

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

  // Removed duplicate getIconByKey (legacy mapping). The unified `getIconByKey` function
  // that returns a table icon is defined later in the file.

  function removeTab(targetKey: string) {
    // Compute new set of tabs
    const newTabs = monitoredTables.filter((k) => k !== targetKey);

    // Update monitoredTables and selectedTables
    setMonitoredTables(newTabs);

    // Clear data for removed table to keep state consistent
    if (targetKey === "bridges") setBridges([]);
    else if (targetKey === "ports") setPorts([]);
    else if (targetKey === "interfaces") setInterfaces([]);
    else if (targetKey === "openvSwitch") setOpenvSwitch([]);

    // If the closed tab was selected, choose a sensible new selection
    if (selectedTable === targetKey) {
      const idx = monitoredTables.indexOf(targetKey);
      const newSelected =
        newTabs[idx] || newTabs[idx - 1] || newTabs[0] || null;
      setSelectedTable(newSelected);
    }
  }

  function getIconByKey(key: string) {
    // Use a consistent VS Code codicon (react-icons/vsc) for every table item
    return <VscTable className="react-icon" />;
  }

  const dataMap: { [key: string]: any[] } = {
    bridges,
    ports,
    interfaces,
    openvSwitch,
  };

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, cssVar: true }}>
      <Layout className="root-layout">
        <Layout.Sider className="left-sider" width={250} theme="dark">
          <div className="logo">OVSDB Viewer</div>
          <div className="sider-header">
            <VscJson className="react-icon" />
            <span className="sider-title">DBs</span>
          </div>
          <Tree
            showIcon
            defaultExpandAll
            selectedKeys={selectedTable ? [selectedTable] : []}
            onSelect={(selectedKeys: any, info: any) => {
              const key =
                selectedKeys && selectedKeys.length
                  ? String(selectedKeys[0])
                  : "";
              // If clicking root (db-root) or nothing, do not select a table
              if (!key || key === "db-root") {
                setSelectedTable(null);
                return;
              }
              // If the clicked table isn't opened, add it to monitoredTables (open a new tab)
              setMonitoredTables((prev) => {
                if (!prev.includes(key)) {
                  return [...prev, key];
                }
                return prev;
              });
              // Focus the clicked/opened table
              setSelectedTable(key);
              // Load data for just that opened table (instead of all monitored tables)
              if (connected) {
                loadDataForTable(key);
              }
            }}
            treeData={[
              {
                title: schema?.name || "Open_vSwitch",
                key: "db-root",
                icon: <VscJson className="react-icon tree-icon" />,
                children: tableOptions.map((option) => ({
                  title: option.label,
                  key: option.key,
                  icon: <VscTable className="react-icon tree-icon" />,
                })),
              },
            ]}
          />
        </Layout.Sider>
        <Layout className="main-layout">
          <Layout.Header className="header">
            <div className="header-top">
              <Breadcrumb>
                <Breadcrumb.Item>{schema?.name || "OVSDB"}</Breadcrumb.Item>
                <Breadcrumb.Item>
                  {selectedTable
                    ? tableOptions.find((o) => o.key === selectedTable)?.label
                    : "Home"}
                </Breadcrumb.Item>
              </Breadcrumb>
              {selectedTable && (
                <span>({dataMap[selectedTable]?.length || 0} rows)</span>
              )}
            </div>
          </Layout.Header>
          <Layout.Content className="content">
            {monitoredTables && monitoredTables.length > 0 && (
              <div className="tabs-row" ref={tabsRef}>
                <Tabs
                  activeKey={selectedTable || undefined}
                  onChange={(key) => {
                    setSelectedTable(key);
                    if (connected) {
                      loadDataForTable(key);
                    }
                  }}
                  type="editable-card"
                  hideAdd
                  onEdit={(targetKey, action) => {
                    if (action === "remove") {
                      removeTab(targetKey as string);
                    }
                  }}
                  items={monitoredTables.map((key) => {
                    const option = tableOptions.find((o) => o.key === key);
                    return {
                      key,
                      label: (
                        <span className="tab-label">
                          {getIconByKey(key)}
                          <span>{option?.label}</span>
                        </span>
                      ),
                      closable: true,
                    };
                  })}
                />
              </div>
            )}
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
              <div className="welcome">
                <h2>Welcome to OVSDB Viewer</h2>
                <p>Select a table from the sidebar to view data.</p>
                <div className="status">Status: {dataStatus}</div>
              </div>
            )}
          </Layout.Content>
        </Layout>
        <Layout.Footer className="footer">
          <Button
            type="text"
            size="small"
            icon={
              connected ? (
                <VscDebugStop className="react-icon" />
              ) : (
                <VscDebugStart className="react-icon" />
              )
            }
            onClick={() =>
              connected ? disconnectOVSDB() : setShowConnectModal(true)
            }
          >
            {connected ? "Disconnect" : "Connect"}
          </Button>
        </Layout.Footer>
        <Drawer
          title={drawerTitle}
          open={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          width={700}
        >
          <pre className="complex-value">
            {JSON.stringify(drawerContent, null, 2)}
          </pre>
        </Drawer>
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
            onFinish={() => connectOVSDB()}
            initialValues={{
              host,
              port,
              user,
              keyFile,
              endpoint,
              jumpHosts,
              localForwarderType,
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
