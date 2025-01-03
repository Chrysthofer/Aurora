let editor;
let openFiles = new Map();
let activeFile = null;
let compiling = false;
let terminal = null;
let aiAssistantVisible = false;
let aiAssistantContainer = null;
let currentProvider = 'chatgpt'; // or 'claude'

// SHOW DIALOG =====================================================================================================================
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
      <div class="confirm-dialog">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="dialog-buttons">
          <button id="cancelButton">Cancel</button>
          <button id="confirmButton">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    dialog.showModal();

    const confirmButton = dialog.querySelector('#confirmButton');
    const cancelButton = dialog.querySelector('#cancelButton');

    confirmButton.onclick = () => {
      dialog.close();
      dialog.remove();
      resolve(true);
    };

    cancelButton.onclick = () => {
      dialog.close();
      dialog.remove();
      resolve(false);
    };
  });
}
//MONACO EDITOR ========================================================================================================================================================

async function initMonaco() {
    require(['vs/editor/editor.main'], function() {
        editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            theme: 'vs-dark',
            language: 'c',
            automaticLayout: true,
            minimap: {
                enabled: true
            },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            mouseWheelZoom: true,
            padding: {
                top: 10
            }
        });

         // Initialize tabs
         initTabs();

        // Add cursor position to status bar
        editor.onDidChangeCursorPosition((e) => {
            const position = editor.getPosition();
            document.getElementById('editorStatus').textContent =
                `Line ${position.lineNumber}, Column ${position.column}`;
        });


    });
}

//TAB MANAGER ========================================================================================================================================================

class TabManager {
  static tabs = new Map(); // Store tab information
  static activeTab = null;
  static editorStates = new Map();
  static unsavedChanges = new Set(); // Track files with unsaved changes
  static initialContents = new Map(); // Track initial content of files


// Rename saveFile to saveCurrentFile for consistency
static async saveCurrentFile() {
  const currentPath = this.activeTab;
  if (!currentPath) return;

  try {
    const content = editor.getValue();
    await window.electronAPI.writeFile(currentPath, content);
    this.markFileAsSaved(currentPath);
    // Update initial content after successful save
    this.initialContents.set(currentPath, content);
    writeToTerminal(`File saved: ${currentPath}`, 'success');
  } catch (error) {
    console.error('Error saving file:', error);
    writeToTerminal(`Error saving file: ${error.message}`, 'error');
  }
}


// Add these methods to mark files as modified/saved
static markFileAsModified(filePath) {
  if (!filePath) return;
  
  this.unsavedChanges.add(filePath);
  const tab = document.querySelector(`.tab[data-path="${CSS.escape(filePath)}"]`);
  if (tab) {
    const closeButton = tab.querySelector('.close-tab');
    closeButton.innerHTML = '•';
    closeButton.style.color = '#ffd700'; // Gold color for unsaved changes
    closeButton.style.fontSize = '20px';
  }
}

static markFileAsSaved(filePath) {
  if (!filePath) return;
  
  this.unsavedChanges.delete(filePath);
  const tab = document.querySelector(`.tab[data-path="${CSS.escape(filePath)}"]`);
  if (tab) {
    const closeButton = tab.querySelector('.close-tab');
    closeButton.innerHTML = '×';
    closeButton.style.color = ''; // Reset to default color
    closeButton.style.fontSize = ''; // Reset to default size
  }
}

  // Add this method to save editor state
  static saveEditorState(filePath) {
    if (!editor || !filePath) return;
    
    const state = {
        selections: editor.getSelections(),
        viewState: editor.saveViewState(),
        scrollPosition: {
            top: editor.getScrollTop(),
            left: editor.getScrollLeft()
        }
    };
    
    this.editorStates.set(filePath, state);
}


// Add this method to restore editor state
static restoreEditorState(filePath) {
    if (!editor || !filePath) return;
    
    const state = this.editorStates.get(filePath);
    if (state) {
        // Restore view state (includes scroll position and folded code sections)
        if (state.viewState) {
            editor.restoreViewState(state.viewState);
        }
        
        // Restore selections
        if (state.selections && state.selections.length > 0) {
            editor.setSelections(state.selections);
        }
    }
}

