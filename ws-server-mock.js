// A more comprehensive WebSocket Server mock for Expo
const EventEmitter = require('events');

class Server extends EventEmitter {
  constructor(options) {
    super();
    this.clients = new Set();
    this.options = options || {};
    console.warn('WebSocket Server is mocked in React Native');
  }

  handleUpgrade(request, socket, head, callback) {
    try {
      if (typeof callback === 'function') {
        // Create a mock WebSocket client
        const mockWebSocket = {
          on: (event, listener) => {
            if (!this._events) this._events = {};
            if (!this._events[event]) this._events[event] = [];
            this._events[event].push(listener);
            return this;
          },
          removeListener: (event, listener) => {
            return this;
          },
          ping: () => {},
          pong: () => {},
          send: (data) => {
            // Mock sending data
            if (this._events && this._events.message) {
              this._events.message.forEach(listener => {
                try {
                  listener(data);
                } catch (e) {
                  console.error('Error in WebSocket message listener:', e);
                }
              });
            }
          },
          close: (code, reason) => {
            // Mock closing connection
            if (this._events && this._events.close) {
              this._events.close.forEach(listener => {
                try {
                  listener(code, reason);
                } catch (e) {
                  console.error('Error in WebSocket close listener:', e);
                }
              });
            }
            this.clients.delete(mockWebSocket);
          },
          terminate: () => {
            this.clients.delete(mockWebSocket);
          },
          // Properties
          readyState: 1, // OPEN
          protocol: '',
          protocolVersion: 13,
          url: 'ws://localhost:8080',
        };
        
        // Call the callback with the mock client
        callback(mockWebSocket);
        this.clients.add(mockWebSocket);
        
        // Emit a connection event
        this.emit('connection', mockWebSocket, request);
      }
    } catch (error) {
      console.error('Error in mock handleUpgrade:', error);
    }

    // Prevent socket hang up
    if (socket && typeof socket.end === 'function') {
      socket.end();
    }
  }

  close(callback) {
    // Clear clients
    this.clients.clear();
    
    // Call callback if provided
    if (typeof callback === 'function') {
      callback();
    }
  }

  // Broadcast to all clients
  broadcast(data) {
    for (const client of this.clients) {
      if (client.readyState === 1) { // OPEN
        client.send(data);
      }
    }
  }
}

module.exports = Server; 