document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const terminalContents = document.querySelectorAll('.terminal-content');
  
    // Alternância entre abas de terminais
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        terminalContents.forEach(tc => tc.classList.add('hidden'));
  
        tab.classList.add('active');
        document.getElementById(`terminal-${tab.dataset.terminal}`).classList.remove('hidden');
      });
    });
  
    // Configurando o terminal CMD
    const cmdOutput = document.getElementById('cmd-output');
    const cmdInput = document.getElementById('cmd-input');
  
    cmdInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const command = cmdInput.value;
        try {
          // Comunicação com o processo principal via API
          const result = await window.api.runCommand(command);
          cmdOutput.innerHTML += `<div>${result}</div>`;
        } catch (error) {
          cmdOutput.innerHTML += `<div style="color: red;">${error}</div>`;
        }
        cmdInput.value = '';
        cmdOutput.scrollTop = cmdOutput.scrollHeight;
      }
    });
  });
  
  let isFileCompiled = false; // Controle para verificar se o arquivo foi compilado

  // Função para ativar a aba e o conteúdo correspondente
  function activateTerminal(tabId, contentId) {
    if (!isFileCompiled) {
      // Se o arquivo não foi compilado, não faz nada
      return;
    }
  
    // Desativar todas as abas e conteúdos
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.terminal-content').forEach(content => content.classList.remove('active'));
  
    // Ativar a aba e conteúdo correspondente
    document.querySelector(`[data-terminal="${tabId}"]`).classList.add('active');
    document.getElementById(contentId).classList.add('active');
  }
  
  // Eventos para os botões cmmcomp e asmcomp
  document.getElementById('cmmcomp').addEventListener('click', () => {
    // Compilação do arquivo (simulada aqui)
    console.log("Compilando com o CMM...");
    isFileCompiled = true; // Define que o arquivo foi compilado
    activateTerminal('tcmm', 'terminal-tcmm'); // Ativa o terminal TCMM
  });
  
  document.getElementById('asmcomp').addEventListener('click', () => {
    // Compilação do arquivo (simulada aqui)
    console.log("Compilando com o ASM...");
    isFileCompiled = true; // Define que o arquivo foi compilado
    activateTerminal('tasm', 'terminal-tasm'); // Ativa o terminal TASM
  });
  
  // Eventos de clique nas abas (agora ativam o terminal apenas se o arquivo foi compilado)
  document.querySelectorAll('.terminal-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-terminal');
      activateTerminal(tabName, `terminal-${tabName}`);
    });
  });
  


// Evento de compilação do CMM
document.getElementById('cmmcomp').addEventListener('click', async () => {
  if (!this.activeTab || compiling) return; // Use this.activeTab para verificar o arquivo ativo

  activateTerminal('tcmm', 'terminal-tcmm'); // Foca no terminal TCMM

  const button = document.getElementById('cmmcomp');
  const icon = button.querySelector('i');

  try {
    compiling = true;
    button.disabled = true;
    icon.className = 'fas fa-spinner fa-spin';

    const content = editor.getValue();
    const inputDir = this.activeTab.substring(0, this.activeTab.lastIndexOf('\\') + 1); // Usar this.activeTab
    const inputFile = this.activeTab.split('\\').pop(); // Usar this.activeTab

    writeToTerminal('terminal-tcmm', 'Starting CMM compilation...', 'command');
    writeToTerminal('terminal-tcmm', `Input file: ${inputFile}`, 'info');

    const result = await window.electronAPI.compile({
      compiler: '/compilers/cmmcomp.exe',
      content: content,
      filePath: this.activeTab, // Usar this.activeTab
      workingDir: inputDir,
      outputPath: inputDir
    });

    // Atualizando com a saída do compilador
    writeToTerminal('terminal-tcmm', 'CMM to ASM compiler: Processing compilation', 'info');

    if (result.stderr) {
      result.stderr.split('\n').forEach(line => {
        if (line.trim()) {
          writeToTerminal('terminal-tcmm', `CMM to ASM compiler: ${line}`, 'error');
        }
      });
    }

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim()) {
          writeToTerminal('terminal-tcmm', `CMM to ASM compiler: ${line}`, 'success');
        }
      });
    }

    writeToTerminal('terminal-tcmm', 'CMM compilation finished.', 'info');

  } catch (error) {
    console.error('Compilation error:', error);
    writeToTerminal('terminal-tcmm', `CMM to ASM compiler error: ${error.message}`, 'error');
  } finally {
    compiling = false;
    button.disabled = false;
    icon.className = 'fa-solid fa-c';
  }
});

