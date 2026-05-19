// State
let currentFile = null;
let currentTab = 'preview';
let currentFolderPath = null;
let draggedItem = null;
let expandedPaths = new Set(); // Track expanded folders

// DOM elements
const treeContainer = document.getElementById('tree-container');
const rightPane = document.getElementById('right-pane');
const previewPanel = document.getElementById('preview-panel');
const sourcePanel = document.getElementById('source-panel');
const sourceCode = document.getElementById('source-code');
const tabContent = document.getElementById('tab-content');
const currentPathLabel = document.getElementById('current-path');

// Intercept link clicks in preview panel - open in browser
previewPanel.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.href) {
    e.preventDefault();
    const url = link.href;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.api.openExternal(url);
    }
  }
});

// Listen for messages from iframes (HTML preview)
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'open-link' && e.data.url) {
    window.api.openExternal(e.data.url);
  }
});

// Open folder
document.getElementById('btn-open').addEventListener('click', async () => {
  const folderPath = await window.api.openFolder();
  if (!folderPath) return;

  currentFolderPath = folderPath;
  currentPathLabel.textContent = folderPath;
  const tree = await window.api.readDir(folderPath);

  if (tree.error) {
    treeContainer.innerHTML = `<p class="placeholder">Error: ${tree.error}</p>`;
    return;
  }

  renderTree(tree);
});

// Refresh tree
async function refreshTree() {
  if (!currentFolderPath) return;
  const tree = await window.api.readDir(currentFolderPath);
  if (!tree.error) {
    renderTree(tree);
  }
}

// Toggle right pane visibility
document.getElementById('btn-toggle-right').addEventListener('click', () => {
  rightPane.classList.toggle('hidden');
  document.getElementById('splitter').style.display =
    rightPane.classList.contains('hidden') ? 'none' : '';
});

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    updateView();
  });
});

// Splitter drag
const splitter = document.getElementById('splitter');
const leftPane = document.getElementById('left-pane');
let isDragging = false;

splitter.addEventListener('mousedown', (e) => {
  isDragging = true;
  document.body.style.cursor = 'col-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const newWidth = e.clientX;
  if (newWidth > 100 && newWidth < window.innerWidth - 200) {
    leftPane.style.width = newWidth + 'px';
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  document.body.style.cursor = '';
});

// Keyboard navigation for tree
document.addEventListener('keydown', (e) => {
  // Only handle when focus is not in an input/textarea
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const allItems = Array.from(treeContainer.querySelectorAll('.tree-item'));
  // Filter to only visible items (not inside collapsed parents)
  const visibleItems = allItems.filter(item => {
    let el = item.parentElement;
    while (el && el !== treeContainer) {
      if (el.classList.contains('tree-children') && el.classList.contains('collapsed')) return false;
      el = el.parentElement;
    }
    return true;
  });

  if (visibleItems.length === 0) return;

  const selectedItem = treeContainer.querySelector('.tree-item.selected');
  let currentIndex = selectedItem ? visibleItems.indexOf(selectedItem) : -1;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIndex = currentIndex < visibleItems.length - 1 ? currentIndex + 1 : 0;
    selectTreeItem(visibleItems[nextIndex]);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleItems.length - 1;
    selectTreeItem(visibleItems[prevIndex]);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (selectedItem) {
      const wrapper = selectedItem.parentElement;
      const children = wrapper.querySelector('.tree-children');
      if (children && children.classList.contains('collapsed')) {
        // Expand folder
        const arrow = selectedItem.querySelector('.arrow');
        const icon = selectedItem.querySelector('.icon');
        arrow.classList.add('expanded');
        children.classList.remove('collapsed');
        icon.textContent = '📂';
      } else if (children && !children.classList.contains('collapsed')) {
        // Move to first child
        const firstChild = children.querySelector('.tree-item');
        if (firstChild) selectTreeItem(firstChild);
      }
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (selectedItem) {
      const wrapper = selectedItem.parentElement;
      const children = wrapper.querySelector('.tree-children');
      if (children && !children.classList.contains('collapsed')) {
        // Collapse folder
        const arrow = selectedItem.querySelector('.arrow');
        const icon = selectedItem.querySelector('.icon');
        arrow.classList.remove('expanded');
        children.classList.add('collapsed');
        icon.innerHTML = getFileIcon('folder', true, false);
      } else {
        // Move to parent folder
        const parentChildren = wrapper.closest('.tree-children');
        if (parentChildren) {
          const parentItem = parentChildren.previousElementSibling;
          if (parentItem && parentItem.classList.contains('tree-item')) {
            selectTreeItem(parentItem);
          }
        }
      }
    }
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (selectedItem) {
      selectedItem.click();
    }
  }
});

function selectTreeItem(item, openIfFile) {
  treeContainer.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
  item.classList.add('selected');
  item.scrollIntoView({ block: 'nearest' });
}

// Render tree
let rootDropInitialized = false;

function renderTree(nodes) {
  treeContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();
  nodes.forEach(node => fragment.appendChild(createTreeNode(node)));
  treeContainer.appendChild(fragment);
  
  // Make tree container a drop target for root (only once)
  if (!rootDropInitialized) {
    rootDropInitialized = true;
    
    treeContainer.addEventListener('dragover', (e) => {
      if (draggedItem && e.target === treeContainer) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        treeContainer.classList.add('drag-over-root');
      }
    });
    
    treeContainer.addEventListener('dragleave', (e) => {
      if (e.target === treeContainer) {
        treeContainer.classList.remove('drag-over-root');
      }
    });
    
    treeContainer.addEventListener('drop', async (e) => {
      if (e.target === treeContainer && draggedItem && currentFolderPath) {
        e.preventDefault();
        treeContainer.classList.remove('drag-over-root');
        
        const result = await window.api.moveItem(draggedItem.path, currentFolderPath);
        if (result.error) {
          alert(result.error);
        } else {
          refreshTree();
        }
      }
    });
  }
}

