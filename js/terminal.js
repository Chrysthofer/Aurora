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
  