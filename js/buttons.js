
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
  
  document.getElementById('showInfo').addEventListener('click', showInfoBox);

  // browse

  
document.getElementById('browseBtn').addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.selectDirectory();
      if (result) {
        document.getElementById('projectLocationInput').value = result;
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  });
  
  if (editor.getModel()) {
    editor.getModel().dispose(); // Destrói o modelo atual
    editor.setModel(null);
  }
  
  function closeFile(tabId) {
    const tab = document.getElementById(tabId);
    const editor = monaco.editor.getModels().find(model => model.uri.toString() === tabId);
    
    if (editor) {
        editor.dispose(); // Desfaz o Monaco Editor
    }
  
    if (tab) {
        tab.remove(); // Remove a aba
    }
  
    // Remova a referência do arquivo da lista de arquivos abertos, se necessário
    openFiles = openFiles.filter(file => file.tabId !== tabId); // Filtra o arquivo da lista
  }

  