function createTreeNode(node) {
  const wrapper = document.createElement('div');

  const item = document.createElement('div');
  item.className = 'tree-item';
  item.draggable = true;
  item.dataset.path = node.path;
  item.dataset.isDir = node.isDirectory ? '1' : '0';

  // Drag events
  item.addEventListener('dragstart', (e) => {
    draggedItem = { path: node.path, isDirectory: node.isDirectory, element: wrapper };
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  item.addEventListener('dragend', () => {
    item.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedItem = null;
  });

  if (node.isDirectory) {
    // Drop target for folders
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedItem && draggedItem.path !== node.path) {
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      
      if (draggedItem && draggedItem.path !== node.path) {
        const result = await window.api.moveItem(draggedItem.path, node.path);
        if (result.error) {
          alert(result.error);
        } else {
          refreshTree();
        }
      }
    });

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '▶';
    item.appendChild(arrow);

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.innerHTML = getFileIcon(node.name, true, false);
    item.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = node.name;
    item.appendChild(name);

    wrapper.appendChild(item);

    // Children container (empty initially for lazy loading)
    const children = document.createElement('div');
    children.className = 'tree-children collapsed';
    let childrenLoaded = false;
    
    wrapper.appendChild(children);

    // Auto-expand if was previously expanded
    const autoExpand = async () => {
      if (expandedPaths.has(node.path) && !childrenLoaded && node.hasChildren) {
        childrenLoaded = true;
        const childNodes = await window.api.readDir(node.path);
        if (!childNodes.error) {
          childNodes.forEach(child => children.appendChild(createTreeNode(child)));
        }
        arrow.classList.add('expanded');
        children.classList.remove('collapsed');
        icon.innerHTML = getFileIcon(node.name, true, true);
      }
    };
    autoExpand();

    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      // Lazy load children on first expand
      if (!childrenLoaded && node.hasChildren) {
        childrenLoaded = true;
        item.classList.add('loading');
        
        const childNodes = await window.api.readDir(node.path);
        if (!childNodes.error) {
          childNodes.forEach(child => children.appendChild(createTreeNode(child)));
        }
        
        item.classList.remove('loading');
      }
      
      arrow.classList.toggle('expanded');
      children.classList.toggle('collapsed');
      
      // Track expanded state
      if (children.classList.contains('collapsed')) {
        expandedPaths.delete(node.path);
      } else {
        expandedPaths.add(node.path);
      }
      
      icon.innerHTML = getFileIcon(node.name, true, !children.classList.contains('collapsed'));
    });
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'arrow';
    spacer.textContent = '';
    item.appendChild(spacer);

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.innerHTML = getFileIcon(node.name);
    item.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = node.name;
    item.appendChild(name);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      openFile(node.path);
    });

    wrapper.appendChild(item);
  }

  return wrapper;
}

