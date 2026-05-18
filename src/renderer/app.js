// State
let currentFile = null;
let currentTab = 'preview';

// DOM elements
const treeContainer = document.getElementById('tree-container');
const rightPane = document.getElementById('right-pane');
const previewPanel = document.getElementById('preview-panel');
const sourcePanel = document.getElementById('source-panel');
const sourceCode = document.getElementById('source-code');
const tabContent = document.getElementById('tab-content');
const currentPathLabel = document.getElementById('current-path');

// Open folder
document.getElementById('btn-open').addEventListener('click', async () => {
  const folderPath = await window.api.openFolder();
  if (!folderPath) return;

  currentPathLabel.textContent = folderPath;
  const tree = await window.api.readDir(folderPath);

  if (tree.error) {
    treeContainer.innerHTML = `<p class="placeholder">Error: ${tree.error}</p>`;
    return;
  }

  renderTree(tree);
});

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
        icon.textContent = '📁';
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
function renderTree(nodes) {
  treeContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();
  nodes.forEach(node => fragment.appendChild(createTreeNode(node)));
  treeContainer.appendChild(fragment);
}

function createTreeNode(node) {
  const wrapper = document.createElement('div');

  const item = document.createElement('div');
  item.className = 'tree-item';

  if (node.isDirectory) {
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '▶';
    item.appendChild(arrow);

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = '📁';
    item.appendChild(icon);

    const name = document.createElement('span');
    name.textContent = node.name;
    item.appendChild(name);

    wrapper.appendChild(item);

    const children = document.createElement('div');
    children.className = 'tree-children collapsed';
    if (node.children) {
      node.children.forEach(child => children.appendChild(createTreeNode(child)));
    }
    wrapper.appendChild(children);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      arrow.classList.toggle('expanded');
      children.classList.toggle('collapsed');
      icon.textContent = children.classList.contains('collapsed') ? '📁' : '📂';
    });
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'arrow';
    spacer.textContent = '';
    item.appendChild(spacer);

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = getFileIcon(node.name);
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

// File icons
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    js: '📜', ts: '📜', jsx: '📜', tsx: '📜',
    html: '🌐', htm: '🌐',
    css: '🎨', scss: '🎨', less: '🎨',
    json: '📋', xml: '📋', yaml: '📋', yml: '📋',
    md: '📝', txt: '📝', log: '📝',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', ico: '🖼️',
    pdf: '📕',
    zip: '📦', tar: '📦', gz: '📦',
    py: '🐍', rb: '💎', go: '🔷', rs: '🦀', java: '☕', cs: '🔮',
    sh: '⚙️', bat: '⚙️', ps1: '⚙️',
  };
  return icons[ext] || '📄';
}

// Open and display file
async function openFile(filePath) {
  const result = await window.api.readFile(filePath);
  if (result.error) {
    previewPanel.innerHTML = `<p class="placeholder">Error: ${result.error}</p>`;
    sourceCode.textContent = '';
    return;
  }

  currentFile = { path: filePath, content: result.content, type: result.type };

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
    previewPanel.innerHTML = `<div class="office-preview" style="background:white;color:#333;padding:20px;border-radius:4px;">${content}</div>`;
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

  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'bmp', 'webp'].includes(ext)) {
    previewPanel.innerHTML = `<img src="file://${filePath.replace(/\\/g, '/')}" alt="Image preview">`;
  } else if (type === 'binary') {
    previewPanel.innerHTML = `<p class="placeholder">Binary file (${ext}) — no text preview available</p>`;
  } else if (['md', 'markdown'].includes(ext)) {
    previewPanel.innerHTML = `<div class="markdown">${renderMarkdown(content)}</div>`;
  } else if (['html', 'htm'].includes(ext)) {
    previewPanel.innerHTML = `<iframe srcdoc="${escapeHtml(content)}" style="width:100%;height:100%;border:none;background:white;"></iframe>`;
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
