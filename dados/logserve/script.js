// script.js
// Exibe logs de sincronização e permite restaurar versões anteriores de cada key.

////////////////////////////////////////////////////////////////////////////////
// ─── CONFIGURAÇÃO INICIAL ────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

// Elementos do DOM
const logContainer   = document.getElementById('logContainer');
const refreshButton  = document.getElementById('refreshButton');
const searchInput    = document.getElementById('searchInput');

// Identificador do usuário local (pode ser 'all' ou seu usuário de fato)
const username    = localStorage.getItem('username')?.toLowerCase() || 'all';

// Endpoints
const LOAD_API     = 'https://labsuaideia.store/api/load.php';
const WORKER_LOAD  = 'https://dry-scene-2df7.tjslucasvl.workers.dev/';
const HISTORY_API  = 'https://labsuaideia.store/api/history.php';

// Mapeamentos de nomes e ícones
const nomesPersonalizados = {
  'logHistoricoMudancas': 'Última Sincronização de Logs de Alterações',
  'checkbox_state_monitor': 'Última Sincronização checkbox carros em conferência',
  'result_state_monitor': 'Última Sincronização pendências de picking',
  'ondasdin': 'Última Sincronização picking dinâmico',
  'ondas': 'Última Sincronização Ondas da GRADE',
  'gradeCompleta': 'Última Sincronização grade completa',
  'reaba': 'Última Sincronização reabastecimento',
  'movimentacoesProcessadas': 'Última Sincronização movimentações',
  'dashboardHTML': 'Última Sincronização Produtividade',
  'rankingArray': 'Última Sincronização ranking',
  'pickingData': 'Última Sincronização pendências de picking',
  'pickingTimestamp': 'Horário de sincronização pendências de picking'
};
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
  'pickingData': 'fas fa-tasks',
  'pickingTimestamp': 'fa-solid fa-clock',
  'default': 'fa-solid fa-circle-info'
};

////////////////////////////////////////////////////////////////////////////////
// ─── FUNÇÃO PARA MOSTRAR TOASTS ──────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;  // 'info', 'success', 'error'
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