// File icons - SVG based for better styling
function getFileIcon(filename, isFolder = false, isOpen = false) {
  if (isFolder) {
    return isOpen ? 
      `<svg viewBox="0 0 16 16" class="file-icon folder-open"><path fill="currentColor" d="M6 4H1.5l-.5.5V6h4l1-2zM1.5 7l-.5.5v7l.5.5h13l.5-.5v-7l-.5-.5h-13zM1 14V8h14v6H1z"/><path fill="currentColor" d="M14.5 5h-7l-.5.5V6h8v-.5l-.5-.5z"/></svg>` :
      `<svg viewBox="0 0 16 16" class="file-icon folder"><path fill="currentColor" d="M14.5 3H7.71l-.85-.85L6.51 2h-5l-.5.5v11l.5.5h13l.5-.5v-10L14.5 3zm-.51 10H2V3h4.29l.85.85.36.15H14v9z"/></svg>`;
  }
  
  const ext = filename.split('.').pop().toLowerCase();
  const iconMap = {
    // JavaScript/TypeScript
    js: { color: '#f7df1e', icon: 'JS' },
    ts: { color: '#3178c6', icon: 'TS' },
    jsx: { color: '#61dafb', icon: 'JSX' },
    tsx: { color: '#3178c6', icon: 'TSX' },
    // Web
    html: { color: '#e34c26', icon: '&lt;/&gt;' },
    htm: { color: '#e34c26', icon: '&lt;/&gt;' },
    css: { color: '#264de4', icon: '#' },
    scss: { color: '#cc6699', icon: 'S' },
    less: { color: '#1d365d', icon: 'L' },
    // Data
    json: { color: '#cbcb41', icon: '{}' },
    xml: { color: '#f60', icon: '&lt;&gt;' },
    yaml: { color: '#cb171e', icon: 'Y' },
    yml: { color: '#cb171e', icon: 'Y' },
    // Docs
    md: { color: '#519aba', icon: 'M↓' },
    txt: { color: '#89e051', icon: 'T' },
    log: { color: '#999', icon: '≡' },
    pdf: { color: '#e44d26', icon: 'PDF' },
    // Images
    png: { color: '#a074c4', icon: '🖼' },
    jpg: { color: '#a074c4', icon: '🖼' },
    jpeg: { color: '#a074c4', icon: '🖼' },
    gif: { color: '#a074c4', icon: '🖼' },
    svg: { color: '#ffb13b', icon: 'SVG' },
    ico: { color: '#a074c4', icon: '◐' },
    tif: { color: '#a074c4', icon: '🖼' },
    tiff: { color: '#a074c4', icon: '🖼' },
    // Archives
    zip: { color: '#e8a87c', icon: '📦' },
    tar: { color: '#e8a87c', icon: '📦' },
    gz: { color: '#e8a87c', icon: '📦' },
    // Languages
    py: { color: '#3572A5', icon: 'PY' },
    rb: { color: '#cc342d', icon: 'RB' },
    go: { color: '#00add8', icon: 'GO' },
    rs: { color: '#dea584', icon: 'RS' },
    java: { color: '#b07219', icon: 'J' },
    cs: { color: '#178600', icon: 'C#' },
    c: { color: '#555555', icon: 'C' },
    cpp: { color: '#f34b7d', icon: 'C++' },
    h: { color: '#555555', icon: 'H' },
    // Shell
    sh: { color: '#89e051', icon: '$' },
    bat: { color: '#c1f12e', icon: '>' },
    ps1: { color: '#012456', icon: 'PS' },
    // Config
    env: { color: '#ecd53f', icon: '⚙' },
    gitignore: { color: '#f14e32', icon: 'G' },
    // Office
    doc: { color: '#2b579a', icon: 'W' },
    docx: { color: '#2b579a', icon: 'W' },
    xls: { color: '#217346', icon: 'X' },
    xlsx: { color: '#217346', icon: 'X' },
    ppt: { color: '#d24726', icon: 'P' },
    pptx: { color: '#d24726', icon: 'P' },
  };
  
  const info = iconMap[ext];
  if (info) {
    return `<span class="file-icon-badge" style="background:${info.color};">${info.icon}</span>`;
  }
  return `<svg viewBox="0 0 16 16" class="file-icon file"><path fill="currentColor" d="M13.71 4.29l-3-3L10 1H4L3 2v12l1 1h9l1-1V5l-.29-.71zM13 14H4V2h5v4h4v8z"/></svg>`;
}

