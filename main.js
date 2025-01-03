const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra'); // fs-extra makes it easier to copy directories


(async () => {
  const StoreModule = await import('electron-store');
  const Store = StoreModule.default;
  store = new Store(); // Garantir que store seja acessível globalmente
})();

let mainWindow; // Variável para a janela principal
let splashWindow; // Variável para a splash screen

function createSplashScreen() {
  // Criar a janela da splash screen com a imagem SVG
  splashWindow = new BrowserWindow({
    width: 400,
    height: 500,
    icon: path.join(__dirname, 'assets/icons/aurora_borealis-2.ico'),
    frame: false, // Sem borda
    transparent: true, // Janela transparente
    alwaysOnTop: true, // Sempre acima
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'html', 'splash.html')); // Carregar o arquivo HTML da splash screen

  // Fechar a splash screen após 2 segundos
  setTimeout(() => {
    splashWindow.close(); // Fechar a splash screen
    createMainWindow(); // Criar e mostrar a janela principal
  }, 2000); // 2000 milissegundos (2 segundos)
}

function createMainWindow() {
  // Criar a janela principal
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets/icons/aurora_borealis-2.ico'),
    webPreferences: {
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'js', 'preload.js'),
    },
    backgroundColor: '#1e1e1e',
    show: false, // Janela principal começa oculta
  });

  mainWindow.loadFile('index.html'); // Carregar o arquivo da janela principal

  // Quando a janela principal estiver pronta para ser exibida
  mainWindow.once('ready-to-show', () => {
    mainWindow.show(); // Mostrar a janela principal
  });
}

function createUpdateWindow() {
  const updateWindow = new BrowserWindow({
    width: 450,
    height: 600,
    resizable: false,
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'update-preload.js')
    }
  });

  updateWindow.loadFile(path.join(__dirname, 'update-modal.html'));
}

// Modify the update available handler to show the update window
autoUpdater.on('update-available', (info) => {
  createUpdateWindow();
  mainWindow.webContents.send('update-available', {
    currentVersion: app.getVersion(),
    newVersion: info.version
  });
});

app.whenReady().then(() => {
  createSplashScreen(); // Exibir a splash screen
  autoUpdater.checkForUpdates(); // Explicitly check for updates
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    const folderPath = result.filePaths[0];
    global.currentFolderPath = folderPath; // Store the current folder path
    const files = await listFiles(folderPath);
    return { folderPath, files };
  }
  return null;
});

ipcMain.handle('read-file', async (event, filePath) => {
  return fs.promises.readFile(filePath, 'utf8');
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  try {
      await fs.promises.writeFile(filePath, content, 'utf8');
      return true;
  } catch (error) {
      console.error('Error saving file:', error);
      return false;
  }
});


async function listFiles(dir) {
  const files = await fs.promises.readdir(dir, { withFileTypes: true });
  const items = await Promise.all(files.map(async file => {
    const path = `${dir}/${file.name}`;
    if (file.isDirectory()) {
      const children = await listFiles(path);
      return { name: file.name, path, type: 'directory', children };
    }
    return { name: file.name, path, type: 'file' };
  }));
  return items;
}

// Add this to your existing IPC handlers
ipcMain.handle('getCurrentFolder', () => {
  return global.currentFolderPath || null;
});


// Add this function to scan directory recursively
async function scanDirectory(dirPath) {
  const items = await fse.readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    items.map(async item => {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        const children = await scanDirectory(fullPath);
        return {
          name: item.name,
          path: fullPath,
          type: 'directory',
          children
        };
      }
      return {
        name: item.name,
        path: fullPath,
        type: 'file'
      };
    })
  );
  return files;
}

// Update the refreshFolder handler
ipcMain.handle('refreshFolder', async (event, projectPath) => {
  try {
    if (!projectPath) {
      throw new Error('No project path provided');
    }
    const files = await scanDirectory(projectPath);
    return { files };
  } catch (error) {
    console.error('Error scanning directory:', error);
    throw error;
  }
});


// Update autoUpdater configuration
autoUpdater.autoDownload = false;

