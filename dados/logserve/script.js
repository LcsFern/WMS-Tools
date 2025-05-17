// script.js
// Exibe logs de sincronização e permite restaurar versões anteriores de cada key.

const logContainer   = document.getElementById('logContainer');
const refreshButton  = document.getElementById('refreshButton');
const searchInput    = document.getElementById('searchInput');

const username    = localStorage.getItem('username')?.toLowerCase() || 'all';
const LOAD_API    = 'https://labsuaideia.store/api/loadsql.php';
const HISTORY_API = 'https://labsuaideia.store/api/historysql.php'; 

// Nomes personalizados exibidos no painel
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

// Ícones personalizados para cada chave
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

// Exibe notificações flutuantes
function showToast(mensagem, tipo) {
  const toast = document.createElement('div');
  toast.classList.add('toast', tipo);
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// Carrega logs do servidor SQL
async function carregarLogs() {
  logContainer.innerHTML = '<p class="placeholder">Carregando logs...</p>';
  let registros = {};

  try {
    const res = await fetch(`${LOAD_API}?userId=${encodeURIComponent(username)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error('Erro ao carregar dados do SQL');
    const json = await res.json();
    registros = json.dados || {};
  } catch (error) {
    console.error(error);
    return showToast("Falha ao carregar dados do servidor SQL.", "error");
  }

  processarLogs(registros);
}

// Processa e exibe os logs recebidos
// Processa e exibe os logs recebidos
function processarLogs(registros) {
  logContainer.innerHTML = '';
  const chaves = Object.keys(registros);
  if (chaves.length === 0) {
    logContainer.innerHTML = '<p class="placeholder">Nenhum dado encontrado.</p>';
    return;
  }

  chaves.sort((a, b) => registros[b].timestamp - registros[a].timestamp);

  chaves.forEach((key, index) => {
    const entry = registros[key];
    const nomeExibido = nomesPersonalizados[key] || key;
    let icone = iconesChaves.default;

    for (const cat in iconesChaves) {
      if (key.includes(cat)) {
        icone = iconesChaves[cat];
        break;
      }
    }

    const logDiv = document.createElement('div');
    logDiv.className = 'log-entry';
    logDiv.style.animationDelay = `${index * 0.05}s`;

    logDiv.innerHTML = `
      <div class="log-header">
        <i class="log-icon ${icone}"></i>
        <div class="log-key">${nomeExibido}</div>
        <div class="timestamp">${new Date(entry.timestamp).toLocaleString('pt-BR')}</div>
      </div>
      ${entry.userId ? `<div class="log-user">Alterado por: <strong>${formatarUsuario(entry.userId)}</strong></div>` : ''}
      <div class="log-value">${entry.value}</div>
    `;

    logDiv.addEventListener('click', () => {
      logDiv.querySelector('.log-value').classList.toggle('visible');
    });

    const btnRestorePrev = document.createElement('button');
    btnRestorePrev.textContent = 'Restaurar versão anterior';
    btnRestorePrev.className = 'btn-restore-prev';
    btnRestorePrev.addEventListener('click', e => {
      e.stopPropagation();
      restaurarAnterior(key, logDiv);
    });
    logDiv.appendChild(btnRestorePrev);

    logContainer.appendChild(logDiv);
  });
}


// Requisição para histórico (ainda não funcional pois depende do historysql.php)
async function fetchHistory(key) {
  const res = await fetch(`${HISTORY_API}?key=${encodeURIComponent(key)}`, {
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Falha ao obter histórico');
  const json = await res.json();
  return json.dados[key] || [];
}

// Restaura a versão anterior de uma chave
async function restaurarAnterior(key) {
  try {
    showToast(`Buscando versão anterior de "${key}"…`, 'info');
    const hist = await fetchHistory(key);
    if (hist.length < 2) return showToast('Não há versão anterior disponível.', 'error');

    hist.sort((a, b) => b.timestamp - a.timestamp);
    const anterior = hist[1];

    confirmarRestauracao(anterior, () => {
      localStorage.setItem(key, anterior.value);
      showToast(
        `"${key}" restaurado com valor de ${new Date(anterior.timestamp).toLocaleString('pt-BR')} (por ${anterior.userId || 'desconhecido'})`,
        'success'
      );
      carregarLogs();
    });
  } catch (err) {
    console.error(err);
    showToast('Erro ao restaurar versão anterior.', 'error');
  }
}

// Filtra os logs de acordo com o texto digitado
function filtrarLogs() {
  const termo = searchInput.value.toLowerCase();
  document.querySelectorAll('.log-entry').forEach(entrada => {
    const chave = entrada.querySelector('.log-key').textContent.toLowerCase();
    const valor = entrada.querySelector('.log-value').textContent.toLowerCase();
    entrada.style.display = (chave.includes(termo) || valor.includes(termo)) ? 'flex' : 'none';
  });
}

// Botões e eventos
refreshButton.addEventListener('click', carregarLogs);
searchInput.addEventListener('input', filtrarLogs);

document.getElementById('syncButton')?.addEventListener('click', () => {
  if (window.sincronizarAgora) window.sincronizarAgora();
});

document.addEventListener('DOMContentLoaded', carregarLogs);

// Modal de confirmação de restauração
function confirmarRestauracao({ key, timestamp, userId }, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const data = new Date(timestamp).toLocaleString('pt-BR');
  const user = userId || 'desconhecido';

  modal.innerHTML = `
    <h2>Restaurar chave "${key}"?</h2>
    <p>Essa ação vai restaurar o valor anterior de <strong>${data}</strong>, enviado por <strong>${user}</strong>.</p>
    <div class="modal-buttons">
      <button class="modal-button cancel">Cancelar</button>
      <button class="modal-button confirm">Restaurar</button>
    </div>
  `;

  modal.querySelector('.cancel').onclick = () => overlay.remove();
  modal.querySelector('.confirm').onclick = () => {
    overlay.remove();
    onConfirm();
  };

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Formata o nome do usuário exibido
function formatarUsuario(nome) {
  if (!nome) return 'Desconhecido';
  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
}
