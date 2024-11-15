let editor;
let openFiles = new Map();
let activeFile = null;
let compiling = false;
let terminal = null;


// Tab Manager with improved animations and layout
const TabManager = {
  init() {
    this.tabsContainer = document.getElementById('tabs');
    this.initStyles();
    this.initSortable();
    this.initKeyboardShortcuts();
    this.setupEditorChangeTracking();
    this.setupKeyboardShortcuts();
    this.setupResizeObserver(); // Call to setup observer for resizing
  },

  initStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #tabs {
        display: flex;
        gap: 4px;
        padding: 4px;
        background: var(--background-darker, #1e1e1e);
        min-height: 36px;
        overflow-x: auto;
      }

      .tab {
        display: flex;
        align-items: center;
        padding: 0 8px;
        background: var(--tab-background, #2d2d2d);
        border-radius: 4px;
        cursor: pointer;
        user-select: none;
        max-width: 200px;
        height: 32px;
      }

      .tab.active {
        background: var(--tab-active-background, #3d3d3d);
      }

      .tab-title {
        margin-right: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tab-close {
        opacity: 0.7;
        cursor: pointer;
        border: none;
        background: none;
        color: inherit;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }

      .tab-close:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.1);
      }

      .tab.modified .tab-title::after {
        content: '•';
        color: var(--accent-color, #007acc);
        margin-left: 4px;
      }

      .tab.sortable-ghost {
        opacity: 0.5;
        background: var(--accent-color, #007acc);
      }

      .tab.sortable-drag {
        opacity: 0.9;
      }

      .context-menu {
        position: absolute;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        z-index: 1000;
      }

      .context-menu-item {
        padding: 8px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .context-menu-item:hover {
        background: #f0f0f0;
      }
    `;
    document.head.appendChild(style);
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'w') {
          e.preventDefault();
          if (activeFile) {
            await this.closeTab(activeFile);
          }
        } else if (e.key === 's') {
          e.preventDefault();
          await this.saveCurrentTab();
        }
      }
    });
  },

  initSortable() {
    if (this.tabsContainer && window.Sortable) {
      Sortable.create(this.tabsContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        handle: '.tab-content',
        draggable: '.tab',
        onEnd: (evt) => {
          const tabOrder = Array.from(this.tabsContainer.children)
            .map(tab => tab.dataset.path);
          localStorage.setItem('tabOrder', JSON.stringify(tabOrder));
        }
      });
    }
  },

  setupResizeObserver() {
    const resizeObserver = new ResizeObserver(() => {
      if (activeFile) {
        this.scrollTabIntoView(
          this.tabsContainer.querySelector(`[data-path="${activeFile}"]`)
        );
      }
    });
    resizeObserver.observe(this.tabsContainer);
  },
  scrollTabIntoView(tabElement) {
    if (!tabElement) return;

    const container = this.tabsContainer;
    const tabRect = tabElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    if (tabRect.left < containerRect.left) {
      container.scrollLeft += tabRect.left - containerRect.left - 4;
    } else if (tabRect.right > containerRect.right) {
      container.scrollLeft += tabRect.right - containerRect.right + 4;
    }
  },

  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'w') {
          e.preventDefault();
          if (activeFile) {
            this.closeTab(activeFile);
          }
        } else if (e.key === 's') {
          e.preventDefault();
          this.saveCurrentFile();
        }
      }
    });
  },

  setupEditorChangeTracking() {
    if (!editor) return;

    editor.onDidChangeModelContent(() => {
      if (!activeFile) return;

      const tab = this.tabsContainer.querySelector(`[data-path="${activeFile}"]`);
      if (tab && !tab.classList.contains('modified')) {
        tab.classList.add('modified');
      }
    });
  },

  createTab(filePath) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.path = filePath;

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = filePath.split('/').pop();
    title.title = filePath;

    const closeButton = document.createElement('button');
    closeButton.className = 'tab-close';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close';

    tab.appendChild(title);
    tab.appendChild(closeButton);

    // Event listeners
    tab.addEventListener('click', (e) => {
      if (e.target !== closeButton) {
        this.activateTab(filePath);
      }
    });

    closeButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.closeTab(filePath);
    });

    return tab;
  },

  async addTab(filePath, content) {
    if (!this.tabsContainer) return;

    // Check if tab already exists
    const existingTab = this.tabsContainer.querySelector(`[data-path="${filePath}"]`);
    if (existingTab) {
      this.activateTab(filePath);
      return;
    }

    // Add to open files
    openFiles.set(filePath, content);

    // Create and add new tab
    const tab = this.createTab(filePath);
    this.tabsContainer.appendChild(tab);

    // Activate the new tab
    this.activateTab(filePath);

    // Setup change tracking for this file
    this.setupChangeTracking(filePath);
  },

  activateTab(filePath) {
    const content = openFiles.get(filePath);
    if (!content) return;

    // Update tab states
    const tabs = this.tabsContainer.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    const activeTab = this.tabsContainer.querySelector(`[data-path="${filePath}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }

    // Update editor content
    editor.setValue(content);
    activeFile = filePath;

    // Set appropriate language
    const language = this.getLanguageForFile(filePath);
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, language);
    } else {
      editor.setModel(monaco.editor.createModel(content, language));
    }
  },


  async closeTab(filePath) {
    const tab = this.tabsContainer.querySelector(`[data-path="${filePath}"]`);
    if (!tab) return;

    // Check for unsaved changes
    if (tab.classList.contains('modified')) {
      const save = confirm(`Do you want to save changes to ${filePath.split('/').pop()}?`);
      if (save) {
        await this.saveTab(filePath);
      }
    }

    // Remove from open files and DOM
    openFiles.delete(filePath);
    tab.remove();

    // Handle active file changes
    if (activeFile === filePath) {
      const remainingTabs = Array.from(this.tabsContainer.children);
      if (remainingTabs.length > 0) {
        this.activateTab(remainingTabs[remainingTabs.length - 1].dataset.path);
      } else {
        activeFile = null;
        editor.setValue('');
      }
    }
  },
  async saveTab(filePath) {
    if (!filePath || !editor) return;

    const content = editor.getValue();
    try {
      await window.electronAPI.saveFile({
        filePath,
        content
      });

      // Update stored content and remove modified marker
      openFiles.set(filePath, content);
      const tab = this.tabsContainer.querySelector(`[data-path="${filePath}"]`);
      if (tab) {
        tab.classList.remove('modified');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      alert(`Failed to save ${filePath.split('/').pop()}`);
    }
  },

  async saveCurrentTab() {
    if (activeFile) {
      await this.saveTab(activeFile);
    }
  },

  setupChangeTracking(filePath) {
    if (!editor) return;

    const disposable = editor.onDidChangeModelContent(() => {
      if (activeFile !== filePath) return;

      const tab = this.tabsContainer.querySelector(`[data-path="${filePath}"]`);
      if (tab && !tab.classList.contains('modified')) {
        tab.classList.add('modified');
      }
    });

    // Store disposable for cleanup if needed
    return disposable;
  },

  async confirmSaveChanges(filePath) {
    const content = editor.getValue();
    try {
      await window.electronAPI.saveFile({
        filePath,
        content
      });
      openFiles.set(filePath, content);
      const tab = this.tabsContainer.querySelector(`[data-path="${filePath}"]`);
      if (tab) {
        tab.classList.remove('modified');
      }
      return true;
    } catch (error) {
      console.error('Error saving file:', error);
      return confirm('Do you want to close the tab without saving changes?');
    }
  },

  async saveCurrentFile() {
    if (!activeFile || !editor) return;

    const content = editor.getValue();
    try {
      await window.electronAPI.saveFile({
        filePath: activeFile,
        content
      });

      openFiles.set(activeFile, content);

      const tab = this.tabsContainer.querySelector(`[data-path="${activeFile}"]`);
      if (tab) {
        tab.classList.remove('modified');
      }
    } catch (error) {
      console.error('Error saving file:', error);
    }
  },

  getFileIcon(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    const iconMap = {
      'js': 'fas fa-file-code',
      'jsx': 'fas fa-react',
      'ts': 'fas fa-file-code',
      'tsx': 'fas fa-react',
      'html': 'fas fa-file-code',
      'css': 'fas fa-file-code',
      'json': 'fas fa-file-code',
      'md': 'fas fa-file-alt',
      'c': 'fas fa-file-code',
      'cpp': 'fas fa-file-code',
      'h': 'fas fa-file-code',
      'hpp': 'fas fa-file-code'
    };
    return iconMap[extension] || 'fas fa-file';
  },

  getLanguageForFile(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp'
    };
    return languageMap[extension] || 'plaintext';
  },

  loadTabOrder() {
    const tabOrder = JSON.parse(localStorage.getItem('tabOrder')) || [];
    tabOrder.forEach(filePath => {
      const content = openFiles.get(filePath);
      if (content) {
        this.addTab(filePath);
      }
    });
  },

  addContextMenu(tab, filePath) {
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      
      const existingMenu = document.querySelector('.context-menu');
      if (existingMenu) {
        existingMenu.remove();
      }

      const menu = document.createElement('div');
      menu.className = 'context-menu';
      menu.innerHTML = `
        <div class="context-menu-item" data-action="close">
          <i class="fas fa-times"></i> Close
        </div>
        <div class="context-menu-item" data-action="close-others">
          <i class="fas fa-times-circle"></i> Close Others
        </div>
        <div class="context-menu-item" data-action="close-all">
          <i class="fas fa-window-close"></i> Close All
        </div>
        <div class="context-menu-item" data-action="copy-path">
          <i class="fas fa-copy"></i> Copy Path
        </div>
      `;
      
      menu.style.position = 'fixed';
      menu.style.left = `${e.clientX}px`;
      menu.style.top = `${e.clientY}px`;
      
      const handleMenuAction = async (action) => {
        switch(action) {
          case 'close':
            await this.closeTab(filePath);
            break;
          case 'close-others':
            const others = Array.from(openFiles.keys()).filter(path => path !== filePath);
            for (const path of others) {
              await this.closeTab(path);
            }
            break;
          case 'close-all':
            const allFiles = Array.from(openFiles.keys());
            for (const path of allFiles) {
              await this.closeTab(path);
            }
            break;
          case 'copy-path':
            navigator.clipboard.writeText(filePath);
            break;
        }
      };
      

      menu.addEventListener('click', (e) => {
        const action = e.target.closest('.context-menu-item')?.dataset.action;
        if (action) {
          handleMenuAction(action);
        }
        menu.remove();
      });

      document.body.appendChild(menu);
      
      // Close menu when clicking outside
      setTimeout(() => {
        const closeMenu = (e) => {
          if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        };
        document.addEventListener('click', closeMenu);
      }, 0);
    });
    
  }
};

