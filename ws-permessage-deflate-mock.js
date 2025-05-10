// Mock for the permessage-deflate module in ws
// This disables compression but keeps the interface

class PerMessageDeflate {
  constructor(options) {
    this._options = options || {};
    this._threshold = this._options.threshold !== undefined ? this._options.threshold : 1024;
    this._isServer = !!this._options.isServer;
    this._deflateOptions = {
      flush: 2, // Z_SYNC_FLUSH
      finishFlush: 2, // Z_SYNC_FLUSH
      level: this._options.level || 1
    };
    this._inflateOptions = {
      flush: 2, // Z_SYNC_FLUSH
      finishFlush: 2 // Z_SYNC_FLUSH
    };
    this._maxPayload = this._options.maxPayload || 0;
    this._active = true;
  }

  static get extensionName() {
    return 'permessage-deflate';
  }

  offer() {
    return {};
  }

  accept() {
    return {};
  }

  cleanup() {
    this._active = false;
  }

  compress(data, fin, callback) {
    // Just pass through data without compression
    setTimeout(() => {
      callback(null, data);
    }, 0);
  }

  decompress(data, fin, callback) {
    // Just pass through data without decompression
    setTimeout(() => {
      callback(null, data);
    }, 0);
  }
}

module.exports = PerMessageDeflate; 