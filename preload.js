const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  getLastFolder: () => store.get('lastFolder'),
  setLastFolder: (path) => store.set('lastFolder', path),
  refreshFolder: () => ipcRenderer.invoke('refreshFolder'),
  compile: (options) => ipcRenderer.invoke('compile', options),
  openExternal: (url) => ipcRenderer.invoke('open-external', url), // Calls ipcMain in main.js
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  createProcessorProject: (formData) => ipcRenderer.invoke('create-processor-project', formData)
});
