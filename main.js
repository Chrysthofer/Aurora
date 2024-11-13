const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
(async () => {
    const StoreModule = await import('electron-store');
    const Store = StoreModule.default;
    store = new Store(); // Ensure store is accessible globally or passed as needed
})();


function createWindow() {
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: path.join(__dirname, 'assets/favicon-32x32.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      backgroundColor: '#1e1e1e',
      show: false
    });
  
    win.loadFile('index.html');
    win.once('ready-to-show', () => {
      win.show();
    });
  }

app.whenReady().then(createWindow);

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
  return fs.promises.writeFile(filePath, content, 'utf8');
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


// Configurações do autoUpdater
autoUpdater.autoDownload = false;  // Baixe automaticamente após confirmação

// Verifica atualizações ao iniciar o app
app.on('ready', () => {
  autoUpdater.checkForUpdates();
});

// Evento para quando uma nova atualização está disponível
autoUpdater.on('update-available', (info) => {
  const userResponse = dialog.showMessageBoxSync({
    type: 'info',
    title: 'Atualização disponível',
    message: `Nova versão ${info.version} disponível. Deseja baixar agora?`,
    buttons: ['Sim', 'Não']
  });

  if (userResponse === 0) { // Se o usuário clicar em "Sim"
    autoUpdater.downloadUpdate();
  }
});

// Evento para quando o download da atualização está completo
autoUpdater.on('update-downloaded', () => {
  const userResponse = dialog.showMessageBoxSync({
    type: 'info',
    title: 'Instalar atualização',
    message: 'A atualização foi baixada. O aplicativo será reiniciado para instalar a nova versão.',
    buttons: ['Reiniciar', 'Mais tarde']
  });

  if (userResponse === 0) { // Se o usuário clicar em "Reiniciar"
    autoUpdater.quitAndInstall();
  }
});

// Evento para tratar erros de atualização
autoUpdater.on('error', (error) => {
  dialog.showErrorBox('Erro de atualização', `Erro ao atualizar o aplicativo: ${error}`);
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