// Modify the update event handlers
autoUpdater.on('update-available', (info) => {
  // Send update information to renderer process
  mainWindow.webContents.send('update-available', {
    currentVersion: app.getVersion(),
    newVersion: info.version
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  // Send download progress to renderer process
  mainWindow.webContents.send('update-download-progress', {
    percent: progressObj.percent,
    transferred: progressObj.transferred,
    total: progressObj.total
  });
});

autoUpdater.on('update-downloaded', (info) => {
  // Send update downloaded notification to renderer
  mainWindow.webContents.send('update-downloaded', {
    version: info.version
  });
});

autoUpdater.on('error', (error) => {
  console.error('Update error:', error);
  dialog.showErrorBox('Update Error', `An error occurred during update: ${error.message}`);
});

// IPC handlers for update actions
ipcMain.on('start-download', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Evento para tratar erros de atualização
autoUpdater.on('error', (error) => {
  dialog.showErrorBox('Erro de atualização', `Erro ao atualizar o aplicativo: ${error}`);
});

autoUpdater.setFeedURL({
  provider: 'github',
  repo: 'Aurora',
  owner: 'Chrysthofer'
});

ipcMain.handle('compile', async (event, { compiler, content, filePath, workingDir }) => {
  return new Promise((resolve, reject) => {
    const compilerPath = path.join(__dirname, compiler);
    
    const options = {
      cwd: workingDir, // Define o diretório de trabalho como o diretório do arquivo de entrada
      maxBuffer: 1024 * 1024 // Aumenta o buffer para 1MB para lidar com saídas maiores
    };
    
    // Primeiro salva o arquivo para garantir que está atualizado
    try {
      require('fs').writeFileSync(filePath, content);
    } catch (error) {
      reject(error);
      return;
    }
    
    // Executa o compilador
    const process = exec(`"${compilerPath}" "${filePath}"`, options, (error, stdout, stderr) => {
      if (error && !stderr) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
    
    // Captura a saída em tempo real
    process.stdout.on('data', (data) => {
      // Você pode implementar um IPC aqui para enviar atualizações em tempo real se desejar
      console.log(data);
    });
    
    process.stderr.on('data', (data) => {
      console.error(data);
    });
  });
});

// Add these IPC handlers
ipcMain.handle('get-current-folder', async () => {
  // Return the current working directory or stored folder path
  return process.cwd(); // or wherever you store the current folder path
});

ipcMain.handle('open-in-explorer', async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return true;
  } catch (error) {
    console.error('Error opening explorer:', error);
    return false;
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Erro ao abrir o link externo:', error);
    return false;
  }
});

// IPC Handler for directory selection
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

// IPC Handler for project creation
ipcMain.handle('create-processor-project', async (event, formData) => {
  try {
    const projectPath = path.join(formData.projectLocation, formData.projectName);

    // Cria o diretório principal do projeto
    await fs.mkdir(projectPath, { recursive: true });

    // Cria subpastas comuns
    const directories = [
      'src',
      'build',
      'docs',
      'test'
    ];

    for (const dir of directories) {
      await fs.mkdir(path.join(projectPath, dir), { recursive: true });
    }

    // Cria a pasta "Software" e a subpasta com o nome do processador + "_S"
    const softwarePath = path.join(projectPath, 'Software');
    const processorFolderPath = path.join(softwarePath, `${formData.processorName}_S`);
    await fs.mkdir(processorFolderPath, { recursive: true });

    // Cria o arquivo .cmm dentro da pasta do processador com um "Hello World"
    const cmmFilePath = path.join(processorFolderPath, `${formData.processorName}.cmm`);
    const cmmContent = `// Hello World in ${formData.processorName} processor code\nconsole.log("Hello World");`;

    await fs.writeFile(cmmFilePath, cmmContent, 'utf8');

    // Cria o arquivo de configuração do processador
    const config = {
      processorName: formData.processorName,
      pointType: formData.pointType,
      nBits: parseInt(formData.nBits),
      nbMantissa: formData.nbMantissa ? parseInt(formData.nbMantissa) : null,
      nbExponent: formData.nbExponent ? parseInt(formData.nbExponent) : null,
      dataStackSize: parseInt(formData.dataStackSize),
      instructionStackSize: parseInt(formData.instructionStackSize),
      inputPorts: parseInt(formData.inputPorts),
      outputPorts: parseInt(formData.outputPorts),
      gain: parseFloat(formData.gain)
    };

    await fs.writeFile(
      path.join(projectPath, 'processor-config.json'),
      JSON.stringify(config, null, 2)
    );

    return projectPath; // Retorna o caminho do projeto criado
  } catch (error) {
    console.error('Error creating processor project:', error);
    throw error;
  }
});



// IPC Handler for compilation
ipcMain.handle('compile-code', async (event, { compiler, filePath, workingDir }) => {
  return new Promise((resolve, reject) => {
    const process = spawn(compiler, [filePath], { cwd: workingDir });

    let stdout = '';
    let stderr = '';

    // Send each line of output separately
    process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          event.sender.send('compiler-stdout', line.trim());
        }
      });
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          event.sender.send('compiler-stderr', line.trim());
        }
      });
      stderr += data.toString();
    });

    // Rest of the code remains the same
  });
});


// Add these handlers in main.js
ipcMain.handle('dialog:showOpen', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Sapho Project Files', extensions: ['spf'] }
    ]
  });
  return result;
});