// Function to refresh the file tree
async function refreshFileTree() {
  try {
    // Get the current folder's files without opening dialog
    const result = await window.electronAPI.refreshFolder();
    
    if (result) {
      const fileTree = document.getElementById('file-tree');
      fileTree.innerHTML = '';
      renderFileTree(result.files, fileTree);
      
      // Add refresh animation
      fileTree.style.animation = 'refresh-fade 0.5s ease';
      setTimeout(() => {
        fileTree.style.animation = '';
      }, 500);
    }
  } catch (error) {
    console.error('Error refreshing file tree:', error);
  }
}

// Add this CSS for the refresh animation
const style = document.createElement('style');
style.textContent = `
  @keyframes refresh-fade {
    0% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  #refresh-button {
    transition: transform 0.3s ease;
  }

  #refresh-button.spinning {
    transform: rotate(180deg);
  }

  .file-tree-item {
    width: 100%;
  }

  .file-item {
    display: flex;
    align-items: center;
    padding: 4px 0;
    cursor: pointer;
  }

  .file-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .folder-toggle {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 4px;
    transition: transform 0.2s;
  }

  .folder-content {
    width: 100%;
  }

  .hidden {
    display: none;
  }

  .file-item-icon {
    margin-right: 8px;
  }

  .file-item span {
    margin-left: 4px;
  }
`;
document.head.appendChild(style);