// Open and display file
async function openFile(filePath) {
  const result = await window.api.readFile(filePath);
  if (result.error) {
    // Handle specific error types
    if (result.type === 'fileTooLarge') {
      previewPanel.innerHTML = `
        <div class="placeholder">
          <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
          <p style="font-weight:bold;margin-bottom:8px;">File too large to preview</p>
          <p style="color:#888;margin-bottom:16px;">Files larger than 100 MB cannot be previewed</p>
        </div>`;
    } else if (result.type === 'notAllowed') {
      previewPanel.innerHTML = `
        <div class="placeholder">
          <div style="font-size:48px;margin-bottom:16px;">🚫</div>
          <p style="font-weight:bold;margin-bottom:8px;">File type not in whitelist</p>
          <p style="color:#888;margin-bottom:16px;">${result.error}</p>
          <button onclick="openSettingsModal()" style="padding:8px 16px;cursor:pointer;">Open Settings</button>
        </div>`;
    } else if (result.type === 'timeout') {
      previewPanel.innerHTML = `
        <div class="placeholder">
          <div style="font-size:48px;margin-bottom:16px;">⏱️</div>
          <p style="font-weight:bold;margin-bottom:8px;">Preview timed out</p>
          <p style="color:#888;margin-bottom:16px;">File took too long to load (&gt;10s)</p>
        </div>`;
    } else {
      previewPanel.innerHTML = `<p class="placeholder">Error: ${result.error}</p>`;
    }
    sourceCode.textContent = '';
    return;
  }

  currentFile = { path: filePath, content: result.content, type: result.type };

  // Check if file is binary (no meaningful source to show)
  const binaryTypes = ['image', 'tiff', 'pdf', 'binary'];
  const isBinary = binaryTypes.includes(result.type);
  
  // Show/hide Source and Split tabs based on file type
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    const tabName = tab.dataset.tab;
    if (tabName === 'source' || tabName === 'split') {
      tab.style.display = isBinary ? 'none' : '';
    }
  });
  
  // If currently on source/split tab and file is binary, switch to preview
  if (isBinary && (currentTab === 'source' || currentTab === 'split')) {
    currentTab = 'preview';
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-tab="preview"]').classList.add('active');
  }

  // Source with syntax highlighting
  const ext = filePath.split('.').pop().toLowerCase();

  if (result.type === 'docx' || result.type === 'xlsx' || result.type === 'pptx' || result.type === 'pdf') {
    sourceCode.textContent = result.content;
    sourceCode.className = result.type === 'docx' ? 'language-html' : 'language-json';
    hljs.highlightElement(sourceCode);
  } else {
    const langMap = {
      js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', cs: 'csharp',
      html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
      json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
      md: 'markdown', sh: 'bash', bat: 'dos', ps1: 'powershell',
      sql: 'sql', php: 'php', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp'
    };
    const lang = langMap[ext] || '';
    sourceCode.textContent = result.content;
    if (lang) {
      sourceCode.className = `language-${lang}`;
    } else {
      sourceCode.className = '';
    }
    hljs.highlightElement(sourceCode);
  }

  renderPreview(filePath, result.content, result.type);
  updateView();
}

