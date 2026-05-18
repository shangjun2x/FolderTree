const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC: Open folder dialog
ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// IPC: Read directory tree
ipcMain.handle('read-dir', async (event, dirPath) => {
  try {
    return buildTree(dirPath);
  } catch (err) {
    return { error: err.message };
  }
});

// IPC: Read file content
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 20 * 1024 * 1024) {
      return { error: 'File too large to preview (>20MB)' };
    }

    const ext = path.extname(filePath).toLowerCase();

    // Office documents
    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.convertToHtml({ path: filePath });
      return { content: result.value, path: filePath, size: stat.size, type: 'docx' };
    }

    if (ext === '.xlsx' || ext === '.xls') {
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(filePath);
      const sheets = {};
      for (const name of workbook.SheetNames) {
        sheets[name] = XLSX.utils.sheet_to_html(workbook.Sheets[name]);
      }
      return { content: JSON.stringify(sheets), path: filePath, size: stat.size, type: 'xlsx' };
    }

    if (ext === '.pptx') {
      const XLSX = require('xlsx');
      // Use ZIP to extract slide text from pptx
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      const slides = [];
      const entries = zip.getEntries();
      entries.sort((a, b) => a.entryName.localeCompare(b.entryName));
      for (const entry of entries) {
        if (entry.entryName.match(/ppt\/slides\/slide\d+\.xml$/)) {
          const xml = entry.getData().toString('utf-8');
          // Extract text content from XML
          const texts = xml.match(/<a:t>(.*?)<\/a:t>/g);
          if (texts) {
            const slideText = texts.map(t => t.replace(/<\/?a:t>/g, '')).join(' ');
            slides.push(slideText);
          }
        }
      }
      return { content: JSON.stringify(slides), path: filePath, size: stat.size, type: 'pptx' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, path: filePath, size: stat.size };
  } catch (err) {
    return { error: err.message };
  }
});

function buildTree(dirPath, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result = [];

  // Sort: folders first, then files, alphabetical
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    // Skip hidden files/folders
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);
    const node = {
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory()
    };

    if (entry.isDirectory()) {
      node.children = buildTree(fullPath, depth + 1, maxDepth);
    }

    result.push(node);
  }

  return result;
}