// Initialize Terminal.js
function initializeTerminal() {
  terminal = new Terminal({
    fontSize: 14,
    fontFamily: 'JetBrains Mono, monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4'
    },
    cursorBlink: true
  });
  
  const terminalContainer = document.getElementById('terminal');
  terminal.open(terminalContainer);
  
  // Clear terminal with Ctrl+K
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      terminal.clear();
    }
  });
}

// Utility function to write to terminal with colors
function writeToTerminal(text, type = 'info') {
  if (!terminal) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const colorMap = {
    'info': '\x1b[36m',    // Cyan
    'error': '\x1b[31m',   // Red
    'success': '\x1b[32m', // Green
    'command': '\x1b[33m'  // Yellow
  };
  
  const color = colorMap[type] || colorMap.info;
  terminal.writeln(`${color}[${timestamp}]\x1b[0m ${text}`);
}

// Initialize Monaco Editor
async function initMonaco() {
  require(['vs/editor/editor.main'], function() {
    editor = monaco.editor.create(document.getElementById('monaco-editor'), {
      theme: 'vs-dark',
      language: 'c',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      mouseWheelZoom: true,
      padding: { top: 10 }
    });

    // Add cursor position to status bar
    editor.onDidChangeCursorPosition((e) => {
      const position = editor.getPosition();
      document.getElementById('editorStatus').textContent = 
        `Line ${position.lineNumber}, Column ${position.column}`;
    });


  });
}