// Evento de compilação do ASM
document.getElementById('asmcomp').addEventListener('click', async () => {
  if (!this.activeTab || compiling) return; // Verifique se o arquivo ativo está disponível

  activateTerminal('tasm', 'terminal-tasm'); // Foca no terminal TASM

  const button = document.getElementById('asmcomp');
  const icon = button.querySelector('i');

  try {
    compiling = true;
    button.disabled = true;
    icon.className = 'fas fa-spinner fa-spin'; // Altera o ícone para o modo de carregamento

    const content = editor.getValue();
    const inputDir = this.activeTab.substring(0, this.activeTab.lastIndexOf('\\') + 1); // Usando o caminho do arquivo ativo
    const inputFile = this.activeTab.split('\\').pop(); // Usando o nome do arquivo ativo

    writeToTerminal('terminal-tasm', 'Starting ASM compilation...', 'command');
    writeToTerminal('terminal-tasm', `Input file: ${inputFile}`, 'info');

    // Chamando o método de compilação com o compilador ASM
    const result = await window.electronAPI.compile({
      compiler: '/compilers/asmcomp.exe',  // Caminho do compilador ASM
      content: content,
      filePath: this.activeTab,           // Caminho do arquivo ativo
      workingDir: inputDir,
      outputPath: inputDir               // Caminho de saída para o arquivo compilado
    });

    // Atualizando com a saída do compilador
    writeToTerminal('terminal-tasm', 'ASM to MIF compiler: Processing compilation', 'info');

    if (result.stderr) {
      result.stderr.split('\n').forEach(line => {
        if (line.trim()) {
          writeToTerminal('terminal-tasm', `ASM to MIF compiler: ${line}`, 'error');
        }
      });
    }

    if (result.stdout) {
      result.stdout.split('\n').forEach(line => {
        if (line.trim()) {
          writeToTerminal('terminal-tasm', `ASM to MIF compiler: ${line}`, 'success');
        }
      });
    }

    writeToTerminal('terminal-tasm', 'ASM compilation finished.', 'info');

  } catch (error) {
    console.error('Compilation error:', error);
    writeToTerminal('terminal-tasm', `ASM to MIF compiler error: ${error.message}`, 'error');
  } finally {
    compiling = false;
    button.disabled = false;
    icon.className = 'fa-solid fa-cube';  // Restaura o ícone original
  }
});



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
function writeToTerminal(terminalId, message, type = 'info') {
  const terminalBody = document.querySelector(`#${terminalId} .terminal-body`);
  const timestamp = new Date().toLocaleString(); // Get current date and time

  if (!terminalBody) return;

  // Create a log entry
  const logEntry = document.createElement('div');
  logEntry.classList.add('log-entry', type); // Adding type classes (command, success, error, info)

  // Add date and time to the log header
  const timestampDiv = document.createElement('div');
  timestampDiv.classList.add('timestamp');
  timestampDiv.textContent = timestamp;
  logEntry.appendChild(timestampDiv);

  // Check for specific message to change color (Atenção na linha)
  if (message.includes("Atenção na linha")) {
    const lineNumberMatch = message.match(/Atenção na linha (\d+)/);
    if (lineNumberMatch) {
      logEntry.classList.add('highlight-line');
    }
  }

  // Add message to log entry
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('log-message');
  messageDiv.textContent = message;
  logEntry.appendChild(messageDiv);

  // Add log entry to terminal body and ensure scroll is at the bottom
  terminalBody.appendChild(logEntry);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

// Add this to your initialization or early in the renderer process
window.electronAPI.on('compiler-stdout', (data) => {
  writeToTerminal(`Compiler Output: ${data.trim()}`, 'success');
});

window.electronAPI.on('compiler-stderr', (data) => {
  writeToTerminal(`Compiler Error: ${data.trim()}`, 'error');
});
