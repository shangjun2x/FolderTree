const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  moveItem: (sourcePath, destFolder) => ipcRenderer.invoke('move-item', sourcePath, destFolder),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getPreviewSettings: () => ipcRenderer.invoke('get-preview-settings'),
  setPreviewSettings: (settings) => ipcRenderer.invoke('set-preview-settings', settings),
  resetPreviewWhitelist: () => ipcRenderer.invoke('reset-preview-whitelist')
});