// Render preview based on file type
function renderPreview(filePath, content, type) {
  const ext = filePath.split('.').pop().toLowerCase();

  // Office documents
  if (type === 'docx') {
    previewPanel.innerHTML = `<div class="office-preview" style="background:white;color:#333;padding:20px;border-radius:4px;">${content}</div>`;
    return;
  }

  if (type === 'pdf') {
    // Embed PDF directly to preserve page format
    previewPanel.innerHTML = `<embed src="file://${content}" type="application/pdf" style="width:100%;height:100%;border:none;">`;
    return;
  }

  if (type === 'xlsx') {
    const sheets = JSON.parse(content);
    const sheetNames = Object.keys(sheets);
    let html = '<div class="office-preview" style="background:white;color:#333;padding:12px;border-radius:4px;">';
    html += '<div style="margin-bottom:10px;">';
    sheetNames.forEach((name, i) => {
      html += `<button class="sheet-tab" data-sheet="${i}" style="padding:4px 12px;margin-right:4px;cursor:pointer;border:1px solid #ccc;background:${i === 0 ? '#0078d4;color:white' : '#f0f0f0'};border-radius:3px;">${escapeHtml(name)}</button>`;
    });
    html += '</div>';
    sheetNames.forEach((name, i) => {
      html += `<div class="sheet-content" data-sheet="${i}" style="display:${i === 0 ? 'block' : 'none'};overflow:auto;">${sheets[name]}</div>`;
    });
    html += '</div>';
    previewPanel.innerHTML = html;

    // Sheet tab switching
    previewPanel.querySelectorAll('.sheet-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.sheet;
        previewPanel.querySelectorAll('.sheet-tab').forEach(b => { b.style.background = '#f0f0f0'; b.style.color = '#333'; });
        btn.style.background = '#0078d4'; btn.style.color = 'white';
        previewPanel.querySelectorAll('.sheet-content').forEach(c => c.style.display = 'none');
        previewPanel.querySelector(`.sheet-content[data-sheet="${idx}"]`).style.display = 'block';
      });
    });

    // Style the table
    previewPanel.querySelectorAll('table').forEach(tbl => {
      tbl.style.borderCollapse = 'collapse';
      tbl.style.width = '100%';
      tbl.style.fontSize = '13px';
    });
    previewPanel.querySelectorAll('td, th').forEach(cell => {
      cell.style.border = '1px solid #ddd';
      cell.style.padding = '4px 8px';
    });
    previewPanel.querySelectorAll('th').forEach(th => {
      th.style.background = '#f5f5f5';
      th.style.fontWeight = 'bold';
    });
    return;
  }

  if (type === 'pptx') {
    const slides = JSON.parse(content);
    let html = '<div class="office-preview" style="padding:12px;">';
    slides.forEach((text, i) => {
      html += `<div style="background:#2d2d30;border:1px solid #555;border-radius:6px;padding:20px;margin-bottom:12px;"><span style="color:#0078d4;font-size:11px;">Slide ${i + 1}</span><p style="margin-top:8px;color:#eee;line-height:1.5;">${escapeHtml(text)}</p></div>`;
    });
    if (slides.length === 0) html += '<p class="placeholder">No text content found in slides</p>';
    html += '</div>';
    previewPanel.innerHTML = html;
    return;
  }

  if (type === 'tiff') {
    // TIFF is converted to base64 PNG by main process
    previewPanel.innerHTML = `<img src="${content}" alt="TIFF preview">`;
  } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'bmp', 'webp', 'icns', 'heic'].includes(ext)) {
    previewPanel.innerHTML = `<img src="file://${filePath.replace(/\\/g, '/')}" alt="Image preview">`;
  } else if (type === 'binary') {
    previewPanel.innerHTML = `<p class="placeholder">Binary file (${ext}) — no preview available</p>`;
  } else if (['md', 'markdown'].includes(ext)) {
    previewPanel.innerHTML = `<div class="markdown">${renderMarkdown(content)}</div>`;
  } else if (ext === 'json') {
    // Collapsible JSON tree view
    try {
      const parsed = JSON.parse(content);
      previewPanel.innerHTML = '';
      const jsonTree = buildJsonTree(parsed);
      previewPanel.appendChild(jsonTree);
    } catch (e) {
      // If JSON is invalid, show as plain text
      previewPanel.innerHTML = '';
      const foldView = buildFoldableCode(content, filePath);
      previewPanel.appendChild(foldView);
    }
  } else if (['html', 'htm'].includes(ext)) {
    // Create iframe and inject script to open links in external browser
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:100%;border:none;background:white;';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    previewPanel.innerHTML = '';
    previewPanel.appendChild(iframe);
    
    const linkScript = `<script>
      document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (link && link.href && (link.href.startsWith('http://') || link.href.startsWith('https://'))) {
          e.preventDefault();
          window.parent.postMessage({ type: 'open-link', url: link.href }, '*');
        }
      });
    <\/script>`;
    
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(content.includes('</body>') ? content.replace('</body>', linkScript + '</body>') : content + linkScript);
    doc.close();
  } else {
    // VS Code-style code folding preview
    previewPanel.innerHTML = '';
    const foldView = buildFoldableCode(content, filePath);
    previewPanel.appendChild(foldView);
  }
}

