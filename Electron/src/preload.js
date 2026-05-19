const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  moveItem: (sourcePath, destFolder) => ipcRenderer.invoke('move-item', sourcePath, destFolder),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
