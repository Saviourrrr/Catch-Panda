const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  //detective sends to main
  activateDetectiveMode: () => ipcRenderer.send('activate-detective-mode'),
  captureRegion: (data)  => ipcRenderer.send('capture-region', data),
  cancelOverlay: ()      => ipcRenderer.send('cancel-overlay'),

  //keybind requests and sends
  getKeybind:  ()        => ipcRenderer.invoke('get-keybind'),
  setKeybind:  (key)     => ipcRenderer.send('set-keybind', key),

  //API
  getKeys:           ()               => ipcRenderer.invoke('get-keys'),
  setHiveKey:        (key)            => ipcRenderer.send('set-hive-key', key),
  setCopyleaksKeys:  (key, email)     => ipcRenderer.send('set-copyleaks-keys', { key, email }),

  //detection
  runDetection: (imageData) => ipcRenderer.invoke('run-detection', imageData),

  
  onStartProcessing:    (cb) => ipcRenderer.on('start-processing',    (_e, data) => cb(data)),
  onDetectiveCancelled: (cb) => ipcRenderer.on('detective-cancelled', ()         => cb()),

});