// Build VS Code-style foldable code view
function buildFoldableCode(content, filePath) {
  const lines = content.split('\n');
  const container = document.createElement('div');
  container.className = 'code-fold';

  // Find fold regions based on brace matching and indentation
  const foldRegions = findFoldRegions(lines);

  // Build line elements
  for (let i = 0; i < lines.length; i++) {
    const lineEl = document.createElement('div');
    lineEl.className = 'code-fold-line';
    lineEl.dataset.line = i;

    // Gutter (line number + fold indicator)
    const gutter = document.createElement('span');
    gutter.className = 'code-fold-gutter';

    const lineNum = document.createElement('span');
    lineNum.className = 'code-fold-linenum';
    lineNum.textContent = String(i + 1).padStart(4);
    gutter.appendChild(lineNum);

    const foldBtn = document.createElement('span');
    foldBtn.className = 'code-fold-btn';
    const region = foldRegions.find(r => r.start === i);
    if (region) {
      foldBtn.textContent = '⌵';
      foldBtn.classList.add('foldable');
      foldBtn.dataset.start = region.start;
      foldBtn.dataset.end = region.end;

      foldBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const start = parseInt(foldBtn.dataset.start);
        const end = parseInt(foldBtn.dataset.end);
        const isCollapsed = foldBtn.classList.contains('collapsed');

        if (isCollapsed) {
          // Expand
          foldBtn.classList.remove('collapsed');
          foldBtn.textContent = '⌵';
          for (let j = start + 1; j <= end; j++) {
            const el = container.querySelector(`.code-fold-line[data-line="${j}"]`);
            if (el) el.classList.remove('code-fold-hidden');
          }
          // Remove ellipsis
          const ellipsis = lineEl.querySelector('.code-fold-ellipsis');
          if (ellipsis) ellipsis.remove();
        } else {
          // Collapse
          foldBtn.classList.add('collapsed');
          foldBtn.textContent = '›';
          for (let j = start + 1; j <= end; j++) {
            const el = container.querySelector(`.code-fold-line[data-line="${j}"]`);
            if (el) el.classList.add('code-fold-hidden');
          }
          // Add ellipsis indicator
          if (!lineEl.querySelector('.code-fold-ellipsis')) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'code-fold-ellipsis';
            ellipsis.textContent = ` ⋯ (${end - start} lines)`;
            lineEl.querySelector('.code-fold-content').appendChild(ellipsis);
          }
        }
      });
    }
    gutter.appendChild(foldBtn);
    lineEl.appendChild(gutter);

    // Code content
    const codeLine = document.createElement('span');
    codeLine.className = 'code-fold-content';
    codeLine.textContent = lines[i];
    lineEl.appendChild(codeLine);

    container.appendChild(lineEl);
  }

  // Apply syntax highlighting to all content
  setTimeout(() => {
    const ext = filePath.split('.').pop().toLowerCase();
    const langMap = {
      js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', cs: 'csharp',
      css: 'css', scss: 'scss', less: 'less',
      json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
      sh: 'bash', bat: 'dos', ps1: 'powershell',
      sql: 'sql', php: 'php', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp'
    };
    const lang = langMap[ext];
    if (lang && window.hljs) {
      const allCode = lines.join('\n');
      const highlighted = hljs.highlight(allCode, { language: lang, ignoreIllegals: true });
      const hlLines = highlighted.value.split('\n');
      const contentEls = container.querySelectorAll('.code-fold-content');
      contentEls.forEach((el, idx) => {
        if (idx < hlLines.length) {
          // Preserve ellipsis if present
          const ellipsis = el.querySelector('.code-fold-ellipsis');
          el.innerHTML = hlLines[idx];
          if (ellipsis) el.appendChild(ellipsis);
        }
      });
    }
  }, 0);

  return container;
}

// Find fold regions by matching braces and indentation
function findFoldRegions(lines) {
  const regions = [];
  const braceStack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '{' || line[c] === '[' || line[c] === '(') {
        braceStack.push({ char: line[c], line: i });
      } else if (line[c] === '}' || line[c] === ']' || line[c] === ')') {
        if (braceStack.length > 0) {
          const open = braceStack.pop();
          // Only create fold region if it spans multiple lines
          if (i - open.line >= 2) {
            regions.push({ start: open.line, end: i });
          }
        }
      }
    }
  }

  // Also add indentation-based folding for Python/YAML style
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      i++;
      continue;
    }
    const indent = line.length - trimmed.length;
    // Look for a block of deeper indentation following
    if (i + 1 < lines.length) {
      const nextNonEmpty = lines.slice(i + 1).findIndex(l => l.trim() !== '');
      if (nextNonEmpty >= 0) {
        const nextLine = lines[i + 1 + nextNonEmpty];
        const nextIndent = nextLine.length - nextLine.trimStart().length;
        if (nextIndent > indent) {
          // Find end of indented block
          let end = i + 1;
          for (let j = i + 1; j < lines.length; j++) {
            const jTrimmed = lines[j].trim();
            if (jTrimmed === '') continue;
            const jIndent = lines[j].length - lines[j].trimStart().length;
            if (jIndent <= indent) break;
            end = j;
          }
          if (end - i >= 2) {
            // Only add if no brace-based region already covers this
            const alreadyCovered = regions.some(r => r.start === i);
            if (!alreadyCovered) {
              regions.push({ start: i, end });
            }
          }
        }
      }
    }
    i++;
  }

  // Sort by start line and deduplicate
  regions.sort((a, b) => a.start - b.start);
  return regions;
}

