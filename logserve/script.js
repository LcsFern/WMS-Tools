const logContainer = document.getElementById('logContainer');
const refreshButton = document.getElementById('refreshButton');
const searchInput = document.getElementById('searchInput');
const orderSelect = document.getElementById('orderSelect');

let logs = [];

// Defina o username que será usado para buscar os dados
const username = localStorage.getItem('username')?.toLowerCase();

async function carregarLogs() {
  logContainer.innerHTML = '<p class="placeholder">Carregando logs...</p>';

  try {
    const response = await fetch(`https://tight-field-106d.tjslucasvl.workers.dev/?userId=${username}`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) throw new Error(`Erro ${response.status}`);

    const data = await response.json();
    const registros = JSON.parse(data.dados || '{}');

    logs = Object.keys(registros).map(key => ({
      chave: key,
      valor: registros[key].value,
      timestamp: registros[key].timestamp
    }));

    renderizarLogs();

  } catch (error) {
    console.error('Erro ao carregar logs:', error);
    logContainer.innerHTML = '<p class="placeholder">Erro ao carregar dados. Tente novamente.</p>';
  }
}

function renderizarLogs() {
  const filtro = searchInput.value.toLowerCase();
  const ordem = orderSelect.value;

  let logsFiltrados = logs.filter(log =>
    log.chave.toLowerCase().includes(filtro) ||
    (log.valor && log.valor.toLowerCase().includes(filtro))
  );

  logsFiltrados.sort((a, b) => {
    if (ordem === 'desc') {
      return b.timestamp - a.timestamp;
    } else {
      return a.timestamp - b.timestamp;
    }
  });

  logContainer.innerHTML = '';

  if (logsFiltrados.length === 0) {
    logContainer.innerHTML = '<p class="placeholder">Nenhum log encontrado.</p>';
    return;
  }

  logsFiltrados.forEach(log => {
    const logDiv = document.createElement('div');
    logDiv.className = 'log-entry';
    logDiv.innerHTML = `
      <div class="log-key">${log.chave}</div>
      <div class="log-value">${log.valor || '(Sem valor)'}</div>
      <div class="timestamp">${new Date(log.timestamp).toLocaleString('pt-BR')}</div>
    `;
    logContainer.appendChild(logDiv);
  });
}

// Eventos
refreshButton.addEventListener('click', carregarLogs);
searchInput.addEventListener('input', renderizarLogs);
orderSelect.addEventListener('change', renderizarLogs);

// Carregar ao abrir
document.addEventListener('DOMContentLoaded', carregarLogs);
function renderizarLogs() {
    const filtro = searchInput.value.toLowerCase();
    const ordem = orderSelect.value;
  
    let logsFiltrados = logs.filter(log =>
      log.chave.toLowerCase().includes(filtro) ||
      (log.valor && log.valor.toLowerCase().includes(filtro))
    );
  
    logsFiltrados.sort((a, b) => {
      if (ordem === 'desc') {
        return b.timestamp - a.timestamp;
      } else {
        return a.timestamp - b.timestamp;
      }
    });
  
    logContainer.innerHTML = '';
  
    if (logsFiltrados.length === 0) {
      logContainer.innerHTML = '<p class="placeholder">Nenhum log encontrado.</p>';
      return;
    }
  
    logsFiltrados.forEach((log, index) => {
      setTimeout(() => {
        const logDiv = document.createElement('div');
        logDiv.className = 'log-entry';
        logDiv.innerHTML = `
          <div class="log-key">${log.chave}</div>
          <div class="log-value">${log.valor || '(Sem valor)'}</div>
          <div class="timestamp">${new Date(log.timestamp).toLocaleString('pt-BR')}</div>
        `;
        logContainer.appendChild(logDiv);
      }, index * 50); // Cada log aparece 50ms depois do anterior
    });
  }
  