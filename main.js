const { app, BrowserWindow, ipcMain, globalShortcut, Notification, screen, desktopCapturer } = require('electron');
const path      = require('path');
const fs        = require('fs');
const Tesseract = require('tesseract.js');

const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    console.error('[Config] Error reading config:', err.message);
  }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Config] Error saving config:', err.message);
  }
}

let config = loadConfig();

let mainWindow;
let overlayWindow;
let currentKeybind = config.keybind || 'F10';

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: false,
    frame: false,
    title: 'Catch Panda',
    icon: path.join(__dirname, 'assets', 'panda-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), //bridge inbetween
      contextIsolation: true,   //security
      nodeIntegration: false,   //security
    },
  });
  mainWindow.loadFile('renderer/index.html');
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}



// ─── Transparent screenshot overlay window ────────────────────────────────────
function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width, height,
    x: 0, y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile('renderer/overlay.html');
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    //activation
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  //closure
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  //keybind shi
});

//--------- IPC Handlers ----------

ipcMain.on('activate-detective-mode', () => {
  if (!mainWindow) return;

  mainWindow.minimize(); //Pushes app to the background when detector mode activates

  new Notification({
    title: 'Catch Panda',
    body:  `Detective mode activated — press ${currentKeybind} to take a screenshot`,
    icon:  path.join(__dirname, 'assets', 'panda-logo.png'),
  }).show(); //Notif

  globalShortcut.register(currentKeybind, () => {
    globalShortcut.unregister(currentKeybind); //Instantly remove listener
    openOverlay();
  });
});
//global shortcut is a listener that stays outside app focus
//register is adding a listener that stays till ran

//asks preloader (that takes data from main) what the keybind is
ipcMain.handle('get-keybind', () => currentKeybind);

//preloader gives keybind
ipcMain.on('set-keybind', (_event, newKey) => {
  currentKeybind = newKey;
  config.keybind = newKey;
  saveConfig(config);
});

//overlay says ss selection is finished
ipcMain.on('capture-region', async (_event, region) => {

  if (overlayWindow) overlayWindow.hide();

  // Small pause so the overlay is fully gone before we screenshot
  await new Promise(r => setTimeout(r, 150));

  const { width, height } = screen.getPrimaryDisplay().size;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height },
  });

  if (!sources || sources.length === 0) {
    if (overlayWindow) overlayWindow.close();
    if (mainWindow) {
      mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('detective-cancelled');
    }
    return;
  }

  const cropped = sources[0].thumbnail.crop({
    x:      Math.round(region.x),
    y:      Math.round(region.y),
    width:  Math.round(region.width),
    height: Math.round(region.height),
  });

  const imageData = cropped.toDataURL(); // "data:image/png;base64,..."

  if (overlayWindow) overlayWindow.close();
  
  //tells the window to say “processing…”
  if (mainWindow) {
    mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send('start-processing', { ...region, imageData });
  }
});

//overlay says user cancelled the ss request
ipcMain.on('cancel-overlay', () => {
  if (overlayWindow) overlayWindow.close();
  if (mainWindow) {
    mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send('detective-cancelled');
  }
});


//API key handlers

ipcMain.handle('get-keys', () => ({
  hiveKey:        config.hiveKey || '',
  copyleaksKey:   config.copyleaksKey || '',
  copyleaksEmail: config.copyleaksEmail || '',
}));

ipcMain.on('set-hive-key', (_event, key) => {
  config.hiveKey = key.trim();
  saveConfig(config);
});

ipcMain.on('set-copyleaks-keys', (_event, { key, email }) => {
  config.copyleaksKey   = key.trim();
  config.copyleaksEmail = email.trim();
  saveConfig(config);
});

//-------- DETECTİON CODE ---------
ipcMain.handle('run-detection', async (_event, imageData) => {

  const hiveKey        = config.hiveKey || '';
  const copyleaksKey   = config.copyleaksKey || '';
  const copyleaksEmail = config.copyleaksEmail || '';

  //Tesseract extraction
  let extractedText = '';
  try {
    const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
      logger: () => {}, //silence progress logs
    });
    extractedText = text.trim();
    console.log('[Tesseract] Extracted text length:', extractedText.length);
  } catch (err) {
    console.error('[Tesseract] Error:', err.message);
  }

  const hasText = extractedText.length > 10; //chooses to send for img data by text lenght

  const [textScore, imageScore] = await Promise.all([
    runCopyleaks(extractedText, hasText, copyleaksKey, copyleaksEmail),
    runHive(imageData, hiveKey),
  ]);

  console.log('[Detection] Final scores — text:', textScore, '| image:', imageScore);
  return { textScore, imageScore };
});


//Copyleaks
async function runCopyleaks(text, hasText, key, email) {
  if (!hasText) return null;
  if (!key || !email) {
    console.log('[Copyleaks] No keys configured — skipping.');
    return 'no-key';
  }

  try {
    //authentication
    const loginRes = await fetch('https://id.copyleaks.com/v3/account/login/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, key }),
    });

    if (!loginRes.ok) {
      console.error('[Copyleaks] Login failed:', loginRes.status, await loginRes.text());
      return null;
    }

    const { access_token } = await loginRes.json();

    //send to detection
    const scanId    = `cp${Date.now()}`;
    const detectRes = await fetch(`https://api.copyleaks.com/v2/writer-detector/${scanId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!detectRes.ok) {
      console.error('[Copyleaks] Detect failed:', detectRes.status, await detectRes.text());
      return null;
    }

    const data = await detectRes.json();
    console.log('[Copyleaks] Response:', JSON.stringify(data).slice(0, 200));

    const aiScore = data.classification?.ai ?? data.summary?.ai ?? 0;
    return Math.round(aiScore * 100);

  } catch (err) {
    console.error('[Copyleaks] Error:', err.message);
    return null;
  }
}

//Hive
async function runHive(imageData, key) {
  if (!key) {
    console.log('[Hive] No key configured — skipping.');
    return 'no-key';
  }

  try {
    //strip url data header
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer  = Buffer.from(base64, 'base64');

    //fetch sets the content-Type + boundary automatically
    const formData = new FormData();
    const blob     = new Blob([buffer], { type: 'image/png' });
    formData.append('media', blob, 'screenshot.png');

    const hiveRes = await fetch('https://api.thehive.ai/api/v2/task/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${key}`,
      },
      body: formData,
    });

    const hiveText = await hiveRes.text();
    console.log('[Hive] Status:', hiveRes.status, '| Body:', hiveText.slice(0, 300));

    if (!hiveRes.ok) return 0;

    const data     = JSON.parse(hiveText);
    const classes  = data.output?.[0]?.classes ?? [];
    const yesEntry = classes.find(c => c.class === 'yes');
    return Math.round((yesEntry?.score ?? 0) * 100);

  } catch (err) {
    console.error('[Hive] Error:', err.message);
    return 0;
  }
}

function openOverlay() {
  if (!overlayWindow) createOverlayWindow();
}