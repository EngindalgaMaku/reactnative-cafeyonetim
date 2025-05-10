// Mock for WebSocket Sender
const crypto = require('./crypto-mock');

class Sender {
  constructor(socket, extensions) {
    this._socket = socket;
    this._extensions = extensions || {};
    this._firstFragment = true;
    this._compress = false;
    this._bufferedBytes = 0;
    this._deflating = false;
    this._queue = [];
  }

  // Methods used by ws
  ping(data, mask, cb) {
    if (typeof cb === 'function') setTimeout(cb, 0);
    return true;
  }

  pong(data, mask, cb) {
    if (typeof cb === 'function') setTimeout(cb, 0);
    return true;
  }

  send(data, options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    if (typeof cb === 'function') setTimeout(cb, 0);
    return true;
  }

  close(code, data, mask, cb) {
    if (typeof code === 'function') {
      cb = code;
      code = 1000;
    } else if (typeof data === 'function') {
      cb = data;
      data = '';
    } else if (typeof mask === 'function') {
      cb = mask;
      mask = true;
    }

    if (typeof cb === 'function') setTimeout(cb, 0);
    return true;
  }

  // Utility methods
  static frame(data, options) {
    const length = data.length;
    let offset = 2 + (length > 65535 ? 8 : length > 125 ? 4 : 0);
    const buffer = Buffer.allocUnsafe(offset + length);

    // Simulate masking key using crypto mock
    const mask = options.mask && crypto.randomBytes(4);
    if (mask) {
      buffer[1] = 0x80 | length;
      mask.copy(buffer, offset - 4);
    } else {
      buffer[1] = length;
    }

    if (data instanceof Buffer) {
      data.copy(buffer, offset);
    } else {
      buffer.write(data, offset);
    }

    return buffer;
  }
}

module.exports = Sender; 