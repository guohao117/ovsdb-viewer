import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import {
  Layout,
  Button,
  Breadcrumb,
  Modal,
  ConfigProvider,
  theme,
  Form,
  Input,
  Switch,
  Card,
  Divider,
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
  ConnectDynamic,
  DisconnectOVSDB,
  GetHistory,
  DeleteHistory,
  GetSchema,
  GetSchemaDynamic,
  GetTable,
  GetTableDynamic,
  ListDatabases,
} from "../wailsjs/go/main/App";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { main, ovsdb } from "../wailsjs/go/models";

const HISTORY_VERSION = 2;

interface TunnelFormValues {
  host: string;
  port: number;
  user: string;
  keyFile: string;
  jumpHosts: string;
  localForwarderType: string;
}

interface EndpointFormValues {
  endpoint: string;
  tunnelEnabled: boolean;
  tunnel: TunnelFormValues;
}

interface HistoryTunnel {
  host: string;
  port: number;
  user: string;
  keyFile: string;
  jumpHosts: string[];
  localForwarderType: string;
}

interface HistoryEndpoint {
  endpoint: string;
  tunnel?: HistoryTunnel | null;
}

interface ConnectionHistoryRecord {
  backendIndex: number;
  id: string;
  endpoints: HistoryEndpoint[];
  timestamp: number;
}

interface ConnectFormValues {
  endpoints: EndpointFormValues[];
}

interface EndpointConfigPayload {
  endpoint: string;
  tunnel?: HistoryTunnel;
}

const DEFAULT_LOCAL_FORWARDER = "tcp";
const DEFAULT_SSH_PORT = 22;

const createEmptyEndpoint = (): EndpointFormValues => ({
  endpoint: "",
  tunnelEnabled: false,
  tunnel: {
    host: "",
    port: DEFAULT_SSH_PORT,
    user: "",
    keyFile: "",
    jumpHosts: "",
    localForwarderType: DEFAULT_LOCAL_FORWARDER,
  },
});

function upgradeHistoryRecord(
  record: main.ConnectionHistory,
): main.ConnectionHistory {
  if (!record) {
    return record;
  }

  const baseData = {
    version: record.version,
    timestamp: record.timestamp,
    endpoints: (record.endpoints || []).map((endpoint) => ({
      endpoint: endpoint.endpoint || "",
      tunnel: endpoint.tunnel
        ? {
            host: endpoint.tunnel.host || "",
            port: endpoint.tunnel.port || DEFAULT_SSH_PORT,
            user: endpoint.tunnel.user || "",
            keyFile: endpoint.tunnel.keyFile || "",
            jumpHosts: endpoint.tunnel.jumpHosts
              ? [...endpoint.tunnel.jumpHosts]
              : [],
            localForwarderType:
              endpoint.tunnel.localForwarderType || DEFAULT_LOCAL_FORWARDER,
          }
        : undefined,
    })),
    host: record.host,
    port: record.port,
    user: record.user,
    keyFile: record.keyFile,
    endpoint: record.endpoint,
    jumpHosts: record.jumpHosts ? [...record.jumpHosts] : undefined,
    localForwarderType: record.localForwarderType,
  };

  const hasEndpoints = baseData.endpoints.length > 0;

  if (!hasEndpoints && record.endpoint) {
    const tunnel = record.host
      ? {
          host: record.host,
          port: record.port || DEFAULT_SSH_PORT,
          user: record.user || "",
          keyFile: record.keyFile || "",
          jumpHosts: record.jumpHosts ? [...record.jumpHosts] : [],
          localForwarderType: record.localForwarderType || DEFAULT_LOCAL_FORWARDER,
        }
      : undefined;
    baseData.endpoints = [
      {
        endpoint: record.endpoint,
        tunnel,
      },
    ];
  }

  if (!baseData.version || baseData.version !== HISTORY_VERSION) {
    baseData.version = HISTORY_VERSION;
  }

  if (baseData.endpoints.length > 0) {
    baseData.host = "";
    baseData.port = 0;
    baseData.user = "";
    baseData.keyFile = "";
    baseData.endpoint = "";
    baseData.jumpHosts = [];
    baseData.localForwarderType = "";
  }

  return main.ConnectionHistory.createFrom(baseData);
}