// Theme toggle
document.getElementById('themeToggle').addEventListener('click', () => {
  const body = document.body;
  const isDark = body.classList.contains('theme-dark');
  
  body.classList.toggle('theme-dark');
  body.classList.toggle('theme-light');
  
  if (editor) {
    editor.updateOptions({
      theme: isDark ? 'vs' : 'vs-dark'
    });
  }
});

// File tree handling
function renderFileTree(files, container, level = 0) {
  files.forEach(file => {
    const itemWrapper = document.createElement('div');
    itemWrapper.className = 'file-tree-item';
    
    const item = document.createElement('div');
    item.className = 'file-item';
    item.style.paddingLeft = `${level * 20}px`;

    const icon = document.createElement('i');
    
    if (file.type === 'directory') {
      // Add folder icon and collapse/expand icon
      const folderToggle = document.createElement('i');
      folderToggle.className = 'fas fa-chevron-right folder-toggle';
      item.appendChild(folderToggle);
      
      icon.className = 'fas fa-folder file-item-icon';
      
      // Create container for children but hide it initially
      const childContainer = document.createElement('div');
      childContainer.className = 'folder-content hidden';
      
      // Add click handler to toggle visibility
      const toggleFolder = () => {
        childContainer.classList.toggle('hidden');
        folderToggle.classList.toggle('fa-chevron-right');
        folderToggle.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-folder');
        icon.classList.toggle('fa-folder-open');
      };
      
      item.addEventListener('click', toggleFolder);
      
      if (file.children) {
        renderFileTree(file.children, childContainer, level + 1);
      }
      
      itemWrapper.appendChild(item);
      itemWrapper.appendChild(childContainer);
      
    } else {
      icon.className = TabManager.getFileIcon(file.name);
      item.addEventListener('click', () => openFile(file.path));
      itemWrapper.appendChild(item);
    }

    const name = document.createElement('span');
    name.textContent = file.name;
    
    item.appendChild(icon);
    item.appendChild(name);

    container.appendChild(itemWrapper);
  });
}


// File handling
async function openFile(filePath) {
  if (!openFiles.has(filePath)) {
    try {
      const content = await window.electronAPI.readFile(filePath);
      await TabManager.addTab(filePath, content);
    } catch (error) {
      console.error('Error opening file:', error);
      alert(`Failed to open ${filePath}`);
    }
  } else {
    TabManager.activateTab(filePath);
  }
}

function setActiveFile(filePath) {
  if (!editor) return;
  
  const content = openFiles.get(filePath);
  editor.setValue(content);
  activeFile = filePath;
  
  // Update tab state
  const tab = document.querySelector(`.tab[data-path="${filePath}"]`);
  if (tab) {
    TabManager.activateTab(tab);
  }
  
  // Update editor language based on file extension
  const extension = filePath.split('.').pop().toLowerCase();
  const languageMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp'
  };
  const language = languageMap[extension] || 'plaintext';
  editor.getModel()?.dispose();
  editor.setModel(monaco.editor.createModel(content, language));
}


