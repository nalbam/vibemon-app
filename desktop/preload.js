const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  onStateUpdate: (callback) => {
    ipcRenderer.on('state-update', (event, data) => callback(data));
  },
  getVersion: () => ipcRenderer.invoke('get-version')
});