  static getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const iconMap = {
      'js': 'fab fa-js',
      'jsx': 'fab fa-react',
      'ts': 'fab fa-js',
      'tsx': 'fab fa-react',
      'html': 'fab fa-html5',
      'css': 'fab fa-css3',
      'json': 'fas fa-code',
      'md': 'fab fa-markdown',
      'py': 'fab fa-python',
      'c': 'fas fa-code',
      'cpp': 'fas fa-code',
      'h': 'fas fa-code',
      'hpp': 'fas fa-code'
    };
    return iconMap[extension] || 'fas fa-file';
  }

  static addTab(filePath, content) {
    const tabContainer = document.querySelector('#tabs-container');
    if (!tabContainer) {
        console.error('Error: #tabs-container not found in DOM.');
        return;
    }

    // Store initial content
    this.initialContents.set(filePath, content);

    // Add model change listener
    const model = editor.getModel();
    if (model) {
      let isFirstChange = true;
      model.onDidChangeContent(() => {
        // Only check for real changes
        const currentContent = editor.getValue();
        const originalContent = this.initialContents.get(this.activeTab);
        
        if (currentContent !== originalContent) {
          this.markFileAsModified(this.activeTab);
        } else {
          this.markFileAsSaved(this.activeTab);
        }
      });
    }

    // Create tab
    const tab = document.createElement('div');
    tab.classList.add('tab');
    tab.setAttribute('data-path', filePath);
    tab.setAttribute('draggable', 'true'); // Make tab draggable

    tab.setAttribute('title', filePath); // Caminho completo será exibido como dica de ferramenta

    // Create tab content with icon, name, and close button
    tab.innerHTML = `
        <i class="${this.getFileIcon(filePath.split('\\').pop())}"></i>
        <span class="tab-name">${filePath.split('\\').pop()}</span>
        <button class="close-tab" title="Close">×</button>
    `;

    // Add drag and drop event listeners
    this.addDragListeners(tab);

    // Add click events (your existing click handlers)
    tab.addEventListener('click', () => this.activateTab(filePath));
    const closeBtn = tab.querySelector('.close-tab');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(filePath);
    });

    // Add to container
    tabContainer.appendChild(tab);
    this.tabs.set(filePath, content);
    this.activateTab(filePath);
    
  }

  static addDragListeners(tab) {
    tab.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', tab.getAttribute('data-path'));
      tab.classList.add('dragging');
  
      // Desativa a transição para todas as abas
      const tabContainer = tab.parentElement;
      if (tabContainer) {
        tabContainer.classList.add('dragging');
      }
    });
  
    tab.addEventListener('dragend', () => {
      tab.classList.remove('dragging');
  
      // Reativa a transição para todas as abas
      const tabContainer = tab.parentElement;
      if (tabContainer) {
        tabContainer.classList.remove('dragging');
      }
    });
  
    tab.addEventListener('dragover', (e) => {
      e.preventDefault();
      const draggingTab = document.querySelector('.tab.dragging');
      if (draggingTab && draggingTab !== tab) {
        const tabContainer = tab.parentElement;
        const rect = tab.getBoundingClientRect();
        const afterElement = (e.clientX - rect.left) > (rect.width / 2);
  
        if (afterElement) {
          tab.after(draggingTab);
        } else {
          tab.before(draggingTab);
        }
      }
    });
  }
  


