# OVSDB Viewer

A modern, cross-platform GUI client for Open vSwitch Database (OVSDB), built with [Wails](https://wails.io/), Go, and React.

OVSDB Viewer allows you to connect to OVSDB servers, discover schemas dynamically, and visualize database contents in a user-friendly interface. It supports various connection methods including direct TCP, Unix sockets, and SSH tunneling.

## Features

- **Dynamic Schema Discovery**: Automatically fetches schema information from the connected OVSDB server. Works with any OVSDB database (e.g., `Open_vSwitch`, `OVN_Northbound`, `OVN_Southbound`).
- **Multi-Database Support**: List and switch between available databases on the same server via the sidebar.
- **Flexible Connectivity**:
  - **TCP**: Connect directly to remote OVSDB ports (e.g., `tcp:127.0.0.1:6640`).
  - **Unix Sockets**: Connect to local sockets (e.g., `unix:/var/run/openvswitch/db.sock`).
  - **SSH Tunneling**: Securely connect to remote OVSDB instances via SSH, with support for **Jump Hosts** (Bastion servers) and private key authentication.
- **Tabbed Interface**: Open multiple tables simultaneously in tabs for easy comparison and navigation.
- **Connection History**: Saves your connection profiles for quick access.
- **Modern UI**: Dark-themed interface built with Ant Design.

## Prerequisites

To build or develop this project, you need:

- [Go](https://go.dev/) (1.18+)
- [Node.js](https://nodejs.org/) (npm)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

## Installation

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/guohao117/ovsdb-viewer.git
   cd ovsdb-viewer
   ```

2. Build the application:
   ```bash
   wails build
   ```
   The binary will be generated in the `build/bin` directory.

## Development

To run the application in live development mode:

```bash
wails dev
```

This command starts the backend and a Vite development server for the frontend with hot-reload enabled.

## Usage

### Connecting to OVSDB

1. **Direct Connection**:
   - Enter the endpoint URL.
   - Examples: `tcp:127.0.0.1:6640` or `unix:/var/run/openvswitch/db.sock`.

2. **SSH Tunnel**:
   - Toggle "Enable Tunnel".
   - **SSH Host**: The address of the server running OVSDB (or the SSH gateway).
   - **SSH Port**: Usually 22.
   - **SSH User/Key**: Credentials for the SSH connection.
   - **Jump Hosts**: If you need to pass through a bastion host, enter it in `user@host:port` format. Multiple jump hosts can be comma-separated.
   - **Local Forwarder**: Choose `TCP` (default) or `Unix` depending on your OS and needs.

### Navigating

- **Sidebar**: Displays the list of available databases on the connected server.
  - Click a **Database** name to switch context to that DB.
  - Click a **Table** name (under the active DB) to open it in the main view.
- **Main View**: Shows the data of the selected table.
  - Complex types like `OvsMap` and `OvsSet` are rendered interactively.
  - Use tabs to switch between open tables.

## License

[MIT](LICENSE)
