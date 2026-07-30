const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Character/state registries (single sources: src/shared/data/
  // characters.json and states.json), fetched from the main process — the
  // sandboxed preload can't require arbitrary files itself.
  getCharacterRegistry: () => ipcRenderer.invoke('get-character-registry'),
  getStateRegistry: () => ipcRenderer.invoke('get-state-registry'),
  getRenderMode: () => ipcRenderer.invoke('get-render-mode'),
  getDisplayOptions: () => ipcRenderer.invoke('get-display-options'),
  onDisplayOptions: (callback) => {
    const handler = (_event, options) => {
      try {
        callback(options);
      } catch (error) {
        console.error('Display options callback error:', error);
      }
    };
    ipcRenderer.on('display-options', handler);
    return () => ipcRenderer.removeListener('display-options', handler);
  },
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  focusTerminal: () => ipcRenderer.invoke('focus-terminal'),
  onStateUpdate: (callback) => {
    const handler = (_event, data) => {
      try {
        callback(data);
      } catch (error) {
        console.error('State update callback error:', error);
      }
    };
    ipcRenderer.on('state-update', handler);
    // Return cleanup function to prevent memory leaks
    return () => ipcRenderer.removeListener('state-update', handler);
  },
  beginWindowDrag: () => ipcRenderer.send('window-drag-start'),
  moveWindowDrag: () => ipcRenderer.send('window-drag-move'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getPlatform: () => process.platform
});