// Modify your existing activateTab method
static activateTab(filePath) {
  // Save the state of the current tab before switching
  if (this.activeTab) {
      this.saveEditorState(this.activeTab);
  }

  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => tab.classList.remove('active'));

  const activeTab = document.querySelector(`.tab[data-path="${CSS.escape(filePath)}"]`);
  if (activeTab) {
      activeTab.classList.add('active');
      this.activeTab = filePath;
      window.activeTab = this.activeTab;  // Salve no objeto global window

      // Update editor content
      this.updateEditorContent(filePath);
      
      // Restore the state of the new tab
      this.restoreEditorState(filePath);
  }
}


  static async closeTab(filePath) {
    if (this.unsavedChanges.has(filePath)) {
      const result = await showConfirmDialog(
        'Unsaved Changes',
        'This file has unsaved changes. Do you want to save before closing?'
      );
      
      if (result) {
        await this.saveCurrentFile();
      }
    }

    const tab = document.querySelector(`.tab[data-path="${CSS.escape(filePath)}"]`);
    if (!tab) return;

    // Remove the tab element
    tab.remove();
    this.editorStates.delete(filePath);
    
    // Remove from our tabs map
    this.tabs.delete(filePath);
    this.unsavedChanges.delete(filePath);
    this.initialContents.delete(filePath); // Clean up initial content


    // If we're closing the active tab
    if (this.activeTab === filePath) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
          this.activateTab(remainingTabs[0]);
      } else {
          this.activeTab = null;
          if (editor) {
              editor.getModel()?.dispose();
              editor.setModel(monaco.editor.createModel('', 'plaintext'));
          }
      }
  }
}

// Add this method to save the current file
static async saveFile(filePath = null) {
  const currentPath = filePath || this.activeTab;
  if (!currentPath) return;

  try {
    const content = editor.getValue();
    await window.electronAPI.writeFile(currentPath, content);
    this.markFileAsSaved(currentPath);
    writeToTerminal(`File saved: ${currentPath}`, 'success');
  } catch (error) {
    console.error('Error saving file:', error);
    writeToTerminal(`Error saving file: ${error.message}`, 'error');
  }
}
  
  static updateEditorContent(filePath) {
    const content = this.tabs.get(filePath); // Obtém o conteúdo da aba ativa
    if (editor && content !== undefined) {
        // Atualiza o conteúdo do Monaco Editor
        editor.setValue(content);

        // Determina a linguagem do arquivo com base na extensão
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
            'py': 'python',
            'c': 'c',
            'cpp': 'cpp',
            'h': 'c',
            'hpp': 'cpp'
        };
        const language = languageMap[extension] || 'plaintext';

        // Atualiza o modelo do Monaco Editor com o novo conteúdo e linguagem
        editor.getModel()?.dispose();
        editor.setModel(monaco.editor.createModel(content, language));
    } else {
        console.error(`No content found for ${filePath}`);
    }
}

}

// Initialize tab container
function initTabs() {
  
  const editorContainer = document.getElementById('monaco-editor').parentElement;
  const tabsContainer = document.createElement('div');
  if (document.getElementById('editor-tabs')) return;

  tabsContainer.id = 'editor-tabs';
  editorContainer.insertBefore(tabsContainer, editorContainer.firstChild);
}

// Add this to your window.onload or initialization code
window.addEventListener('load', () => {
  initTabs();

});

function initializeSaveSystem() {
  // Add save button click handler
  document.getElementById('saveFileBtn').addEventListener('click', () => {
    TabManager.saveCurrentFile();
  });

  // Add keyboard shortcut for save (Ctrl+Shift+S)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      TabManager.saveCurrentFile();
    }
  });
}

//FILETREE ============================================================================================================================================================

