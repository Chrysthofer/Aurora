let editor;
let openFiles = new Map();
let activeFile = null;


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