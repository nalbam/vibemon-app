/**
 * WebSocket client for Vibe Monitor
 * Connects to a central server to receive real-time status updates
 */

const WebSocket = require('ws');
const { WS_URL, WS_TOKEN } = require('../shared/config.cjs');

// Reconnection configuration
const RECONNECT_INITIAL_DELAY = 5000;   // 5 seconds
const RECONNECT_MAX_DELAY = 30000;      // 30 seconds
const RECONNECT_MULTIPLIER = 1.5;

class WsClient {
  constructor() {
    this.ws = null;
    this.url = WS_URL;
    this.token = WS_TOKEN;
    this.reconnectDelay = RECONNECT_INITIAL_DELAY;
    this.reconnectTimer = null;
    this.isConnecting = false;
    this.isConnected = false;
    this.shouldReconnect = true;

    // Callbacks
    this.onStatusUpdate = null;  // Called when status message received
    this.onConnectionChange = null;  // Called when connection state changes
  }

  /**
   * Check if WebSocket is configured
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.url);
  }

  /**
   * Get connection status
   * @returns {string} 'connected', 'connecting', 'disconnected', or 'not-configured'
   */
  getStatus() {
    if (!this.isConfigured()) {
      return 'not-configured';
    }
    if (this.isConnected) {
      return 'connected';
    }
    if (this.isConnecting) {
      return 'connecting';
    }
    return 'disconnected';
  }

  /**
   * Start WebSocket connection
   */
  connect() {
    if (!this.isConfigured()) {
      console.log('WebSocket not configured (VIBEMON_WS_URL not set)');
      return;
    }

    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;
    this.notifyConnectionChange();

    console.log(`WebSocket connecting to ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.isConnected = true;
        this.reconnectDelay = RECONNECT_INITIAL_DELAY;
        this.notifyConnectionChange();

        // Send authentication message if token is configured
        if (this.token) {
          this.sendAuth();
        }
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`WebSocket closed: ${code} ${reason}`);
        this.handleDisconnect();
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        // Error will be followed by close event
      });
    } catch (error) {
      console.error('WebSocket connection error:', error.message);
      this.handleDisconnect();
    }
  }

  /**
   * Send authentication message
   */
  sendAuth() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const authMessage = JSON.stringify({
      type: 'auth',
      token: this.token
    });

    this.ws.send(authMessage);
    console.log('WebSocket auth sent');
  }

  /**
   * Handle incoming message
   * @param {Buffer|string} data
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());

      // Handle error messages from server
      if (message.type === 'error') {
        console.error('WebSocket server error:', message.message);
        return;
      }

      // Handle auth success
      if (message.type === 'auth' && message.success) {
        console.log('WebSocket auth successful');
        return;
      }

      // Handle status update (existing format)
      if (message.state) {
        if (this.onStatusUpdate) {
          this.onStatusUpdate(message);
        }
      }
    } catch (error) {
      console.error('WebSocket message parse error:', error.message);
    }
  }

  /**
   * Handle disconnection and schedule reconnect
   */
  handleDisconnect() {
    this.isConnecting = false;
    this.isConnected = false;
    this.ws = null;
    this.notifyConnectionChange();

    if (this.shouldReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    console.log(`WebSocket reconnecting in ${this.reconnectDelay / 1000}s...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // Increase delay for next attempt (exponential backoff)
    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_MULTIPLIER,
      RECONNECT_MAX_DELAY
    );
  }

  /**
   * Notify connection state change
   */
  notifyConnectionChange() {
    if (this.onConnectionChange) {
      this.onConnectionChange(this.getStatus());
    }
  }

  /**
   * Disconnect and stop reconnection
   */
  disconnect() {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnecting = false;
    this.isConnected = false;
    this.notifyConnectionChange();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.disconnect();
  }
}

module.exports = { WsClient };