// Update refreshFileTree function
async function refreshFileTree() {
  try {
    if (!currentProjectPath) {
      console.warn('No project is currently open');
      return;
    }

    const result = await window.electronAPI.refreshFolder(currentProjectPath);
    if (result) {
      updateFileTree(result.files);
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
          const folderToggle = document.createElement('i');
          folderToggle.className = 'fas fa-chevron-right folder-toggle';
          item.appendChild(folderToggle);

          icon.className = 'fas fa-folder file-item-icon';

          const childContainer = document.createElement('div');
          childContainer.className = 'folder-content hidden';

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
// Single openFile function
async function openFile(filePath) {
  if (!TabManager.tabs.has(filePath)) {
      try {
          const content = await window.electronAPI.readFile(filePath);
          await TabManager.addTab(filePath, content);
      } catch (error) {
          console.error('Error opening file:', error);
          alert(`Failed to open ${filePath}`);
      }
  } else {
      TabManager.activateTab(filePath); // Ativar a aba se já estiver aberta
  }
}


function setActiveFile(filePath) {
  if (!editor) return;

  // Obter conteúdo do arquivo
  const content = openFiles.get(filePath);
  if (!content) return;

  // Atualizar conteúdo do Monaco Editor
  editor.setValue(content);
  activeFile = filePath;

  // Atualizar linguagem com base na extensão
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
      'py': 'python',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp'
  };
  const language = languageMap[extension] || 'plaintext';
  editor.getModel()?.dispose();
  editor.setModel(monaco.editor.createModel(content, language));

  // Atualizar o estado da aba
  const tab = document.querySelector(`.tab[data-path="${filePath}"]`);
  if (tab) {
      // Ativar a aba clicada
      TabManager.activateTab(filePath);  // Alteração: Passe diretamente o filePath aqui
  }
}


//PROJECT BUTTON ==========================================================================================================================================================

let currentProjectPath = null; // Store the current project path
let currentSpfPath = null;

// Update your existing openProject button handler
document.getElementById('openProjectBtn').addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.showOpenDialog();
    
    if (!result.canceled && result.filePaths.length > 0) {
      currentProjectPath = result.filePaths[0];
      await loadProject(currentProjectPath);
    }
  } catch (error) {
    //console.error('Error opening project:', error);
  }
});

// Add this button to your HTML
const projectInfoButton = document.createElement('button');
projectInfoButton.className = 'toolbar-button';
projectInfoButton.innerHTML = `
  <i class="fa-solid fa-circle-info"></i>
  <span>Project Info</span>
`;


// Add it next to your openProjectBtn
document.getElementById('openProjectBtn').insertAdjacentElement('afterend', projectInfoButton);

// Add click handler for the info button
// Update project info button handler
projectInfoButton.addEventListener('click', async () => {
  try {
    if (!currentSpfPath) {
      showErrorDialog('Error', 'No project is currently open');
      return;
    }

    // Ensure we're using the .spf file path
    if (!currentSpfPath.endsWith('.spf')) {
      // If we somehow have the project directory, construct the .spf path
      const projectName = path.basename(currentProjectPath);
      currentSpfPath = path.join(currentProjectPath, `${projectName}.spf`);
    }

    console.log('Getting project info from SPF:', currentSpfPath);
    const projectData = await window.electronAPI.getProjectInfo(currentSpfPath);
    showProjectInfoDialog(projectData);
  } catch (error) {
    console.error('Error getting project info:', error);
    showErrorDialog('Error', 'Failed to load project information: ' + error.message);
  }
});

// Function to show project info in a modal dialog
function showProjectInfoDialog(projectData) {
  const dialog = document.createElement('dialog');
  dialog.style.cssText = `
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #ccc;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    max-width: 500px;
    background: var(--background-color, #fff);
    color: var(--text-color, #000);
  `;

  const metadata = projectData.metadata;
  const folderStatus = projectData.structure.folders
    .map(folder => `
      <div style="margin: 5px 0;">
        <span>${folder.path}</span>
        <span style="color: ${folder.exists ? '#4CAF50' : '#F44336'}">
          ${folder.exists ? '<i class="fa-solid fa-check" style="color: #4dff00;"></i>' : '<i class="fa-solid fa-x" style="color: #ff0000;"></i>'}
        </span>
      </div>
    `)
    .join('');

  dialog.innerHTML = `
    <div style="position: relative;">
      <h2 style="margin-top: 0;">Project Information</h2>
      <button id="closeDialog" style="
        position: absolute;
        top: 0;
        right: 0;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 20px;
      ">×</button>
      
      <div style="margin: 15px 0;">
        <h3>Project Details</h3>
        <p><strong>Name:</strong> ${metadata.projectName}</p>
        <p><strong>Created:</strong> ${new Date(metadata.createdAt).toLocaleString()}</p>
        <p><strong>Last Modified:</strong> ${new Date(metadata.lastModified).toLocaleString()}</p>
        <p><strong>Computer:</strong> ${metadata.computerName}</p>
        <p><strong>App Version:</strong> ${metadata.appVersion}</p>
      </div>

      <div style="margin: 15px 0;">
        <h3>Project Structure</h3>
        ${folderStatus}
      </div>
    </div>
  `;

  const closeButton = dialog.querySelector('#closeDialog');
  closeButton.onclick = () => dialog.close();

  // Close on click outside
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  document.body.appendChild(dialog);
  dialog.showModal();
}