function mapHistoryRecord(
  record: main.ConnectionHistory,
  index: number,
): ConnectionHistoryRecord {
  const upgraded = upgradeHistoryRecord(record);
  const endpoints: HistoryEndpoint[] = (upgraded.endpoints || []).map((endpoint) => ({
    endpoint: endpoint.endpoint || "",
    tunnel: endpoint.tunnel
      ? {
          host: endpoint.tunnel.host || "",
          port: endpoint.tunnel.port || DEFAULT_SSH_PORT,
          user: endpoint.tunnel.user || "",
          keyFile: endpoint.tunnel.keyFile || "",
          jumpHosts: endpoint.tunnel.jumpHosts
            ? [...endpoint.tunnel.jumpHosts]
            : [],
          localForwarderType:
            endpoint.tunnel.localForwarderType || DEFAULT_LOCAL_FORWARDER,
        }
      : undefined,
  }));

  const signature = endpoints.map((ep) => ep.endpoint).join("|") || "endpoint";

  return {
    backendIndex: index,
    id: `${signature}:${upgraded.timestamp || 0}:${index}`,
    endpoints,
    timestamp: (upgraded.timestamp || 0) * 1000,
  };
}

function App() {
  const [form] = Form.useForm();

  // OVSDB connection states
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [history, setHistory] = useState<ConnectionHistoryRecord[]>([]);
  const [currentDb, setCurrentDb] = useState("Open_vSwitch");
  const [dbList, setDbList] = useState<string[]>([]);

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
  const [schema, setSchema] = useState<ovsdb.DatabaseSchema | null>(null);
  const [tableData, setTableData] = useState<{ [key: string]: any[] }>({});
  const [dataStatus, setDataStatus] = useState("");
  const [expandedCells, setExpandedCells] = useState<{
    [key: string]: boolean;
  }>({});
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState<string | null>(null);
  const [drawerContent, setDrawerContent] = useState<any | null>(null);
  const endpointsWatch = Form.useWatch("endpoints", form) as
    | EndpointFormValues[]
    | undefined;
  // NOTE: 'selectedTables' state removed. Use Sider to open/close tables and
  // keep a single source of truth in `monitoredTables`.

  async function handleConnect(values: ConnectFormValues) {
    try {
      setConnectionStatus("Connecting...");
      const sanitizedEndpoints = (values.endpoints || [])
        .map((endpointConfig) => {
          const trimmedEndpoint = endpointConfig.endpoint.trim();
          if (!trimmedEndpoint) {
            return null;
          }
          const payload: EndpointConfigPayload = {
            endpoint: trimmedEndpoint,
          };
          if (endpointConfig.tunnelEnabled) {
            const tunnelHost = endpointConfig.tunnel.host.trim();
            if (!tunnelHost) {
              throw new Error("Tunnel host is required when tunnel is enabled.");
            }
            const jumpHostsArray = endpointConfig.tunnel.jumpHosts
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean);
            payload.tunnel = {
              host: tunnelHost,
              port: endpointConfig.tunnel.port || DEFAULT_SSH_PORT,
              user: endpointConfig.tunnel.user.trim(),
              keyFile: endpointConfig.tunnel.keyFile.trim(),
              jumpHosts: jumpHostsArray,
              localForwarderType:
                endpointConfig.tunnel.localForwarderType ||
                DEFAULT_LOCAL_FORWARDER,
            };
          }
          return payload;
        })
        .filter((endpoint): endpoint is EndpointConfigPayload => !!endpoint);

      if (sanitizedEndpoints.length === 0) {
        setConnectionStatus("Please configure at least one valid endpoint.");
        return;
      }

      const requestPayload = {
        endpoints: sanitizedEndpoints,
      };
      const request = main.ConnectRequest.createFrom(requestPayload);
      await ConnectDynamic(request, currentDb);
      setConnected(true);
      setConnectionStatus("Connected successfully!");
      setShowConnectModal(false);
      loadHistory(); // Reload history after successful connection

      // Fetch available DBs
      try {
        const dbs = await ListDatabases();
        setDbList(dbs);
      } catch (e) {
        console.error("Failed to list databases", e);
      }

      // Load schema
      const dbSchema = await GetSchemaDynamic(currentDb);
      setSchema(dbSchema);
      // If a table is already selected, load just that one (useEffect also covers this)
      if (selectedTable) {
        loadDataForTable(selectedTable);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConnectionStatus(`Connection failed: ${message}`);
    }
  }

  async function disconnectOVSDB() {
    try {
      await DisconnectOVSDB();
      setConnected(false);
      setConnectionStatus("Disconnected");
      // Clear data
      setSchema(null);
      setTableData({});
      setMonitoredTables([]);
      setSelectedTable(null);
    } catch (error) {
      setConnectionStatus(`Disconnect failed: ${error}`);
    }
  }

  async function loadDataForTable(tableName: string) {
    try {
      if (!connected) {
        setDataStatus("Not connected");
        return;
      }
      setDataStatus(`Loading ${tableName}...`);
      console.log("loadDataForTable: tableName =", tableName);
      const res = await GetTableDynamic(currentDb, tableName);
      setTableData((prev) => ({ ...prev, [tableName]: res }));
      setDataStatus("Data loaded successfully");
    } catch (error) {
      console.log("loadDataForTable error:", error);
      setDataStatus(`Failed to load data for ${tableName}: ${error}`);
    }
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

    // Ensure data is an array
    const safeData = data || [];

    const tableSchema = (schema.tables as any)[tableName];
    
    // Create index column definitions first
    const indexColumns = (tableSchema.indexes || []).flatMap((indexArray: string[]) => 
      indexArray.map((field: string) => {
        const label = field
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        return {
          field,
          title: label,
          dataIndex: field,
          key: field,
        };
      })
    );
    
    // Get index field names for filtering
    const indexFieldNames = new Set(
      (tableSchema.indexes || []).flatMap((indexArray: string[]) => indexArray)
    );
    
    // Create regular columns, excluding index fields
    const regularColumns = Object.keys(tableSchema.columns)
      .filter((field) => !indexFieldNames.has(field))
      .map((field) => {
        const label = field
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        return {
          field,
          title: label,
          dataIndex: field,
          key: field,
        };
      });
    
    // Combine index columns first, then regular columns
    const allColumns = [...indexColumns, ...regularColumns];
    
    const columns = allColumns.map((col) => ({
      ...col,
      render: (value: any, record: any, rowIndex: number) => {
          const cellKey = `${tableName}-${rowIndex}-${col.dataIndex}`;
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
                  onClick={() => toggleCell(tableName, rowIndex, col.dataIndex)}
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
              onClick={() => toggleCell(tableName, rowIndex, col.dataIndex)}
            >
              {Array.isArray(value) ? `${value.length} items` : "View"}
            </Button>
          );
        },
      }
    ));

    const dataSource = safeData.map((row: any, i: number) => ({
      ...row,
      key: `${tableName}-${i}`,
    }));

    return (
      <div className="table-section">
        <h3>
          {title} ({safeData.length})
        </h3>
        {safeData.length === 0 ? (
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
      const mappedHistory = hist.map((record, index) =>
        mapHistoryRecord(record, index),
      );
      setHistory(mappedHistory);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }

  function loadConnection(conn: ConnectionHistoryRecord) {
    const endpoints =
      conn.endpoints.length > 0
        ? conn.endpoints.map((endpoint) => ({
            endpoint: endpoint.endpoint,
            tunnelEnabled: Boolean(endpoint.tunnel),
            tunnel: {
              host: endpoint.tunnel?.host || "",
              port: endpoint.tunnel?.port || DEFAULT_SSH_PORT,
              user: endpoint.tunnel?.user || "",
              keyFile: endpoint.tunnel?.keyFile || "",
              jumpHosts: (endpoint.tunnel?.jumpHosts || []).join(", "),
              localForwarderType:
                endpoint.tunnel?.localForwarderType || DEFAULT_LOCAL_FORWARDER,
            },
          }))
        : [createEmptyEndpoint()];
    form.setFieldsValue({ endpoints });
    setShowConnectModal(true);
    setConnectionStatus("Loaded connection from history");
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
    const newTabs = monitoredTables.filter((tableName) => tableName !== targetKey);

    // Update monitoredTables
    setMonitoredTables(newTabs);

    // Clear data for removed table to keep state consistent
    setTableData((prev) => {
      const newData = { ...prev };
      delete newData[targetKey];
      return newData;
    });

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

  const dataMap = tableData;

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
              const tableName =
                selectedKeys && selectedKeys.length
                  ? String(selectedKeys[0])
                  : "";
              // If clicking root (db-root) or nothing, do not select a table
              if (!tableName || tableName === "db-root") {
                setSelectedTable(null);
                return;
              }
              // If the clicked table isn't opened, add it to monitoredTables (open a new tab)
              setMonitoredTables((prev) => {
                if (!prev.includes(tableName)) {
                  return [...prev, tableName];
                }
                return prev;
              });
              // Focus the clicked/opened table
              setSelectedTable(tableName);
              // Load data for just that opened table
              if (connected) {
                loadDataForTable(tableName);
              }
            }}
            treeData={[
              {
                title: schema?.name || "Open_vSwitch",
                key: "db-root",
                icon: <VscJson className="react-icon tree-icon" />,
                children: schema?.tables
                  ? Object.keys(schema.tables).map((tableName) => ({
                      title: tableName,
                      key: tableName,
                      icon: <VscTable className="react-icon tree-icon" />,
                    }))
                  : [],
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
                  {selectedTable || "Home"}
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
                  items={monitoredTables.map((tableName) => {
                    return {
                      key: tableName,
                      label: (
                        <span className="tab-label">
                          {getIconByKey(tableName)}
                          <span>{tableName}</span>
                        </span>
                      ),
                      closable: true,
                    };
                  })}
                />
              </div>
            )}
            {selectedTable ? (
              renderTable(
                selectedTable,
                dataMap[selectedTable],
                selectedTable,
              )
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
          width={700}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleConnect}
            initialValues={{
              endpoints: [createEmptyEndpoint()],
            }}
          >
            <Form.List name="endpoints">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: "100%" }} size="large">
                  {fields.map((field, index) => {
                    const endpointValues = endpointsWatch?.[field.name as number];
                    const tunnelEnabled = endpointValues?.tunnelEnabled;
                    return (
                      <Card key={field.key} size="small" className="endpoint-card">
                        <div className="endpoint-card__header">
                          <span>Endpoint {index + 1}</span>
                          {fields.length > 1 && (
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(field.name)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <Form.Item
                          label="Endpoint"
                          name={[field.name, "endpoint"]}
                          rules={[{ required: true, message: "Please enter an endpoint" }]}
                        >
                          <Input placeholder="e.g., tcp:127.0.0.1:6640 or unix:/var/run/ovsdb.sock" />
                        </Form.Item>
                        <Form.Item
                          label="Enable Tunnel"
                          name={[field.name, "tunnelEnabled"]}
                          valuePropName="checked"
                        >
                          <Switch />
                        </Form.Item>
                        {tunnelEnabled && (
                          <div className="tunnel-section">
                            <Form.Item
                              label="SSH Host"
                              name={[field.name, "tunnel", "host"]}
                              rules={[
                                {
                                  required: true,
                                  message: "SSH host is required when tunnel is enabled",
                                },
                              ]}
                            >
                              <Input placeholder="e.g., bastion.example.com" />
                            </Form.Item>
                            <Form.Item
                              label="SSH Port"
                              name={[field.name, "tunnel", "port"]}
                            >
                              <Input type="number" min={1} />
                            </Form.Item>
                            <Form.Item
                              label="SSH User"
                              name={[field.name, "tunnel", "user"]}
                            >
                              <Input placeholder="e.g., root" />
                            </Form.Item>
                            <Form.Item
                              label="SSH Key File"
                              name={[field.name, "tunnel", "keyFile"]}
                            >
                              <Input placeholder="e.g., ~/.ssh/id_rsa" />
                            </Form.Item>
                            <Form.Item
                              label="Jump Hosts (comma-separated)"
                              name={[field.name, "tunnel", "jumpHosts"]}
                            >
                              <Input placeholder="e.g., user@jump1:22, user@jump2:22" />
                            </Form.Item>
                            <Form.Item
                              label="Local Forwarder Type"
                              name={[field.name, "tunnel", "localForwarderType"]}
                            >
                              <Select>
                                <Select.Option value="tcp">TCP</Select.Option>
                                <Select.Option value="unix">Unix</Select.Option>
                                <Select.Option value="auto">Auto</Select.Option>
                              </Select>
                            </Form.Item>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                  <Button
                    type="dashed"
                    onClick={() => add(createEmptyEndpoint())}
                    block
                    icon={<PlusOutlined />}
                  >
                    Add Endpoint
                  </Button>
                </Space>
              )}
            </Form.List>
            <Divider />
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Connect
                </Button>
                <Button onClick={() => setShowConnectModal(false)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
          <div className="connection-status">Status: {connectionStatus}</div>
          <Divider orientation="left">Connection History</Divider>
          {history.length === 0 ? (
            <p>No connection history yet.</p>
          ) : (
            <List
              dataSource={history}
              rowKey={(item) => item.id}
              renderItem={(conn) => (
                <List.Item
                  key={conn.id}
                  actions={[
                    <Button size="small" onClick={() => loadConnection(conn)}>
                      Load
                    </Button>,
                    <Button
                      size="small"
                      danger
                      onClick={() => deleteConnection(conn.backendIndex)}
                    >
                      Delete
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={conn.endpoints.map((ep) => ep.endpoint).join(", ") || "(empty)"}
                    description={
                      <div>
                        <div>{new Date(conn.timestamp).toLocaleString()}</div>
                        {conn.endpoints.map((ep, idx) => (
                          <div key={`${conn.id}-${idx}`}>
                            {ep.endpoint}
                            {ep.tunnel
                              ? ` via ${ep.tunnel.user ? `${ep.tunnel.user}@` : ""}${ep.tunnel.host}:${ep.tunnel.port}`
                              : " (direct)"}
                          </div>
                        ))}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Modal>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
