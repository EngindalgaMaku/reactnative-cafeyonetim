// This is a mock for the WebSocket server functionality
// In React Native, we typically don't need the server part
// This file prevents errors when ws tries to use Node server modules

class WebSocketServer {
  constructor() {
    console.warn('WebSocketServer is mocked in React Native');
    this.clients = new Set();
  }
  
  on() {
    return this;
  }
  
  close() {
    return this;
  }

  handleUpgrade(request, socket, head, callback) {
    try {
      if (typeof callback === 'function') {
        // Create a mock WebSocket client
        const mockWebSocket = {
          on: () => {},
          ping: () => {},
          pong: () => {},
          send: () => {},
          close: () => {}
        };
        
        // Call the callback with the mock client
        callback(mockWebSocket);
        this.clients.add(mockWebSocket);
      }
    } catch (error) {
      console.error('Error in mock handleUpgrade:', error);
    }

    // Prevent socket hang up
    if (socket && typeof socket.end === 'function') {
      socket.end();
    }
  }
}

module.exports = WebSocketServer; 