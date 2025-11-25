package ovsdb

import (
	"context"
	"fmt"
	"io"
	"math/rand"
	"net"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// Tunnel represents an active SSH tunnel
type Tunnel struct {
	LocalEndpoint string
	Stop          func()
}

// ConnectionConfig holds the configuration for SSH connection
type ConnectionConfig struct {
	Host               string
	Port               int
	User               string
	KeyFile            string
	JumpHosts          []string // list of jump hosts in format "user@host:port"
	LocalForwarderType string   // "tcp", "unix", or "auto" (default: "auto")
}

// EstablishTunnel establishes an SSH tunnel to the remote OVSDB endpoint and returns a Tunnel struct
// that the OVSDB client can connect to. Supports TCP and Unix domain socket endpoints, and proxy jumps.
func EstablishTunnel(config ConnectionConfig, remoteEndpoint string) (*Tunnel, error) {
	client, err := config.dialSSH(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to establish SSH connection: %w", err)
	}

	forwarderType := config.LocalForwarderType
	if forwarderType == "" {
		forwarderType = "auto"
	}

	var remoteAddr string
	if strings.HasPrefix(remoteEndpoint, "tcp:") {
		remoteAddr = strings.TrimPrefix(remoteEndpoint, "tcp:")
	} else if strings.HasPrefix(remoteEndpoint, "unix:") {
		remoteAddr = strings.TrimPrefix(remoteEndpoint, "unix:")
	} else {
		return nil, fmt.Errorf("unsupported endpoint type: %s", remoteEndpoint)
	}

	if forwarderType == "tcp" {
		return establishTCPTunnel(client, remoteAddr, remoteEndpoint)
	} else if forwarderType == "unix" {
		return establishUnixTunnel(client, remoteAddr, remoteEndpoint)
	} else if forwarderType == "auto" {
		if runtime.GOOS == "windows" {
			return establishTCPTunnel(client, remoteAddr, remoteEndpoint)
		} else {
			if strings.HasPrefix(remoteEndpoint, "tcp:") {
				return establishTCPTunnel(client, remoteAddr, remoteEndpoint)
			} else {
				return establishUnixTunnel(client, remoteAddr, remoteEndpoint)
			}
		}
	}
	return nil, fmt.Errorf("unsupported forwarder type: %s", forwarderType)
}

// dialSSH establishes an SSH client connection, supporting chained proxy jumps
func (c *ConnectionConfig) dialSSH(ctx context.Context) (*ssh.Client, error) {
	key, err := loadPrivateKey(c.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load private key: %w", err)
	}

	var client *ssh.Client
	for _, jump := range c.JumpHosts {
		jumpUser, jumpHost, jumpPort := parseJumpHost(jump)
		addr := fmt.Sprintf("%s:%d", jumpHost, jumpPort)
		config := &ssh.ClientConfig{
			User: jumpUser,
			Auth: []ssh.AuthMethod{
				ssh.PublicKeys(key),
			},
			HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO: Use known_hosts for security
			Timeout:         10 * time.Second,
		}
		if client == nil {
			client, err = ssh.Dial("tcp", addr, config)
		} else {
			conn, err := client.Dial("tcp", addr)
			if err != nil {
				return nil, fmt.Errorf("failed to dial jump host %s: %w", jump, err)
			}
			clientConn, chans, reqs, err := ssh.NewClientConn(conn, addr, config)
			if err != nil {
				return nil, fmt.Errorf("failed to create client conn to jump host %s: %w", jump, err)
			}
			client = ssh.NewClient(clientConn, chans, reqs)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to connect to jump host %s: %w", jump, err)
		}
	}

	// Connect to final target
	addr := fmt.Sprintf("%s:%d", c.Host, c.Port)
	config := &ssh.ClientConfig{
		User: c.User,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeys(key),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO: Use known_hosts for security
		Timeout:         10 * time.Second,
	}
	if client == nil {
		client, err = ssh.Dial("tcp", addr, config)
	} else {
		conn, err := client.Dial("tcp", addr)
		if err != nil {
			return nil, fmt.Errorf("failed to dial target %s: %w", addr, err)
		}
		clientConn, chans, reqs, err := ssh.NewClientConn(conn, addr, config)
		if err != nil {
			return nil, fmt.Errorf("failed to create client conn to target %s: %w", addr, err)
		}
		client = ssh.NewClient(clientConn, chans, reqs)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to connect to target: %w", err)
	}
	return client, nil
}

// establishTCPTunnel sets up a local TCP listener and forwards traffic to the remote endpoint via SSH
func establishTCPTunnel(client *ssh.Client, remoteAddr string, remoteEndpoint string) (*Tunnel, error) {
	localListener, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return nil, fmt.Errorf("failed to listen on local TCP: %w", err)
	}

	go func() {
		defer localListener.Close()
		for {
			localConn, err := localListener.Accept()
			if err != nil {
				return
			}
			var remoteConn net.Conn
			if strings.HasPrefix(remoteEndpoint, "tcp:") {
				remoteConn, err = client.Dial("tcp", remoteAddr)
			} else {
				remoteConn, err = client.Dial("unix", remoteAddr)
			}
			if err != nil {
				localConn.Close()
				continue
			}
			go func() {
				defer localConn.Close()
				defer remoteConn.Close()
				io.Copy(localConn, remoteConn)
			}()
			go func() {
				defer localConn.Close()
				defer remoteConn.Close()
				io.Copy(remoteConn, localConn)
			}()
		}
	}()

	return &Tunnel{
		LocalEndpoint: "tcp:" + localListener.Addr().String(),
		Stop:          func() { localListener.Close() },
	}, nil
}