// Simple markdown renderer
function renderMarkdown(text) {
  return text
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Build collapsible JSON tree view
function buildJsonTree(data, key = null, depth = 0) {
  const container = document.createElement('div');
  container.className = 'json-tree';
  if (depth === 0) {
    container.style.cssText = 'font-family:monospace;font-size:13px;padding:12px;background:var(--bg-secondary);color:var(--text-primary);overflow:auto;height:100%;';
  }

  const indent = '  '.repeat(depth);
  const isArray = Array.isArray(data);
  const isObject = data !== null && typeof data === 'object';

  if (isObject) {
    const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data);
    const bracket = isArray ? '[' : '{';
    const closeBracket = isArray ? ']' : '}';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;';

    const toggle = document.createElement('span');
    toggle.textContent = '▼ ';
    toggle.style.cssText = 'cursor:pointer;color:#888;user-select:none;min-width:16px;';

    const keySpan = document.createElement('span');
    if (key !== null) {
      keySpan.innerHTML = `<span class="json-key">"${key}"</span><span class="json-colon">: </span>`;
    }

    const bracketSpan = document.createElement('span');
    bracketSpan.textContent = bracket;
    bracketSpan.className = 'json-bracket';

    const countSpan = document.createElement('span');
    countSpan.textContent = ` // ${entries.length} ${isArray ? 'items' : 'keys'}`;
    countSpan.className = 'json-comment';
    countSpan.style.marginLeft = '8px';

    row.appendChild(toggle);
    row.appendChild(keySpan);
    row.appendChild(bracketSpan);
    row.appendChild(countSpan);
    container.appendChild(row);

    const childContainer = document.createElement('div');
    childContainer.style.cssText = 'margin-left:20px;';

    entries.forEach(([k, v], idx) => {
      const child = buildJsonTree(v, isArray ? null : k, depth + 1);
      if (idx < entries.length - 1 && typeof v !== 'object') {
        child.querySelector('span:last-child').textContent += ',';
      } else if (idx < entries.length - 1 && typeof v === 'object') {
        const lastSpan = document.createElement('span');
        lastSpan.textContent = ',';
        lastSpan.className = 'json-colon';
        child.appendChild(lastSpan);
      }
      childContainer.appendChild(child);
    });

    container.appendChild(childContainer);

    const closeRow = document.createElement('div');
    closeRow.innerHTML = `<span style="min-width:16px;display:inline-block;"></span><span class="json-bracket">${closeBracket}</span>`;
    container.appendChild(closeRow);

    toggle.addEventListener('click', () => {
      const isCollapsed = childContainer.style.display === 'none';
      childContainer.style.display = isCollapsed ? 'block' : 'none';
      closeRow.style.display = isCollapsed ? 'block' : 'none';
      toggle.textContent = isCollapsed ? '▼ ' : '▶ ';
      countSpan.style.display = isCollapsed ? 'inline' : 'inline';
      bracketSpan.textContent = isCollapsed ? bracket : bracket + '...' + closeBracket;
    });
  } else {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;';

    const spacer = document.createElement('span');
    spacer.style.minWidth = '16px';

    const keySpan = document.createElement('span');
    if (key !== null) {
      keySpan.innerHTML = `<span class="json-key">"${key}"</span><span class="json-colon">: </span>`;
    }

    const valueSpan = document.createElement('span');
    if (typeof data === 'string') {
      valueSpan.innerHTML = `<span class="json-string">"${escapeHtml(data)}"</span>`;
    } else if (typeof data === 'number') {
      valueSpan.innerHTML = `<span class="json-number">${data}</span>`;
    } else if (typeof data === 'boolean') {
      valueSpan.innerHTML = `<span class="json-bool">${data}</span>`;
    } else if (data === null) {
      valueSpan.innerHTML = `<span class="json-null">null</span>`;
    }

    row.appendChild(spacer);
    row.appendChild(keySpan);
    row.appendChild(valueSpan);
    container.appendChild(row);
  }

  return container;
}

// Update panel visibility based on current tab
function updateView() {
  tabContent.classList.remove('split');
  previewPanel.classList.remove('hidden');
  sourcePanel.classList.remove('hidden');

  if (currentTab === 'preview') {
    sourcePanel.classList.add('hidden');
  } else if (currentTab === 'source') {
    previewPanel.classList.add('hidden');
  } else if (currentTab === 'split') {
    tabContent.classList.add('split');
  }
}