////////////////////////////////////////////////////////////////////////////////
// ─── CARREGA LOGS (PRINCIPAL + FALLBACK WORKER) ─────────────────────────────
////////////////////////////////////////////////////////////////////////////////
async function carregarLogs() {
  logContainer.innerHTML = '<p class="placeholder">Carregando logs...</p>';
  let registros = {};

  // 1) Tenta servidor principal
  try {
    const res = await fetch(`${LOAD_API}?userId=${encodeURIComponent(username)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    registros = (await res.json()).dados || {};
  }
  // 2) Se falhar, tenta Worker
  catch (err) {
    console.warn('LOAD_API falhou, tentando Worker:', err);
    try {
      const res2 = await fetch(`${WORKER_LOAD}?userId=${encodeURIComponent(username)}`, {
        cache: 'no-store', signal: AbortSignal.timeout(10000)
      });
      if (!res2.ok) throw new Error(`Status ${res2.status}`);
      registros = (await res2.json()).dados || {};
    } catch (err2) {
      console.error('WORKER_LOAD também falhou:', err2);
      return showToast("Falha ao carregar dados do servidor.", "error");
    }
  }

  processarLogs(registros);
}

////////////////////////////////////////////////////////////////////////////////
// ─── PROCESSA E EXIBE CADA ENTRADA ──────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
function processarLogs(registros) {
  logContainer.innerHTML = '';
  const chaves = Object.keys(registros);

  if (chaves.length === 0) {
    logContainer.innerHTML = '<p class="placeholder">Nenhum dado encontrado.</p>';
    return;
  }

  // Ordena do mais recente para o mais antigo
  chaves.sort((a, b) => registros[b].timestamp - registros[a].timestamp);

  chaves.forEach((key, index) => {
    const entry       = registros[key];
    const nomeExibido = nomesPersonalizados[key] || key;
    let icone         = iconesChaves.default;

    // Escolhe ícone adequado
    for (const cat in iconesChaves) {
      if (key.includes(cat)) {
        icone = iconesChaves[cat];
        break;
      }
    }

    // Cria container da entrada
    const logDiv = document.createElement('div');
    logDiv.className = 'log-entry';
    logDiv.style.animationDelay = `${index * 0.05}s`;

    // Monta HTML: header, usuário e valor
    logDiv.innerHTML = `
      <div class="log-header">
        <i class="log-icon ${icone}"></i>
        <div class="log-key">${nomeExibido}</div>
        <div class="timestamp">${new Date(entry.timestamp).toLocaleString('pt-BR')}</div>
      </div>
      <div class="log-user">
        Alterado por: <strong>${entry.userId || 'desconhecido'}</strong>
      </div>
      <div class="log-value">${entry.value}</div>
    `;

    // Toggle visibilidade do valor completo!
    logDiv.addEventListener('click', () => {
      logDiv.querySelector('.log-value').classList.toggle('visible');
    });

    // Botão Restaurar Versão Anterior
    const btnRestore = document.createElement('button');
    btnRestore.className = 'btn-restore-prev';
    btnRestore.textContent = 'Restaurar versão anterior';
    btnRestore.addEventListener('click', async ev => {
      ev.stopPropagation();
      await restaurarAnterior(key);
    });
    logDiv.appendChild(btnRestore);

    logContainer.appendChild(logDiv);
  });
}

////////////////////////////////////////////////////////////////////////////////
// ─── FUNÇÃO PARA BUSCAR HISTÓRICO DE UMA KEY ────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
async function fetchHistory(key) {
  const res = await fetch(`${HISTORY_API}?key=${encodeURIComponent(key)}`, {
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  const json = await res.json();
  return json.dados[key] || [];
}

////////////////////////////////////////////////////////////////////////////////
// ─── RESTAURA A VERSÃO ANTERIOR (PENÚLTIMA) ─────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
async function restaurarAnterior(key) {
  try {
    showToast(`Buscando versão anterior de "${key}"…`, 'info');
    const hist = await fetchHistory(key);
    if (hist.length < 2) {
      return showToast('Não há versão anterior disponível.', 'error');
    }
    // Ordena do mais recente ao mais antigo e pega o penúltimo
    hist.sort((a, b) => b.timestamp - a.timestamp);
    const penultimo = hist[1];

    // Grava no localStorage (aciona o sync-storage.js)
    localStorage.setItem(key, penultimo.value);

    showToast(
      `"${key}" restaurado para valor de ${new Date(penultimo.timestamp).toLocaleString('pt-BR')}`,
      'success'
    );
    // Recarrega para atualizar a lista
    carregarLogs();
  } catch (err) {
    console.error('Erro ao restaurar:', err);
    showToast('Erro ao restaurar versão anterior.', 'error');
  }
}

////////////////////////////////////////////////////////////////////////////////
// ─── FILTRO DE LOGS POR PESQUISA ───────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
function filtrarLogs() {
  const termo = searchInput.value.toLowerCase();
  document.querySelectorAll('.log-entry').forEach(entrada => {
    const chave = entrada.querySelector('.log-key').textContent.toLowerCase();
    const valor = entrada.querySelector('.log-value').textContent.toLowerCase();
    entrada.style.display = (chave.includes(termo) || valor.includes(termo)) ? 'flex' : 'none';
  });
}

////////////////////////////////////////////////////////////////////////////////
// ─── EVENTOS E INICIALIZAÇÃO ───────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
refreshButton.addEventListener('click', carregarLogs);
searchInput.addEventListener('input', filtrarLogs);
document.getElementById('syncButton')?.addEventListener('click', () => {
  // Se você tiver um botão para forçar sync
  if (window.sincronizarAgora) window.sincronizarAgora();
});
document.addEventListener('DOMContentLoaded', carregarLogs);