// Initialization
document.addEventListener('DOMContentLoaded', () => {
  TabManager.loadTabOrder(); // Load tab order on initialization
});

document.getElementById('cmmcomp').addEventListener('click', async () => {
  if (!activeFile || compiling) return;
  
  const button = document.getElementById('cmmcomp');
  const icon = button.querySelector('i');
  
  try {
    compiling = true;
    button.disabled = true;
    icon.className = 'fas fa-spinner fa-spin';
    
    const content = editor.getValue();
    const inputDir = activeFile.substring(0, activeFile.lastIndexOf('\\') + 1);
    const inputFile = activeFile.split('\\').pop();
    
    writeToTerminal('Starting CMM compilation...', 'command');
    writeToTerminal(`Input file: ${inputFile}`, 'info');
    writeToTerminal(`Working directory: ${inputDir}`, 'info');
    
    const result = await window.electronAPI.compile({
      compiler: '/compilers/cmmcomp.exe',
      content: content,
      filePath: activeFile,
      workingDir: inputDir,
      // Specify output path in the same directory as input
      outputPath: inputDir
    });
    
    if (result.stderr) {
      // Split error messages by line and write them individually
      result.stderr.split('\n').forEach(line => {
        if (line.trim()) {
          writeToTerminal(line, 'error');
        }
      });
    }
    
    if (result.stdout) {
      // Split success messages by line and write them individually
      result.stdout.split('\n').forEach(line => {
        if (line.trim()) {
          writeToTerminal(line, 'success');
        }
      });
    }
    
    writeToTerminal('CMM compilation finished.', 'info');
    
  } catch (error) {
    console.error('Compilation error:', error);
    writeToTerminal(`Compilation error: ${error.message}`, 'error');
  } finally {
    compiling = false;
    button.disabled = false;
    icon.className = 'fas fa-code';
  }
});

// Update the ASM compiler event listener
document.getElementById('asmcomp').addEventListener('click', async () => {
  if (!activeFile || compiling) return;
  
  const button = document.getElementById('asmcomp');
  const icon = button.querySelector('i');
  
  try {
    compiling = true;
    button.disabled = true;
    icon.className = 'fas fa-spinner fa-spin';
    
    const content = editor.getValue();
    const inputDir = activeFile.substring(0, activeFile.lastIndexOf('\\') + 1);
    const inputFile = activeFile.split('\\').pop();
    
    writeToTerminal('Starting ASM compilation...', 'command');
    writeToTerminal(`Input file: ${inputFile}`, 'info');
    writeToTerminal(`Working directory: ${inputDir}`, 'info');
    
    const result = await window.electronAPI.compile({
      compiler: '/compilers/asmcomp.exe',
      content: content,
      filePath: activeFile,
      workingDir: inputDir,
      // Specify output path in the same directory as input
      outputPath: inputDir
    });
    
    if (result.stderr) {
      // Split error messages by line and write them individually
      result.stderr.split('\n').forEach(line => {
        if (line.trim()) {
          writeToTerminal(line, 'error');
        }
      });
    }
    
    if (result.stdout) {
      // Split success messages by line and write them individually
      result.stdout.split('\n').forEach(line => {
        if (line.trim()) {
          writeToTerminal(line, 'success');
        }
      });
    }
    
    writeToTerminal('ASM compilation finished.', 'info');
    
  } catch (error) {
    console.error('Compilation error:', error);
    writeToTerminal(`Compilation error: ${error.message}`, 'error');
  } finally {
    compiling = false;
    button.disabled = false;
    icon.className = 'fas fa-microchip';
  }
});

// Initialize everything
// Update the window.onload to include the refresh button initialization
window.onload = () => {
  initMonaco();
  
  TabManager.init();
  
  // Existing event listeners
  document.getElementById('openFolderBtn').addEventListener('click', async () => {
    const result = await window.electronAPI.openFolder();
    if (result) {
      const fileTree = document.getElementById('file-tree');
      fileTree.innerHTML = '';
      renderFileTree(result.files, fileTree);
    }
  });
  
  document.getElementById('saveFileBtn').addEventListener('click', () => TabManager.saveCurrentFile());

  // Add refresh button event listener
  const refreshButton = document.getElementById('refresh-button');
  refreshButton.addEventListener('click', async () => {
    // Add spinning animation
    refreshButton.classList.add('spinning');
    
    // Disable the button temporarily
    refreshButton.style.pointerEvents = 'none';
    
    await refreshFileTree();
    
    // Remove spinning animation and re-enable button
    setTimeout(() => {
      refreshButton.classList.remove('spinning');
      refreshButton.style.pointerEvents = 'auto';
    }, 300);
  });
};

