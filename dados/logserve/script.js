const logContainer = document.getElementById('logContainer');
const refreshButton = document.getElementById('refreshButton');
const searchInput = document.getElementById('searchInput');

// Defina o username que será usado para buscar os dados
const username = localStorage.getItem('username')?.toLowerCase();

// Nomes personalizados para as chaves
const nomesPersonalizados = {
  'logHistoricoMudancas': 'Ultima Sincronização de Logs de Alterações',
  'checkbox_state_monitor': 'Ultima Sincronização checkbox carros em conferencia',
  'result_state_monitor': 'Ultima Sincronização pendencias de picking',
  'ondasdin': 'Ultima Sincronização picking dinâmico',
  'ondas': 'Ultima Sincronização Ondas da GRADE',
  'gradeCompleta': 'Ultima Sincronização grade completa',
  'reaba': 'Ultima Sincronização reabastecimento',
  'movimentacoesProcessadas': 'Ultima Sincronização movimentações',
  'dashboardHTML': 'Ultima Sincronização Produtividade',
  'rankingArray': 'Ultima Sincronização ranking',
  // Adicione mais mapeamentos conforme necessário
};

// Ícones para categorias de logs
const iconesChaves = {
  'checkbox_state_monitor': 'fa-solid fa-check-square',
  'movimentacoesProcessadas': 'fa-solid fa-truck-container',
  'result_state_monitor': 'fa-solid fa-check-circle',
  'ondasdin': 'fa-solid fa-list-check',
  'ondas': 'fa-solid fa-list-tree',
  'gradeCompleta': 'fa-solid fa-table-cells',
  'reaba': 'fa-solid fa-shelves',
  'dashboardHTML': 'fas fa-chart-line',
  'rankingArray': 'fa-solid fa-trophy',
  'logHistoricoMudancas': 'fa-solid fa-history',
  // ícone padrão para chaves não especificadas
  'default': 'fa-solid fa-circle-info'
};

async function carregarLogs() {
  logContainer.innerHTML = '<p class="placeholder">Carregando logs...</p>';

  try {
    // Primeira tentativa: buscar dados do load.php
    const response = await fetch(`https://labsuaideia.store/api/load.php?userId=${username}`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) throw new Error(`Erro ao acessar load.php: ${response.status}`);

    const data = await response.json();
    const registros = data.dados ? JSON.parse(data.dados) : {};

    processarLogs(registros);

  } catch (error) {
    console.error('Erro ao carregar dados do load.php:', error);
    mostrarToast("Falha ao carregar dados do servidor. Tentando fallback...", "error");

    // Segunda tentativa: buscar dados do Worker
    try {
      const workerResponse = await fetch(`https://dry-scene-2df7.tjslucasvl.workers.dev/?userId=${username}`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!workerResponse.ok) throw new Error(`Erro ao acessar Worker: ${workerResponse.status}`);

      const workerData = await workerResponse.json();
      const registros = JSON.parse(workerData.dados || '{}');

      processarLogs(registros);

    } catch (workerError) {
      console.error('Erro ao carregar dados do Worker:', workerError);
      mostrarToast("Falha ao carregar dados de backup. Tente novamente mais tarde.", "error");
    }
  }
}

// Função para processar os logs e exibi-los
function processarLogs(registros) {
  logContainer.innerHTML = '';

  const chaves = Object.keys(registros);

  if (chaves.length === 0) {
    logContainer.innerHTML = '<p class="placeholder">Nenhum dado encontrado.</p>';
    return;
  }

  // Ordenar por timestamp (mais recente primeiro)
  chaves.sort((a, b) => {
    return new Date(registros[b].timestamp) - new Date(registros[a].timestamp);
  });

  chaves.forEach((key, index) => {
    const entry = registros[key];
    
    // Determinar nome personalizado
    const nomeExibido = nomesPersonalizados[key] || key;
    
    // Determinar ícone adequado
    let icone = iconesChaves.default;
    for (const categoria in iconesChaves) {
      if (key.includes(categoria)) {
        icone = iconesChaves[categoria];
        break;
      }
    }
    
    const logDiv = document.createElement('div');
    logDiv.className = 'log-entry';
    // Adicionar delay para animação escalonada
    logDiv.style.animationDelay = `${index * 0.05}s`;
    
    logDiv.innerHTML = `
      <div class="log-header">
        <i class="log-icon ${icone}"></i>
        <div class="log-key">${nomeExibido}</div>
        <div class="timestamp">${new Date(entry.timestamp).toLocaleString('pt-BR')}</div>
      </div>
      <div class="log-value">${entry.value}</div>
    `;
    
    // Adicionar evento de clique para mostrar/ocultar o valor
    logDiv.addEventListener('click', () => {
      const valorElement = logDiv.querySelector('.log-value');
      valorElement.classList.toggle('visible');
    });
    
    logContainer.appendChild(logDiv);
  });
}

// Função para filtrar logs
function filtrarLogs() {
  const termo = searchInput.value.toLowerCase();
  const entradas = document.querySelectorAll('.log-entry');
  
  entradas.forEach(entrada => {
    const chave = entrada.querySelector('.log-key').textContent.toLowerCase();
    const valor = entrada.querySelector('.log-value').textContent.toLowerCase();
    
    if (chave.includes(termo) || valor.includes(termo)) {
      entrada.style.display = 'flex';
    } else {
      entrada.style.display = 'none';
    }
  });
}

// Função para mostrar toast
function mostrarToast(mensagem, tipo) {
  const toast = document.createElement('div');
  toast.classList.add('toast', tipo);
  toast.textContent = mensagem;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Atualizar manualmente
refreshButton.addEventListener('click', carregarLogs);

// Pesquisar conforme digita
searchInput.addEventListener('input', filtrarLogs);

// Carregar ao abrir
document.addEventListener('DOMContentLoaded', carregarLogs);