// Handler for getting project info
ipcMain.handle('project:getInfo', async (_, spfPath) => {
  try {
    // Debug log
    console.log('Attempting to read project info from:', spfPath);

    if (!spfPath) {
      throw new Error('No project file path provided');
    }

    // Ensure the path exists
    const exists = await fse.pathExists(spfPath);
    if (!exists) {
      throw new Error(`Project file not found at: ${spfPath}`);
    }

    // Read and parse the project file
    const projectData = await fse.readJSON(spfPath);
    console.log('Successfully read project data');
    
    return projectData;
  } catch (error) {
    console.error('Error reading project info:', error);
    throw error;
  }
});

// Manipulador para abrir o explorador de arquivos
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled) {
    return null; // Se o usuário cancelar
  }
  return result.filePaths[0]; // Caminho da pasta selecionada
});

// SPF file structure
class ProjectFile {
  constructor(projectPath) {
    this.metadata = {
      projectName: path.basename(projectPath),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      computerName: process.env.COMPUTERNAME || os.hostname(),
      appVersion: app.getVersion(),
      projectPath: projectPath
    };
    
    this.structure = {
      basePath: projectPath,
      folders: [
        { path: 'Hardware/Proc_IP', exists: false },
        { path: 'Hardware/Quartus_Files', exists: false },
        { path: 'Software', exists: false }
      ]
    };
  }

  toJSON() {
    return {
      metadata: this.metadata,
      structure: this.structure
    };
  }
}

// Handle SPF file creation
ipcMain.handle('project:createStructure', async (_, projectPath, spfPath) => {
  try {
    // Create project folders
    const hardwarePath = path.join(projectPath, 'Hardware');
    const softwarePath = path.join(projectPath, 'Software');
    const procIPPath = path.join(hardwarePath, 'Proc_IP');
    const quartusFilesPath = path.join(hardwarePath, 'Quartus_Files');
    const saphoComponentsPath = path.resolve('./saphoComponents');

    // Create directories
    await fse.ensureDir(procIPPath);
    await fse.ensureDir(quartusFilesPath);
    await fse.ensureDir(softwarePath);

    // Copy saphoComponents
    if (await fse.pathExists(saphoComponentsPath)) {
      await fse.copy(saphoComponentsPath, procIPPath);
      console.log('Sapho components copied successfully');
    } else {
      console.warn('Warning: saphoComponents folder not found');
    }

    // Create and save SPF file
    const projectFile = new ProjectFile(projectPath);
    await fse.writeJSON(spfPath, projectFile.toJSON(), { spaces: 2 });

    // Scan the directory to return the initial file tree
    const files = await scanDirectory(projectPath);

    return { success: true, projectData: projectFile.toJSON(), files, spfPath };
  } catch (error) {
    console.error('Error creating project structure:', error);
    throw error;
  }
});

// Handle SPF file opening
ipcMain.handle('project:open', async (_, spfPath) => {
  try {
    console.log('Opening project from:', spfPath);

    // Read and parse SPF file
    const projectData = await fse.readJSON(spfPath);
    
    // Verify folder structure
    const basePath = projectData.structure.basePath;
    const verifiedStructure = await Promise.all(
      projectData.structure.folders.map(async folder => {
        const fullPath = path.join(basePath, folder.path);
        const exists = await fse.pathExists(fullPath);
        return { ...folder, exists };
      })
    );

    projectData.structure.folders = verifiedStructure;
    projectData.metadata.lastOpened = new Date().toISOString();

    // Update SPF file with last opened time
    await fse.writeJSON(spfPath, projectData, { spaces: 2 });

    // Scan directory for file tree
    const files = await scanDirectory(basePath);

    return {
      projectData,
      files,
      spfPath
    };
  } catch (error) {
    console.error('Error opening project file:', error);
    throw error;
  }
});

// Handle project opening from Windows double-click
app.on('second-instance', (event, commandLine) => {
  const spfPath = commandLine[commandLine.length - 1];
  if (spfPath.endsWith('.spf')) {
    mainWindow.webContents.send('project:openFromSystem', spfPath);
  }
});

// Handle file associations
app.setAsDefaultProtocolClient('spf');

ipcMain.handle('getFolderFiles', async (event, folderPath) => {
  try {
    const files = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const fileStructure = files.map(file => {
      const filePath = path.join(folderPath, file.name);
      if (file.isDirectory()) {
        return {
          name: file.name,
          path: filePath,
          type: 'directory',
          children: [] // Deixe vazio por enquanto, será preenchido depois se necessário
        };
      } else {
        return {
          name: file.name,
          path: filePath,
          type: 'file'
        };
      }
    });
    return { files: fileStructure };
  } catch (error) {
    console.error('Error reading folder:', error);
    throw new Error('Failed to read folder');
  }
});

//SAVE FILE

// In main.js
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf8');
    return true;
  } catch (error) {
    throw error;
  }
});