const verticalResizer = document.querySelector('.resizer-vertical');
const horizontalResizer = document.querySelector('.resizer-horizontal');
const fileTreeContainer = document.querySelector('.file-tree-container');
const terminalContainer = document.querySelector('.terminal-container');
const editorContainer = document.querySelector('.editor-container');

// Redimensionamento horizontal (file-tree)
verticalResizer.addEventListener('mousedown', (event) => {
  event.preventDefault();
  
  document.addEventListener('mousemove', resizeFileTree);
  document.addEventListener('mouseup', stopResize);
});

function resizeFileTree(event) {
  fileTreeContainer.style.width = `${event.clientX}px`;
}

function stopResize() {
  document.removeEventListener('mousemove', resizeFileTree);
  document.removeEventListener('mouseup', stopResize);
}

// Redimensionamento vertical (terminal)
horizontalResizer.addEventListener('mousedown', (event) => {
  event.preventDefault();
  
  document.addEventListener('mousemove', resizeTerminal);
  document.addEventListener('mouseup', stopTerminalResize);
});

function resizeTerminal(event) {
  const height = window.innerHeight - event.clientY + 1; // Ajuste baseado na altura da status bar e toolbar
  terminalContainer.style.height = `${height}px`;
  editorContainer.style.flex = `1 1 ${window.innerHeight - height}px`;
}

function stopTerminalResize() {
  document.removeEventListener('mousemove', resizeTerminal);
  document.removeEventListener('mouseup', stopTerminalResize);
}

// Adicione estes estilos ao seu CSS existente
const newStyle = document.createElement('style');
newStyle.textContent = `
  .toolbar-icon {
    cursor: pointer;
    margin: 0 8px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .toolbar-icon:hover {
    opacity: 1;
  }

  .info-box {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--background-darker, #1e1e1e);
    border: 1px solid var(--border-color, #404040);
    border-radius: 8px;
    padding: 20px;
    max-width: 500px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .info-box h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: var(--text-color, #ffffff);
  }

  .info-box ul {
    margin: 0;
    padding-left: 20px;
  }

  .info-box li {
    margin-bottom: 8px;
    color: var(--text-color, #ffffff);
  }

  .info-box-close {
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .info-box-close:hover {
    opacity: 1;
  }

  .explorer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
  }

  .explorer-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;
document.head.appendChild(newStyle);

// Modificar o HTML do Explorer
const explorerHeader = document.querySelector('.explorer-header') || document.createElement('div');
explorerHeader.className = 'explorer-header';
explorerHeader.innerHTML = `
  <div class="explorer-title">
    <span>Explorer</span>
  </div>
  <i class="fas fa-folder toolbar-icon" id="openExplorerFolder" title="Open in File Explorer"></i>
`;

// Adicionar ícones na toolbar
const themeToggle = document.getElementById('themeToggle');
const toolbarIcons = document.createElement('div');
toolbarIcons.style.display = 'flex';
toolbarIcons.style.alignItems = 'center';
toolbarIcons.innerHTML = `
  <i class="fas fa-globe toolbar-icon" id="websiteLink" title="Visit Website"></i>
  <i class="fas fa-info-circle toolbar-icon" id="showInfo" title="Keyboard Shortcuts"></i>
