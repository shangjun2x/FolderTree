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
      nodeIntegration: false,
      plugins: true
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

// IPC: Read directory (shallow - one level only for lazy loading)
ipcMain.handle('read-dir', async (event, dirPath) => {
  try {
    return buildTreeShallow(dirPath);
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
    if (ext === '.docx' || ext === '.doc') {
      try {
        const buffer = fs.readFileSync(filePath);
        const magic = buffer.slice(0, 4).toString('hex');

        if (magic === '504b0304') {
          // ZIP-based: true .docx format
          const mammoth = require('mammoth');
          const result = await mammoth.convertToHtml({ buffer: buffer });
          return { content: result.value, path: filePath, size: stat.size, type: 'docx' };
        } else if (magic === 'd0cf11e0') {
          // OLE2: old .doc binary format - use PowerShell/COM on Windows
          const { execSync } = require('child_process');
          const psScript = `
            $word = New-Object -ComObject Word.Application
            $word.Visible = $false
            $doc = $word.Documents.Open('${filePath.replace(/'/g, "''")}')
            $text = $doc.Content.Text
            $doc.Close($false)
            $word.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
            $text
          `.trim();
          try {
            const text = execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, 
              { encoding: 'utf-8', timeout: 30000 });
            const html = '<div style="font-family:sans-serif;line-height:1.8;white-space:pre-wrap;">' +
              text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</div>';
            return { content: html, path: filePath, size: stat.size, type: 'docx' };
          } catch (comErr) {
            return { error: 'Failed to parse old .doc format. Requires Microsoft Word installed.\n' + comErr.message };
          }
        } else {
          return { error: 'Unrecognized Word document format' };
        }
      } catch (e) {
        return { error: 'Failed to parse Word document: ' + e.message };
      }
    }

    if (ext === '.xlsx' || ext === '.xls') {
      try {
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(filePath);
        const sheets = {};
        for (const name of workbook.SheetNames) {
          sheets[name] = XLSX.utils.sheet_to_html(workbook.Sheets[name]);
        }
        return { content: JSON.stringify(sheets), path: filePath, size: stat.size, type: 'xlsx' };
      } catch (e) {
        return { error: 'Failed to parse Excel: ' + e.message };
      }
    }

    if (ext === '.pptx' || ext === '.ppt') {
      try {
        const { parseOffice } = require('officeparser');
        const text = await new Promise((resolve, reject) => {
          parseOffice(filePath, function(data, err) {
            if (err) reject(err);
            else resolve(data);
          });
        });
        const slides = text.split(/\n{2,}/).filter(s => s.trim());
        return { content: JSON.stringify(slides), path: filePath, size: stat.size, type: 'pptx' };
      } catch (e) {
        return { error: 'Failed to parse PowerPoint: ' + e.message };
      }
    }

    if (ext === '.pdf') {
      // Return file path for native PDF embedding (preserves page format)
      return { content: filePath, path: filePath, size: stat.size, type: 'pdf' };
    }

    // TIFF: convert to base64 PNG since Chromium doesn't support TIFF natively
    if (ext === '.tif' || ext === '.tiff') {
      try {
        const sharp = require('sharp');
        const pngBuffer = await sharp(filePath).png().toBuffer();
        const base64 = pngBuffer.toString('base64');
        return { content: `data:image/png;base64,${base64}`, path: filePath, size: stat.size, type: 'tiff' };
      } catch (e) {
        return { error: 'Failed to convert TIFF: ' + e.message };
      }
    }

    // Binary file check - skip reading as utf-8
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.zip', '.tar', '.gz', '.exe', '.dll'];
    if (binaryExts.includes(ext)) {
      return { content: '', path: filePath, size: stat.size, type: 'image' };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, path: filePath, size: stat.size };
  } catch (err) {
    return { error: err.message };
  }
});

// Build shallow tree (one level only)
function buildTreeShallow(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result = [];

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);
    const node = {
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory()
    };

    // Mark folders as having children (lazy load later)
    if (entry.isDirectory()) {
      node.hasChildren = true;
      node.children = null; // Will be loaded on expand
    }

    result.push(node);
  }

  return result;
}

// IPC: Move file or folder
ipcMain.handle('move-item', async (event, sourcePath, destFolder) => {
  try {
    const itemName = path.basename(sourcePath);
    const destPath = path.join(destFolder, itemName);
    
    // Check if destination already exists
    if (fs.existsSync(destPath)) {
      return { error: `"${itemName}" already exists in destination folder` };
    }
    
    // Check if trying to move folder into itself
    if (sourcePath === destFolder || destFolder.startsWith(sourcePath + path.sep)) {
      return { error: 'Cannot move a folder into itself' };
    }
    
    fs.renameSync(sourcePath, destPath);
    return { success: true, newPath: destPath };
  } catch (err) {
    return { error: err.message };
  }
});