// establishUnixTunnel sets up a local Unix domain socket listener and forwards traffic to the remote endpoint via SSH
func establishUnixTunnel(client *ssh.Client, remoteAddr string, remoteEndpoint string) (*Tunnel, error) {
	localPath := fmt.Sprintf("/tmp/ovsdb-tunnel-%d.sock", rand.Int63())
	localListener, err := net.Listen("unix", localPath)
	if err != nil {
		return nil, fmt.Errorf("failed to listen on local Unix socket: %w", err)
	}

	go func() {
		defer localListener.Close()
		defer os.Remove(localPath) // Clean up socket file
		for {
			localConn, err := localListener.Accept()
			if err != nil {
				return
			}
			var remoteConn net.Conn
			if strings.HasPrefix(remoteEndpoint, "tcp:") {
				remoteConn, err = client.Dial("tcp", remoteAddr)
			} else {
				remoteConn, err = client.Dial("unix", remoteAddr)
			}
			if err != nil {
				localConn.Close()
				continue
			}
			go func() {
				defer localConn.Close()
				defer remoteConn.Close()
				io.Copy(localConn, remoteConn)
			}()
			go func() {
				defer localConn.Close()
				defer remoteConn.Close()
				io.Copy(remoteConn, localConn)
			}()
		}
	}()

	return &Tunnel{
		LocalEndpoint: "unix:" + localPath,
		Stop: func() {
			localListener.Close()
			os.Remove(localPath)
		},
	}, nil
}

// loadPrivateKey loads an SSH private key from file
func loadPrivateKey(file string) (ssh.Signer, error) {
	b, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	return ssh.ParsePrivateKey(b)
}

// parseJumpHost parses a jump host string in format "user@host:port" or "host:port" or "host"
func parseJumpHost(s string) (user, host string, port int) {
	parts := strings.Split(s, "@")
	if len(parts) == 2 {
		user = parts[0]
		s = parts[1]
	}
	hostPort := strings.Split(s, ":")
	host = hostPort[0]
	if len(hostPort) == 2 {
		if p, err := strconv.Atoi(hostPort[1]); err == nil {
			port = p
		}
	}
	if port == 0 {
		port = 22 // default SSH port
	}
	return
}
