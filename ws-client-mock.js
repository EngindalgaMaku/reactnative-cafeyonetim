// Mock for the WebSocket client class
class WebSocket {
  constructor() {
    this.readyState = 0; // CONNECTING
    
    // Automatically set to OPEN state after construction
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (typeof this.onopen === 'function') {
        this.onopen({ target: this });
      }
    }, 0);
  }

  // Constants
  static get CONNECTING() { return 0; }
  static get OPEN() { return 1; }
  static get CLOSING() { return 2; }
  static get CLOSED() { return 3; }

  // Methods
  send() {}
  close() {
    this.readyState = 3; // CLOSED
    if (typeof this.onclose === 'function') {
      this.onclose({ target: this, code: 1000, reason: 'Normal closure' });
    }
  }

  // Event handlers
  onopen = null;
  onclose = null;
  onmessage = null;
  onerror = null;
  
  // Helper to simulate receiving a message
  mockReceiveMessage(data) {
    if (this.readyState === 1 && typeof this.onmessage === 'function') {
      this.onmessage({ target: this, data });
    }
  }
  
  // Helper to simulate an error
  mockError(error) {
    if (typeof this.onerror === 'function') {
      this.onerror({ target: this, error });
    }
  }
}

module.exports = WebSocket; 