document.addEventListener("DOMContentLoaded", () => {
    const newProjectModal = document.getElementById("newProjectModal");
    const browseBtn = document.getElementById("browseBtn");
    const projectLocationInput = document.getElementById("projectLocationInput");
    const generateBtn = document.getElementById("generateProjectBtn");
    const cancelBtn = document.getElementById("cancelProjectBtn");
    const newProjectBtn = document.getElementById("newProjectBtn"); // Atualizado

    // Open the "New Project" modal
    newProjectBtn.addEventListener("click", () => {
        newProjectModal.classList.remove("hidden");
    });

    // Browse for project location
    document.getElementById('browseBtn').addEventListener('click', async () => {
        try {
            const folderPath = await window.electronAPI.selectDirectory();
            if (folderPath) {
                document.getElementById('projectLocationInput').value = folderPath;
            }
        } catch (error) {
            console.error('Error selecting directory:', error);
        }
    });

    // Generate project
    document.getElementById('generateProjectBtn').addEventListener('click', async () => {
        try {
            const projectName = document.getElementById('projectNameInput').value.trim();
            const projectLocation = document.getElementById('projectLocationInput').value.trim();

            if (!projectName || !projectLocation) {
                alert('Please enter both Project Name and Location.');
                return;
            }

            // Caminho completo do projeto
            const projectPath = `${projectLocation}\\${projectName}`;
            const spfPath = `${projectPath}\\${projectName}.spf`;

            // Cria a estrutura de pastas e arquivo
            await window.electronAPI.createProjectStructure(projectPath, spfPath);

            alert('Project created successfully!');
            closeNewProjectModal();

            // Agora, renderize a árvore de arquivos da pasta criada
            openFolderAndRenderTree(projectPath);  // Passa o caminho da pasta do projeto para a função

        } catch (error) {
            console.error('Error generating project:', error);
            alert('Failed to create the project. See console for details.');
        }
    });

    // Função para abrir a pasta e renderizar a árvore de arquivos
    async function openFolderAndRenderTree(folderPath) {
        try {
            // Abre a pasta diretamente, sem abrir o explorador de arquivos
            const result = await window.electronAPI.getFolderFiles(folderPath);  // Nova API que retorna arquivos de uma pasta
            if (result) {
                const fileTree = document.getElementById('file-tree');
                fileTree.innerHTML = '';  // Limpa a árvore de arquivos existente
                renderFileTree(result.files, fileTree);  // Renderiza a árvore de arquivos com o conteúdo da pasta
            }
        } catch (error) {
            console.error('Error opening folder:', error);
            alert('Failed to open folder.');
        }
    }

    // Função para renderizar a árvore de arquivos (presumindo que você já tenha esta função)
    function renderFileTree(files, container, level = 0) {
        files.forEach(file => {
            const itemWrapper = document.createElement('div');
            itemWrapper.className = 'file-tree-item';

            const item = document.createElement('div');
            item.className = 'file-item';
            item.style.paddingLeft = `${level * 20}px`;

            const icon = document.createElement('i');

            if (file.type === 'directory') {
                // Ícone da pasta e ícone de expandir/colapsar
                const folderToggle = document.createElement('i');
                folderToggle.className = 'fas fa-chevron-right folder-toggle';
                item.appendChild(folderToggle);

                icon.className = 'fas fa-folder file-item-icon';

                // Cria um container para os filhos, mas o esconde inicialmente
                const childContainer = document.createElement('div');
                childContainer.className = 'folder-content hidden';

                // Adiciona o manipulador de clique para alternar a visibilidade
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
                // Exemplo de como adicionar ícones para arquivos
                icon.className = 'fas fa-file file-item-icon';
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

    // Função de abrir o arquivo (já existente)
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

    // Fechar o modal
    function closeNewProjectModal() {
        const modal = document.getElementById('newProjectModal');
        modal.classList.add('hidden');
    }

    document.getElementById('cancelProjectBtn').addEventListener('click', closeNewProjectModal);
});