// Update loadProject function to store the current project path
async function loadProject(spfPath) {
  try {
    const result = await window.electronAPI.openProject(spfPath);
    currentProjectPath = result.projectData.structure.basePath;

    console.log('Loading project from SPF:', spfPath);
    
    // Store both paths
    currentProjectPath = result.projectData.structure.basePath;
    currentSpfPath = spfPath; // This is the actual .spf file path
    
    console.log('Current SPF path:', currentSpfPath);
    console.log('Current project path:', currentProjectPath);
    
    // Check if folders exist
    const missingFolders = result.projectData.structure.folders.filter(folder => !folder.exists);
    if (missingFolders.length > 0) {
      const shouldRecreate = await showConfirmDialog(
        'Missing Folders',
        'Some project folders are missing. Would you like to recreate them?'
      );
      
      if (shouldRecreate) {
        const newResult = await window.electronAPI.createStructure(
          result.projectData.structure.basePath,
          spfPath
        );
        // Update file tree with recreated structure
        updateFileTree(newResult.files);
      } else {
        // Update file tree with current structure
        updateFileTree(result.files);
      }
    } else {
      // Update file tree with current structure
      updateFileTree(result.files);
    }

    // Update UI with project info
    updateProjectInfo(result.projectData.metadata);

  } catch (error) {
    //console.error('Error loading project:', error);
    showErrorDialog('Failed to load project', error.message);
  }
}

// Function to update file tree
function updateFileTree(files) {
  const fileTree = document.getElementById('file-tree');
  fileTree.innerHTML = '';
  renderFileTree(files, fileTree);

  // Add refresh animation
  fileTree.style.animation = 'refresh-fade 0.5s ease';
  setTimeout(() => {
    fileTree.style.animation = '';
  }, 500);
}

//PROCESSADOR HUB ==========================================================================================================================================================

// Add the button to the toolbar (add this where other toolbar buttons are defined)
const processorHubButton = document.createElement('button');
processorHubButton.className = 'toolbar-button';
processorHubButton.innerHTML = '<i class="fas fa-microchip"></i> Processor Hub';
processorHubButton.title = 'Create New Processor Project';
document.querySelector('.toolbar').appendChild(processorHubButton);

