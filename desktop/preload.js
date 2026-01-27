const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  onStateUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('state-update', handler);
    // Return cleanup function to prevent memory leaks
    return () => ipcRenderer.removeListener('state-update', handler);
  },
  getVersion: () => ipcRenderer.invoke('get-version')
});
