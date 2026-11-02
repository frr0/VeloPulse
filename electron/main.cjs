const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const path = require('path');

// Intervals.icu API host. Only requests to this host are touched by the CORS rules below.
const INTERVALS_URL_FILTER = { urls: ['https://intervals.icu/*'] };

// Enable Web Bluetooth and experimental web platform features
app.commandLine.appendSwitch('enable-web-bluetooth', 'true');
app.commandLine.appendSwitch('enable-experimental-web-platform-features', 'true');

let mainWindow = null;
let bluetoothTimer = null;
let discoveredDevices = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#131316',
    title: 'VeloPulse | Indoor Cycling Studio & Intervals Analytics',
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Remove default menu bar for clean sleek HUD experience (press Alt to show if needed)
  mainWindow.setMenuBarVisibility(false);

  // Report load, renderer and console failures in the main process log, so a blank
  // window always leaves a trace with the failing address and error code.
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error(
      `[velopulse] load failed: code=${errorCode} description=${errorDescription} url=${validatedURL} mainFrame=${isMainFrame}`
    );
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(
      `[velopulse] renderer process gone: reason=${details.reason} exitCode=${details.exitCode}`
    );
  });

  // Electron >= 35 passes a details object; older versions pass positional arguments.
  mainWindow.webContents.on('console-message', (...args) => {
    const details = typeof args[1] === 'object' && args[1] !== null ? args[1] : null;
    const level = details ? details.level : args[1];
    const message = details ? details.message : args[2];
    const source = details ? details.sourceId : args[4];
    const line = details ? details.lineNumber : args[3];

    if (level === 'error' || level === 3) {
      console.error(`[velopulse] renderer error: ${message} (${source}:${line})`);
    }
  });

  // Developer tools only when explicitly asked for, never by default.
  if (process.env.VELOPULSE_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Load the built Vite React app
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath).catch((error) => {
    console.error(`[velopulse] cannot load ${indexPath}: ${error && error.message ? error.message : error}`);
  });

  // Web Bluetooth Device Selection
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();

    deviceList.forEach((d) => {
      if (d.deviceName && d.deviceName.trim().length > 0) {
        discoveredDevices.set(d.deviceId, d);
      }
    });

    if (bluetoothTimer) {
      clearTimeout(bluetoothTimer);
    }

    // Give 1.2s to discover nearby sensors
    bluetoothTimer = setTimeout(async () => {
      const list = Array.from(discoveredDevices.values());
      discoveredDevices.clear();

      if (list.length === 0) {
        callback('');
        return;
      }

      if (list.length === 1) {
        callback(list[0].deviceId);
        return;
      }

      // If multiple sensors found, let user pick
      const buttons = list.map((d) => d.deviceName);
      buttons.push('Cancel');

      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons,
        defaultId: 0,
        cancelId: buttons.length - 1,
        title: 'Bluetooth Sensor Pairing',
        message: 'Select which Bluetooth device to connect:',
      });

      if (response < list.length) {
        callback(list[response].deviceId);
      } else {
        callback('');
      }
    }, 1200);
  });

  // Automatically confirm pairing if required by trainer
  if (mainWindow.webContents.session.setBluetoothPairingHandler) {
    mainWindow.webContents.session.setBluetoothPairingHandler((details, callback) => {
      callback({ response: 'confirm' });
    });
  }

  // Handle downloads (FIT files, workouts) saving directly to Downloads directory
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const downloadsFolder = app.getPath('downloads');
    const savePath = path.join(downloadsFolder, item.getFilename());
    item.setSavePath(savePath);

    item.once('done', (_event, state) => {
      if (state === 'completed') {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'File .FIT Salvato',
          message: `File salvato con successo in Downloads:\n${savePath}`,
          buttons: ['OK'],
        });
      }
    });
  });

  // Keyboard shortcut F11 for fullscreen
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// The packaged app is served from file://, so its origin is "null" and the browser
// drops every Intervals.icu response for failing the CORS check. These two handlers
// relax the check for that single host, leaving every other request untouched.
function configureIntervalsCors() {
  const webRequest = session.defaultSession.webRequest;

  webRequest.onBeforeSendHeaders(INTERVALS_URL_FILTER, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders };

    // A "null" origin is refused by many servers: present the request as same-origin.
    if (!requestHeaders.Origin || requestHeaders.Origin === 'null') {
      requestHeaders.Origin = 'https://intervals.icu';
    }

    callback({ requestHeaders });
  });

  webRequest.onHeadersReceived(INTERVALS_URL_FILTER, (details, callback) => {
    const responseHeaders = {};

    // Drop any CORS header already present: duplicated values break the check.
    for (const [name, value] of Object.entries(details.responseHeaders || {})) {
      if (!name.toLowerCase().startsWith('access-control-')) {
        responseHeaders[name] = value;
      }
    }

    // The app sends no cookies, so the wildcard origin is accepted here.
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
    responseHeaders['Access-Control-Allow-Headers'] = ['Authorization, Accept, Content-Type'];
    responseHeaders['Access-Control-Expose-Headers'] = ['Content-Disposition'];
    responseHeaders['Access-Control-Max-Age'] = ['600'];

    // The Authorization header makes the browser send a preflight request. If the
    // server answers it with an error status, the real request never leaves.
    if (details.method === 'OPTIONS' && details.statusCode >= 400) {
      callback({ responseHeaders, statusLine: 'HTTP/1.1 200 OK' });
      return;
    }

    callback({ responseHeaders });
  });
}

app.whenReady().then(() => {
  configureIntervalsCors();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
