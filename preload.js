const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  getLastFolder: () => store.get('lastFolder'),
  setLastFolder: (path) => store.set('lastFolder', path),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  refreshFolder: () => ipcRenderer.invoke('refreshFolder'),
  compile: (options) => ipcRenderer.invoke('compile', options)

});

