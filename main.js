const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

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
    frame: false, // Sem borda
    transparent: true, // Janela transparente
    alwaysOnTop: true, // Sempre acima
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html')); // Carregar o arquivo HTML da splash screen

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
      preload: path.join(__dirname, 'preload.js'),
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

// Update the refreshFolder handler to use listFiles instead of readDirectory
ipcMain.handle('refreshFolder', async () => {
  // If there's no current folder, return null
  if (!global.currentFolderPath) {
    return null;
  }
  
  // Re-read the current folder's contents using listFiles instead of readDirectory
  const files = await listFiles(global.currentFolderPath);
  return {
    files,
    path: global.currentFolderPath
  };
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
  const projectPath = path.join(formData.projectLocation, formData.projectName);
  
  // Create main project directory
  await fs.mkdir(projectPath, { recursive: true });
  
  // Create common subdirectories
  const directories = [
    'src',
    'build',
    'docs',
    'test'
  ];
  
  for (const dir of directories) {
    await fs.mkdir(path.join(projectPath, dir), { recursive: true });
  }
  
  // Create initial configuration file
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
  
  return projectPath;
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

ipcMain.handle('project:createStructure', async (_, projectPath, spfPath) => {
  try {
    // Cria as pastas do projeto
    const hardwarePath = path.join(projectPath, 'Hardware');
    const softwarePath = path.join(projectPath, 'Software');
    const procIPPath = path.join(hardwarePath, 'Proc_IP');
    const quartusFilesPath = path.join(hardwarePath, 'Quartus_Files');

    fs.mkdirSync(procIPPath, { recursive: true });
    fs.mkdirSync(quartusFilesPath, { recursive: true });
    fs.mkdirSync(softwarePath, { recursive: true });

    // Cria o arquivo .spf
    const spfContent = `
      Project Name: ${path.basename(projectPath)}
      Structure:
        - Hardware/
          - Proc_IP/
          - Quartus_Files/
        - Software/
    `;
    fs.writeFileSync(spfPath, spfContent.trim(), 'utf-8');

    return true; // Retorna sucesso
  } catch (error) {
    console.error('Error creating project structure:', error);
    throw error;
  }
});

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