// Add the modal HTML function
function createProcessorHubModal() {
    const modal = document.createElement('div');
    modal.innerHTML = `
    <div class="processor-hub-overlay"></div>
    <div class="processor-hub-modal">
      <h2><i class="fas fa-microchip"></i> Create Processor Project</h2>
      <form class="processor-hub-form" id="processorHubForm">
        <div class="form-group">
          <label for="processorName">Processor Name</label>
          <input type="text" id="processorName" required value="procTest">
        </div>
        <div class="form-group">
          <label for="pointType">Point Type</label>
          <select id="pointType" required>
            <option value="fixed">Fixed Point</option>
            <option value="floating" selected>Floating Point</option>
          </select>
        </div>
        <div class="form-group">
        <label for="nBits">Number of Bits <span class="tooltip" style="color: red;" title="Number of Bits must equal Nb Mantissa + Nb Exponent + 1">ℹ</span></label>

          <input type="number" id="nBits" required min="1" value="32">
        </div>
        <div class="form-group floating-point-options">
          <label for="nbMantissa">Nb Mantissa</label>
          <input type="number" id="nbMantissa" min="1" value="23">
        </div>
        <div class="form-group floating-point-options">
          <label for="nbExponent">Nb Exponent</label>
          <input type="number" id="nbExponent" min="1" value="8">
        </div>
        <div class="form-group">
          <label for="dataStackSize">Data Stack Size</label>
          <input type="number" id="dataStackSize" required min="1" value="5">
        </div>
        <div class="form-group">
          <label for="instructionStackSize">Instruction Stack Size</label>
          <input type="number" id="instructionStackSize" required min="1" value="5">
        </div>
        <div class="form-group">
          <label for="inputPorts">Number of Input Ports</label>
          <input type="number" id="inputPorts" required min="0" value="2">
        </div>
        <div class="form-group">
          <label for="outputPorts">Number of Output Ports</label>
          <input type="number" id="outputPorts" required min="0" value="2">
        </div>
        <div class="form-group">
          <label for="gain">Gain <span class="tooltip" style="color: red;" title="Gain must be a power of 2">ℹ</span></label>
          <input type="number" id="gain" required step="any" value="2">
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
    const nBitsInput = document.getElementById('nBits');
    const nbMantissaInput = document.getElementById('nbMantissa');
    const nbExponentInput = document.getElementById('nbExponent');
    const gainInput = document.getElementById('gain');

    // Helper function to check if a number is a power of 2
    function isPowerOfTwo(value) {
        return value > 0 && (value & (value - 1)) === 0;
    }

    // Real-time validation for custom rules
    function validateCustomRules() {
        const nBits = parseInt(nBitsInput.value) || 0;
        const nbMantissa = parseInt(nbMantissaInput.value) || 0;
        const nbExponent = parseInt(nbExponentInput.value) || 0;
        const gain = parseInt(gainInput.value) || 0;

        const isNBitsValid = nBits === nbMantissa + nbExponent + 1;
        const isGainValid = isPowerOfTwo(gain);

        // Apply custom validation
        nBitsInput.setCustomValidity(isNBitsValid ? '' : 'Number of Bits must equal Nb Mantissa + Nb Exponent + 1');
        gainInput.setCustomValidity(isGainValid ? '' : 'Gain must be a power of 2');

        // Update the generate button's state
        generateButton.disabled = !form.checkValidity();
    }

    // Initialize point type options visibility
    pointTypeSelect.addEventListener('change', () => {
        const isFloating = pointTypeSelect.value === 'floating';
        floatingPointOptions.forEach(option => {
            option.style.display = isFloating ? 'grid' : 'none';
            option.querySelector('input').required = isFloating;
        });
        validateCustomRules();
    });

    // Attach real-time validation to relevant inputs
    [nBitsInput, nbMantissaInput, nbExponentInput, gainInput].forEach(input => {
        input.addEventListener('input', validateCustomRules);
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            processorName: document.getElementById('processorName').value,
            pointType: pointTypeSelect.value,
            nBits: nBitsInput.value,
            nbMantissa: nbMantissaInput.value,
            nbExponent: nbExponentInput.value,
            dataStackSize: document.getElementById('dataStackSize').value,
            instructionStackSize: document.getElementById('instructionStackSize').value,
            inputPorts: document.getElementById('inputPorts').value,
            outputPorts: document.getElementById('outputPorts').value,
            gain: gainInput.value
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

    // Perform initial validation
    validateCustomRules();
});


// Adicione estes estilos ao seu CSS existente
const newStyle = document.createElement('style');
newStyle.textContent = `
  
`;
document.head.appendChild(newStyle);




// BUTTONS ==============================================================================================================================================================


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


function initAIAssistant() {
    aiAssistantContainer = document.createElement('div');
    aiAssistantContainer.className = 'ai-assistant-container';

    const resizer = document.createElement('div');
    resizer.className = 'ai-resizer';

    // Create header with provider selection
    const header = document.createElement('div');
    header.className = 'ai-assistant-header';
    header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span class="ai-assistant-title">AI Assistant</span>
      <select id="ai-provider-select" style="background: var(--background, #2d2d2d); color: var(--text-color, #ffffff); border: 1px solid var(--border-color, #404040); border-radius: 4px; padding: 2px;">
        <option value="chatgpt">ChatGPT</option>
        <option value="claude">Claude</option>
      </select>
    </div>
    <i class="fas fa-times ai-assistant-close"></i>
  `;

    // Create webview container
    const webviewContainer = document.createElement('div');
    webviewContainer.className = 'ai-assistant-content';
    webviewContainer.style.padding = '0'; // Remove padding for webview

    // Create webview element
    const webview = document.createElement('webview');
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.src = 'https://chat.openai.com'; // Default to ChatGPT
    webview.nodeintegration = 'false';
    webviewContainer.appendChild(webview);

    // Append elements
    aiAssistantContainer.appendChild(resizer);
    aiAssistantContainer.appendChild(header);
    aiAssistantContainer.appendChild(webviewContainer);
    document.body.appendChild(aiAssistantContainer);

    // Add event listeners
    const closeButton = header.querySelector('.ai-assistant-close');
    closeButton.addEventListener('click', toggleAIAssistant);

    const providerSelect = header.querySelector('#ai-provider-select');
    providerSelect.addEventListener('change', (e) => {
        currentProvider = e.target.value;
        const url = currentProvider === 'chatgpt' ?
            'https://chat.openai.com' :
            'https://claude.ai';
        webview.src = url;
    });

    // Setup resizing
    setupAIAssistantResize(resizer);
}

