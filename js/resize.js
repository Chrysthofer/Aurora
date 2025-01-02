
const verticalResizer = document.querySelector('.resizer-vertical');
const horizontalResizer = document.querySelector('.resizer-horizontal');
const fileTreeContainer = document.querySelector('.file-tree-container');
const terminalContainer = document.querySelector('.terminal-container');
const editorContainer = document.querySelector('.editor-container');

// Redimensionamento horizontal (file-tree)
verticalResizer.addEventListener('mousedown', (event) => {
  event.preventDefault();
  
  document.addEventListener('mousemove', resizeFileTree);
  document.addEventListener('mouseup', stopResize);
});

function resizeFileTree(event) {
  fileTreeContainer.style.width = `${event.clientX}px`;
}

function stopResize() {
  document.removeEventListener('mousemove', resizeFileTree);
  document.removeEventListener('mouseup', stopResize);
}

// Redimensionamento vertical (terminal)
horizontalResizer.addEventListener('mousedown', (event) => {
  event.preventDefault();
  
  document.addEventListener('mousemove', resizeTerminal);
  document.addEventListener('mouseup', stopTerminalResize);
});

function resizeTerminal(event) {
  const height = window.innerHeight - event.clientY + 1; // Ajuste baseado na altura da status bar e toolbar
  terminalContainer.style.height = `${height}px`;
  editorContainer.style.flex = `1 1 ${window.innerHeight - height}px`;
}

function stopTerminalResize() {
  document.removeEventListener('mousemove', resizeTerminal);
  document.removeEventListener('mouseup', stopTerminalResize);
}
