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
      try {
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        const html = `<div style="font-family:sans-serif;line-height:1.6;">
          <div style="color:#888;margin-bottom:12px;font-size:12px;">Pages: ${data.numpages} | Characters: ${data.text.length}</div>
          <pre style="white-space:pre-wrap;font-size:14px;">${data.text.replace(/</g, '&lt;')}</pre>
        </div>`;
        return { content: html, path: filePath, size: stat.size, type: 'pdf' };
      } catch (e) {
        return { error: 'Failed to parse PDF: ' + e.message };
      }
    }

    // Binary file check - skip reading as utf-8
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.zip', '.tar', '.gz', '.exe', '.dll'];
    if (binaryExts.includes(ext)) {
      return { content: '', path: filePath, size: stat.size, type: 'binary' };
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
