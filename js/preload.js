const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  runCommand: (command) => {
    // Implementação de execução de comando
    return new Promise((resolve, reject) => {
      try {
        // Lógica para executar comando
        resolve(`Comando executado: ${command}`);
      } catch (error) {
        reject(error);
      }
    });
  },
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  getLastFolder: () => store.get('lastFolder'),
  setLastFolder: (path) => store.set('lastFolder', path),
  refreshFolder: () => ipcRenderer.invoke('refreshFolder'),
  compile: (options) => ipcRenderer.invoke('compile', options),
  openExternal: (url) => ipcRenderer.invoke('open-external', url), // Calls ipcMain in main.js
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  createProcessorProject: (formData) => ipcRenderer.invoke('create-processor-project', formData),
  selectDirectory: async () => {
    return await ipcRenderer.invoke('dialog:openDirectory');
  },
  createProjectStructure: async (projectPath, spfPath) => {
    ipcRenderer.invoke('project:createStructure', projectPath, spfPath);
  },
  getFolderFiles: (folderPath) => ipcRenderer.invoke('getFolderFiles', folderPath),  // Expondo a função aqui

  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  startDownload: () => ipcRenderer.send('start-download'),
  installUpdate: () => ipcRenderer.send('install-update'),

  openExe: () => ipcRenderer.invoke('open-exe')
});