// Settings Modal
let settingsModal = null;

async function openSettingsModal() {
  if (settingsModal) {
    settingsModal.style.display = 'flex';
    return;
  }
  
  const settings = await window.api.getPreviewSettings();
  
  settingsModal = document.createElement('div');
  settingsModal.id = 'settings-modal';
  settingsModal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;
  `;
  
  settingsModal.innerHTML = `
    <div style="background: var(--bg-primary, #1e1e1e); border-radius: 8px; padding: 20px; width: 500px; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0;">Preview Settings</h3>
        <button id="close-settings" style="background: none; border: none; font-size: 20px; cursor: pointer; color: inherit;">×</button>
      </div>
      
      <div style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="whitelist-enabled" ${settings.isWhitelistEnabled ? 'checked' : ''}>
          <span>Enable file type whitelist</span>
        </label>
      </div>
      
      <div id="whitelist-section" style="display: ${settings.isWhitelistEnabled ? 'block' : 'none'};">
        <div style="margin-bottom: 12px; display: flex; gap: 8px;">
          <input type="text" id="new-ext" placeholder="Add extension (e.g. txt)" style="flex: 1; padding: 6px 10px; border: 1px solid #444; border-radius: 4px; background: #2d2d2d; color: inherit;">
          <button id="add-ext" style="padding: 6px 12px; cursor: pointer;">Add</button>
        </div>
        
        <div id="whitelist-tags" style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 200px; overflow-y: auto; padding: 8px; background: #2d2d2d; border-radius: 4px;">
          ${settings.whitelist.map(ext => `
            <span class="ext-tag" data-ext="${ext}" style="background: #444; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 12px;">
              ${ext}
              <span class="remove-ext" style="cursor: pointer; opacity: 0.7;">×</span>
            </span>
          `).join('')}
        </div>
        
        <button id="reset-whitelist" style="margin-top: 12px; padding: 6px 12px; cursor: pointer;">Reset to Default</button>
      </div>
      
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #444; color: #888; font-size: 12px;">
        <p>• Files larger than 100 MB will not be previewed</p>
        <p>• Preview will timeout after 10 seconds</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(settingsModal);
  
  // Event handlers
  document.getElementById('close-settings').onclick = () => settingsModal.style.display = 'none';
  settingsModal.onclick = (e) => { if (e.target === settingsModal) settingsModal.style.display = 'none'; };
  
  document.getElementById('whitelist-enabled').onchange = async (e) => {
    const section = document.getElementById('whitelist-section');
    section.style.display = e.target.checked ? 'block' : 'none';
    await window.api.setPreviewSettings({ isWhitelistEnabled: e.target.checked });
  };
  
  document.getElementById('add-ext').onclick = async () => {
    const input = document.getElementById('new-ext');
    const ext = input.value.trim().toLowerCase().replace(/^\./, '');
    if (!ext) return;
    
    const settings = await window.api.getPreviewSettings();
    if (!settings.whitelist.includes(ext)) {
      settings.whitelist.push(ext);
      await window.api.setPreviewSettings({ whitelist: settings.whitelist });
      refreshWhitelistTags();
    }
    input.value = '';
  };
  
  document.getElementById('reset-whitelist').onclick = async () => {
    await window.api.resetPreviewWhitelist();
    refreshWhitelistTags();
  };
  
  document.getElementById('whitelist-tags').onclick = async (e) => {
    if (e.target.classList.contains('remove-ext')) {
      const tag = e.target.closest('.ext-tag');
      const ext = tag.dataset.ext;
      const settings = await window.api.getPreviewSettings();
      const newList = settings.whitelist.filter(x => x !== ext);
      await window.api.setPreviewSettings({ whitelist: newList });
      tag.remove();
    }
  };
}

async function refreshWhitelistTags() {
  const settings = await window.api.getPreviewSettings();
  const container = document.getElementById('whitelist-tags');
  if (!container) return;
  
  container.innerHTML = settings.whitelist.map(ext => `
    <span class="ext-tag" data-ext="${ext}" style="background: #444; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 12px;">
      ${ext}
      <span class="remove-ext" style="cursor: pointer; opacity: 0.7;">×</span>
    </span>
  `).join('');
}

// Keyboard shortcut for settings
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === ',') {
    e.preventDefault();
    openSettingsModal();
  }
});
