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