// Add toggle function
function toggleAIAssistant() {
    aiAssistantVisible = !aiAssistantVisible;
    aiAssistantContainer.classList.toggle('visible');

    // Adjust editor layout if needed
    if (editor) {
        editor.layout();
    }
}

// Add resize functionality
function setupAIAssistantResize(resizer) {
    let startX, startWidth;

    function startResize(e) {
        startX = e.clientX;
        startWidth = parseInt(getComputedStyle(aiAssistantContainer).width, 10);
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    }

    function resize(e) {
        const width = startWidth - (e.clientX - startX);
        aiAssistantContainer.style.width = `${width}px`;

        // Adjust editor layout
        if (editor) {
            editor.layout();
        }
    }

    function stopResize() {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }

    resizer.addEventListener('mousedown', startResize);
}


//WINDOW.ONLOAD ===========================================================================================================================================================
window.onload = () => {
    initMonaco();
    initAIAssistant();
    initializeSaveSystem();
    
    // Add AI Assistant button to toolbar
    const toolbar = document.querySelector('.toolbar');
    const aiButton = document.createElement('button');

    aiButton.className = 'toolbar-icon rainbow btn';
    aiButton.innerHTML = '<i class="fas fa-robot"></i>';
    aiButton.title = 'Toggle AI Assistant';
    aiButton.addEventListener('click', toggleAIAssistant);
    toolbar.appendChild(aiButton);

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


// WIPE OUT TERMINAL ========================================================================================================================================================
document.getElementById('clear-terminal').addEventListener('click', () => {
  // Identificar o terminal ativo
  const activeTerminal = document.querySelector('.terminal-content:not(.hidden)'); // Terminal ativo
  console.log("Limpar terminal1");

  if (activeTerminal) {
    const terminalId = activeTerminal.id; // Obtém o ID do terminal ativo

    if (terminalId === 'terminal-tcmm') {
      console.log("Limpar terminal2");
      // Substituir o conteúdo do terminal TCMM pelo estado inicial
      activeTerminal.innerHTML = `
        <div class="terminal-header">TCMM Terminal</div>
        <div class="terminal-body">Bem-vindo ao Terminal TCMM! Clean</div>
      `;
    } else if (terminalId === 'terminal-tasm') {
      console.log("Limpar terminal3");
      // Substituir o conteúdo do terminal TASM pelo estado inicial
      activeTerminal.innerHTML = `
        <div class="terminal-header">TASM Terminal</div>
        <div class="terminal-body">Bem-vindo ao Terminal TASM! Clean</div>
      `;
    }
  }
});
