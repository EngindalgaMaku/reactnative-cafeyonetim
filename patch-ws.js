const fs = require('fs');
const path = require('path');

// Paths to the WebSocket files
const wsServerPath = path.join(__dirname, 'node_modules', 'ws', 'lib', 'websocket-server.js');
const wsPath = path.join(__dirname, 'node_modules', 'ws', 'lib', 'websocket.js');
const wsSenderPath = path.join(__dirname, 'node_modules', 'ws', 'lib', 'sender.js');
const wsPermessageDeflatePath = path.join(__dirname, 'node_modules', 'ws', 'lib', 'permessage-deflate.js');

// Create node_modules/crypto if it doesn't exist
const cryptoModulePath = path.join(__dirname, 'node_modules', 'crypto');
if (!fs.existsSync(cryptoModulePath)) {
  try {
    fs.mkdirSync(cryptoModulePath, { recursive: true });
    fs.writeFileSync(
      path.join(cryptoModulePath, 'package.json'),
      JSON.stringify({ name: 'crypto', main: '../../crypto-mock.js' }, null, 2)
    );
    console.log('Created crypto module redirect');
  } catch (error) {
    console.error('Failed to create crypto module redirect:', error);
  }
}

// Create node_modules/zlib if it doesn't exist
const zlibModulePath = path.join(__dirname, 'node_modules', 'zlib');
if (!fs.existsSync(zlibModulePath)) {
  try {
    fs.mkdirSync(zlibModulePath, { recursive: true });
    fs.writeFileSync(
      path.join(zlibModulePath, 'package.json'),
      JSON.stringify({ name: 'zlib', main: '../../zlib-mock.js' }, null, 2)
    );
    console.log('Created zlib module redirect');
  } catch (error) {
    console.error('Failed to create zlib module redirect:', error);
  }
}

// Check if the server file exists
if (fs.existsSync(wsServerPath)) {
  try {
    // Replace the content with our mock
    fs.writeFileSync(
      wsServerPath,
      `
// This is a patched version for React Native
const WebSocketServer = require('${path.relative(path.dirname(wsServerPath), path.join(__dirname, 'ws-server-mock.js')).replace(/\\/g, '/')}');
module.exports = WebSocketServer;
      `
    );
    console.log('Successfully patched ws/lib/websocket-server.js');
  } catch (error) {
    console.error('Failed to patch WebSocket server:', error);
  }
} else {
  console.error('WebSocket server file not found at:', wsServerPath);
}

// Check if the client file exists
if (fs.existsSync(wsPath)) {
  try {
    // Create a backup if it doesn't exist
    const backupPath = `${wsPath}.backup`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(wsPath, backupPath);
      console.log('Created backup of websocket.js');
    }

    // Replace the content with our mock
    fs.writeFileSync(
      wsPath,
      `
// This is a patched version for React Native
const WebSocket = require('${path.relative(path.dirname(wsPath), path.join(__dirname, 'ws-client-mock.js')).replace(/\\/g, '/')}');
module.exports = WebSocket;
      `
    );
    console.log('Successfully patched ws/lib/websocket.js');
  } catch (error) {
    console.error('Failed to patch WebSocket client:', error);
  }
} else {
  console.error('WebSocket client file not found at:', wsPath);
}

// Check if the sender file exists
if (fs.existsSync(wsSenderPath)) {
  try {
    // Create a backup if it doesn't exist
    const backupPath = `${wsSenderPath}.backup`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(wsSenderPath, backupPath);
      console.log('Created backup of sender.js');
    }

    // Replace the content with our mock
    fs.writeFileSync(
      wsSenderPath,
      `
// This is a patched version for React Native
const Sender = require('${path.relative(path.dirname(wsSenderPath), path.join(__dirname, 'ws-sender-mock.js')).replace(/\\/g, '/')}');
module.exports = Sender;
      `
    );
    console.log('Successfully patched ws/lib/sender.js');
  } catch (error) {
    console.error('Failed to patch WebSocket sender:', error);
  }
} else {
  console.error('WebSocket sender file not found at:', wsSenderPath);
}

// Check if the permessage-deflate file exists
if (fs.existsSync(wsPermessageDeflatePath)) {
  try {
    // Create a backup if it doesn't exist
    const backupPath = `${wsPermessageDeflatePath}.backup`;
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(wsPermessageDeflatePath, backupPath);
      console.log('Created backup of permessage-deflate.js');
    }

    // Replace the content with our mock
    fs.writeFileSync(
      wsPermessageDeflatePath,
      `
// This is a patched version for React Native
const PerMessageDeflate = require('${path.relative(path.dirname(wsPermessageDeflatePath), path.join(__dirname, 'ws-permessage-deflate-mock.js')).replace(/\\/g, '/')}');
module.exports = PerMessageDeflate;
      `
    );
    console.log('Successfully patched ws/lib/permessage-deflate.js');
  } catch (error) {
    console.error('Failed to patch WebSocket permessage-deflate:', error);
  }
} else {
  console.error('WebSocket permessage-deflate file not found at:', wsPermessageDeflatePath);
} 