`;
themeToggle.parentNode.insertBefore(toolbarIcons, themeToggle.nextSibling);

// Função para criar e mostrar o box de informações
function showInfoBox() {
  const infoBox = document.getElementById('infoBox');
  infoBox.classList.add('visible');
  infoBox.classList.remove('hidden');

  // Reposition the info box in the center
  const infoBoxHeight = infoBox.offsetHeight;
  const viewportHeight = window.innerHeight;
  if (infoBoxHeight > viewportHeight * 0.8) {
    infoBox.style.top = `${viewportHeight / 2}px`;
    infoBox.style.transform = 'translate(-50%, -50%)';
  }
}

function closeInfoBox() {
  const infoBox = document.getElementById('infoBox');
  infoBox.classList.remove('visible');
  setTimeout(() => {
    infoBox.classList.add('hidden');
  }, 300);
}


// Close the info box when clicking outside it
document.addEventListener('click', (e) => {
  const infoBox = document.getElementById('infoBox');
  if (!infoBox.classList.contains('hidden') && !infoBox.contains(e.target) && e.target.id !== 'showInfo') {
    closeInfoBox();
  }
});


// Event listeners para os novos botões
document.getElementById('openExplorerFolder').addEventListener('click', async () => {
  const currentPath = await window.electronAPI.getCurrentFolder();
  if (currentPath) {
    await window.electronAPI.openInExplorer(currentPath);
  }
});

const websiteLink = document.getElementById('websiteLink');
if (websiteLink) {
  websiteLink.addEventListener('click', () => {
    window.open('https://nipscern.com', '_blank');
  });
}

document.getElementById('showInfo').addEventListener('click', showInfoBox);

const aiAssistantToggle = document.getElementById('aiAssistantToggle');
const aiAssistant = document.getElementById('aiAssistant');


aiAssistantToggle.addEventListener('click', () => {
  const isOpen = aiAssistant.classList.toggle('open');
  aiAssistantToggle.classList.toggle('active', isOpen);
  
  // Ajusta a largura da seção de IA e do editor
  aiAssistant.style.width = isOpen ? '30%' : '0';
  editorContainer.style.width = isOpen ? '70%' : '100%';
  terminalContainer.style.width = isOpen ? '70%' : '100%';
});


// Add the button to the toolbar (add this where other toolbar buttons are defined)
const processorHubButton = document.createElement('button');
processorHubButton.className = 'toolbar-button';
processorHubButton.innerHTML = '<i class="fas fa-microchip"></i> Processor Hub';
processorHubButton.title = 'Create New Processor Project';
document.querySelector('.toolbar').appendChild(processorHubButton);

// Add styles
const processorHubStyles = document.createElement('style');
processorHubStyles.textContent = `
  .processor-hub-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--background-darker, #1e1e1e);
    border: 1px solid var(--border-color, #404040);
    border-radius: 12px;
    padding: 24px;
    width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    z-index: 1001;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .processor-hub-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .processor-hub-modal h2 {
    margin: 0 0 20px 0;
    color: var(--text-color, #ffffff);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .processor-hub-form {
    display: grid;
    gap: 16px;
  }

  .form-group {
    display: grid;
    gap: 8px;
  }

  .form-group label {
    color: var(--text-color, #ffffff);
    font-size: 14px;
  }

  .form-group input,
  .form-group select {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-color, #404040);
    background: var(--background-darker, #2d2d2d);
    color: var(--text-color, #ffffff);
    font-size: 14px;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--accent-color, #007acc);
  }

  .button-group {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
  }

  .processor-hub-modal button {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button {
    background: var(--background-darker, #2d2d2d);
    color: var(--text-color, #ffffff);
  }

  .generate-button {
    background: var(--accent-color, #007acc);
    color: white;
  }

  .generate-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .generate-button:not(:disabled):hover {
    background: var(--accent-color-hover, #0098ff);
  }

  .cancel-button:hover {
    background: var(--background-lighter, #3d3d3d);
  }
`;
document.head.appendChild(processorHubStyles);

// Add the modal HTML function
function createProcessorHubModal() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="processor-hub-overlay"></div>
    <div class="processor-hub-modal">
      <h2><i class="fas fa-microchip"></i> Create Processor Project</h2>
      <form class="processor-hub-form" id="processorHubForm">
        <div class="form-group">
          <label for="projectName">Project Name</label>
          <input type="text" id="projectName" required>
        </div>
        <div class="form-group">
          <label for="projectLocation">Project Location</label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="projectLocation" required readonly>
            <button type="button" id="browseLocation" style="white-space: nowrap;">
              <i class="fas fa-folder-open"></i> Browse
            </button>
          </div>
        </div>
        <div class="form-group">
          <label for="processorName">Processor Name</label>
          <input type="text" id="processorName" required>
        </div>
        <div class="form-group">
          <label for="pointType">Point Type</label>
          <select id="pointType" required>
            <option value="fixed">Fixed Point</option>
            <option value="floating">Floating Point</option>
          </select>
        </div>
        <div class="form-group">
          <label for="nBits">N Bits</label>
          <input type="number" id="nBits" required min="1">
        </div>
        <div class="form-group floating-point-options" style="display: none;">
          <label for="nbMantissa">Nb Mantissa</label>
          <input type="number" id="nbMantissa" min="1">
        </div>
        <div class="form-group floating-point-options" style="display: none;">
          <label for="nbExponent">Nb Exponent</label>
          <input type="number" id="nbExponent" min="1">
        </div>
        <div class="form-group">
          <label for="dataStackSize">Data Stack Size</label>
          <input type="number" id="dataStackSize" required min="1">
        </div>
        <div class="form-group">
          <label for="instructionStackSize">Instruction Stack Size</label>
          <input type="number" id="instructionStackSize" required min="1">
        </div>
        <div class="form-group">
          <label for="inputPorts">Number of Input Ports</label>
          <input type="number" id="inputPorts" required min="0">
        </div>
        <div class="form-group">
          <label for="outputPorts">Number of Output Ports</label>
          <input type="number" id="outputPorts" required min="0">
        </div>
        <div class="form-group">
          <label for="gain">Gain</label>
          <input type="number" id="gain" required step="any">
        </div>
        <div class="button-group">
          <button type="button" class="cancel-button" id="cancelProcessorHub">Cancel</button>
          <button type="submit" class="generate-button" id="generateProcessor" disabled>
            <i class="fas fa-cog"></i> Generate
          </button>
        </div>
      </form>
    </div>
  `;
  return modal;
}

// Add the event handlers
processorHubButton.addEventListener('click', () => {
  const modal = createProcessorHubModal();
  document.body.appendChild(modal);

  const form = document.getElementById('processorHubForm');
  const generateButton = document.getElementById('generateProcessor');
  const pointTypeSelect = document.getElementById('pointType');
  const floatingPointOptions = document.querySelectorAll('.floating-point-options');
  
  // Handle point type change
  pointTypeSelect.addEventListener('change', () => {
    const isFloating = pointTypeSelect.value === 'floating';
    floatingPointOptions.forEach(option => {
      option.style.display = isFloating ? 'grid' : 'none';
      option.querySelector('input').required = isFloating;
    });
  });

  // Handle browse button
  document.getElementById('browseLocation').addEventListener('click', async () => {
    const result = await window.electronAPI.selectDirectory();
    if (result) {
      document.getElementById('projectLocation').value = result;
    }
  });

  // Handle form validation
  form.addEventListener('input', () => {
    const isValid = form.checkValidity();
    generateButton.disabled = !isValid;
  });

  // Handle generate button
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      projectName: document.getElementById('projectName').value,
      projectLocation: document.getElementById('projectLocation').value,
      processorName: document.getElementById('processorName').value,
      pointType: document.getElementById('pointType').value,
      nBits: document.getElementById('nBits').value,
      nbMantissa: document.getElementById('nbMantissa').value,
      nbExponent: document.getElementById('nbExponent').value,
      dataStackSize: document.getElementById('dataStackSize').value,
      instructionStackSize: document.getElementById('instructionStackSize').value,
      inputPorts: document.getElementById('inputPorts').value,
      outputPorts: document.getElementById('outputPorts').value,
      gain: document.getElementById('gain').value
    };

    try {
      // Create project structure
      await window.electronAPI.createProcessorProject(formData);
      
      // Close modal
      modal.remove();
      
      // Refresh file tree
      await refreshFileTree();
      
      // Show success message
      writeToTerminal('Processor project created successfully!', 'success');
    } catch (error) {
      console.error('Error creating processor project:', error);
      writeToTerminal(`Error creating processor project: ${error.message}`, 'error');
    }
  });

  // Handle cancel button
  document.getElementById('cancelProcessorHub').addEventListener('click', () => {
    modal.remove();
  });

  // Handle click outside modal
  modal.querySelector('.processor-hub-overlay').addEventListener('click', () => {
    modal.remove();
  });
});