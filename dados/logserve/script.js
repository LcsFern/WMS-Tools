// script.js
// Exibe logs de sincronização e permite restaurar versões anteriores de cada key.

const logContainer = document.getElementById('logContainer');
const refreshButton = document.getElementById('refreshButton');
const searchInput = document.getElementById('searchInput');

// User e endpoints
const username = localStorage.getItem('username')?.toLowerCase();
const LOAD_API     = 'https://labsuaideia.store/api/load.php';
const WORKER_LOAD  = 'https://dry-scene-2df7.tjslucasvl.workers.dev/';
const HISTORY_API  = 'https://labsuaideia.store/api/history.php'; 
// OBS.: É NECESSÁRIO implementar no servidor o history.php que retorne:
// { dados: { [key]: [ { userId, value, timestamp }, ... ] } }

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

// Carrega logs do servidor principal ou fallback Worker
async function carregarLogs() {
  logContainer.innerHTML = '<p class="placeholder">Carregando logs...</p>';
  let registros = {};

  try {
    const res = await fetch(`${LOAD_API}?userId=${username}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error();
    registros = (await res.json()).dados || {};
  } catch {
    try {
      const res2 = await fetch(`${WORKER_LOAD}?userId=${username}`, { signal: AbortSignal.timeout(10000) });
      if (!res2.ok) throw new Error();
      registros = (await res2.json()).dados || {};
    } catch {
      return showToast("Falha ao carregar dados do servidor.", "error");
    }
  }

  processarLogs(registros);
}

// Processa e exibe cada log-entry
function processarLogs(registros) {
  logContainer.innerHTML = '';
  const chaves = Object.keys(registros);
  if (chaves.length === 0) {
    logContainer.innerHTML = '<p class="placeholder">Nenhum dado encontrado.</p>';
    return;
  }

  // Ordena do mais recente
  chaves.sort((a, b) => new Date(registros[b].timestamp) - new Date(registros[a].timestamp));

  chaves.forEach((key, index) => {
    const entry = registros[key];
    const nomeExibido = nomesPersonalizados[key] || key;
    let icone = iconesChaves.default;
    for (const cat in iconesChaves) {
      if (key.includes(cat)) { icone = iconesChaves[cat]; break; }
    }

    const logDiv = document.createElement('div');
    logDiv.className = 'log-entry';
    logDiv.style.animationDelay = `${index * 0.05}s`;

    // Monta o HTML com timestamp, valor e usuário
    logDiv.innerHTML = `
      <div class="log-header">
        <i class="log-icon ${icone}"></i>
        <div class="log-key">${nomeExibido}</div>
        <div class="timestamp">${new Date(entry.timestamp).toLocaleString('pt-BR')}</div>
      </div>
      <div class="log-user">Alterado por: <strong>${entry.userId || 'desconhecido'}</strong></div>
      <div class="log-value">${entry.value}</div>
    `;

    // Click para toggle do valor
    logDiv.addEventListener('click', () => {
      logDiv.querySelector('.log-value').classList.toggle('visible');
    });

    // Botão para restaurar a versão ANTERIOR dessa key
    const btnRestorePrev = document.createElement('button');
    btnRestorePrev.textContent = 'Restaurar versão anterior';
    btnRestorePrev.className = 'btn-restore-prev';
    btnRestorePrev.addEventListener('click', e => {
      e.stopPropagation();
      restaurarAnterior(key);
    });
    logDiv.appendChild(btnRestorePrev);

    logContainer.appendChild(logDiv);
  });
}

// Busca histórico de alterações de uma key
async function fetchHistory(key) {
  const res = await fetch(`${HISTORY_API}?key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error('Falha ao obter histórico');
  return (await res.json()).dados[key] || [];
}

// Restaura a versão anterior de uma key (último registro antes do atual)
async function restaurarAnterior(key) {
  try {
    showToast(`Buscando versão anterior de "${key}"...`, 'info');
    const hist = await fetchHistory(key);
    if (hist.length < 2) return showToast('Não há versão anterior disponível.', 'error');
    // Ordena por timestamp e pega o penúltimo
    hist.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const anterior = hist[1];
    localStorage.setItem(key, anterior.value);
    showToast(`"${key}" restaurado para valor de ${new Date(anterior.timestamp).toLocaleString('pt-BR')}`, 'success');
    // Recarrega logs para refletir a mudança
    carregarLogs();
  } catch (err) {
    console.error(err);
    showToast('Erro ao restaurar versão anterior.', 'error');
  }
}

function filtrarLogs() {
  const termo = searchInput.value.toLowerCase();
  document.querySelectorAll('.log-entry').forEach(entrada => {
    const chave = entrada.querySelector('.log-key').textContent.toLowerCase();
    const valor = entrada.querySelector('.log-value').textContent.toLowerCase();
    entrada.style.display = (chave.includes(termo) || valor.includes(termo)) ? 'flex' : 'none';
  });
}

function mostrarToast(mensagem, tipo) {
  const toast = document.createElement('div');
  toast.classList.add('toast', tipo);
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// Eventos
document.getElementById('syncButton')?.addEventListener('click', async () => { /* botão de sincronizar agora */ });
refreshButton.addEventListener('click', carregarLogs);
searchInput.addEventListener('input', filtrarLogs);
document.addEventListener('DOMContentLoaded', carregarLogs);
