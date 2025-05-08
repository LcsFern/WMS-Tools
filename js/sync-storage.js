// ────────────────────────────────────────────────────────────
// CONSTANTES DE CONFIGURAÇÃO
// ────────────────────────────────────────────────────────────
const SERVER_PHP      = 'https://labsuaideia.store/api/save.php';
const SERVER_LOAD_PHP = 'https://labsuaideia.store/api/load.php';
const WORKER_URL      = 'https://dry-scene-2df7.tjslucasvl.workers.dev/'; // fallback

const FETCH_TIMEOUT   = 10000;  // ms para abortar fetch
const MAX_RETRIES     = 3;      // tentativas por endpoint
const QUEUE_KEY       = 'syncQueue';        // fila no localStorage
const TS_MAP_KEY      = 'syncLastModified'; // mapa timestamps no localStorage

// ────────────────────────────────────────────────────────────
// VARIÁVEIS DE ESTADO
// ────────────────────────────────────────────────────────────
const userId = localStorage.getItem('username')?.toLowerCase();
const chaves = [
  'ondasdin','gradeCompleta','movimentacoesProcessadas',
  'ondas','result_state_monitor','checkbox_state_monitor',
  'dashboardHTML','rankingArray','logHistoricoMudancas','reaba',
  'pickingData','pickingTimestamp'
];

let lastModifiedMap = {};     // { key: timestamp }
let queue            = [];    // [ { key, value, timestamp }, … ]
let flushing         = false; // flag para não duplicar envios

// ────────────────────────────────────────────────────────────
// INICIALIZAÇÃO: carrega fila e timestamps do localStorage
// ────────────────────────────────────────────────────────────
try {
  lastModifiedMap = JSON.parse(localStorage.getItem(TS_MAP_KEY)) || {};
} catch {
  lastModifiedMap = {};
}
try {
  queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
} catch {
  queue = [];
}

// ────────────────────────────────────────────────────────────
// HELPERS DE UI (loading + popups) COM ANIMAÇÕES
// ────────────────────────────────────────────────────────────
function showLoading() {
  if (document.getElementById('loading-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  Object.assign(overlay.style, {
    position:      'fixed',
    top:           0,
    left:          0,
    width:         '100%',
    height:        '100%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    zIndex:        9999,
    opacity:       '0',
    transition:    'opacity 0.3s ease'
  });
  const icon = document.createElement('i');
  icon.className = 'fas fa-rocket rocket-spinner';
  Object.assign(icon.style, {
    fontSize: '3rem',
    color:    '#008d4c',
    animation:'spin 1s linear infinite'
  });
  overlay.appendChild(icon);
  document.body.appendChild(overlay);
  // trigger animação de fade-in
  requestAnimationFrame(() => overlay.style.opacity = '1');
}
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}
function showPopup(msg, type = 'info') {
  const COLORS = {
    success: '#4CAF50',
    error: '#F44336',
    info: '#2196F3'
  };

  // Remove popup anterior se existir
  let oldPopup = document.getElementById('sync-notification-popup');
  if (oldPopup) oldPopup.remove();

  // Cria novo popup
  const popup = document.createElement('div');
  popup.id = 'sync-notification-popup';
  popup.textContent = msg;

  popup.style.cssText = `
    position: fixed !important;
    right: 20px !important;
    bottom: 20px !important;
    padding: 15px 20px !important;
    border-radius: 6px !important;
    background-color: ${COLORS[type] || COLORS.info} !important;
    color: #fff !important;
    font: 14px Arial, sans-serif !important;
    z-index: 2147483647 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    opacity: 0 !important;
    transform: translateY(20px) !important;
    transition: opacity 0.4s ease, transform 0.4s ease !important;
    pointer-events: none !important;
  `;

  document.body.appendChild(popup);

  // Força reflow antes de animar
  void popup.offsetWidth;

  // Inicia animação
  popup.style.opacity = '1';
  popup.style.transform = 'translateY(0)';

  // Remove após 3 segundos
  setTimeout(() => {
    popup.style.opacity = '0';
    popup.style.transform = 'translateY(20px)';
    setTimeout(() => popup.remove(), 400); // garante remoção mesmo se 'transitionend' falhar
  }, 3000);
}



// adiciona estilos de animação global
const style = document.createElement('style');
style.textContent = `
@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
.rocket-spinner { /* caso queira classe extra */ }
`;
document.head.appendChild(style);

// ────────────────────────────────────────────────────────────
// FUNÇÕES AUXILIARES DE PERSISTÊNCIA
// ────────────────────────────────────────────────────────────
function saveTsMap() {
  localStorage.setItem(TS_MAP_KEY, JSON.stringify(lastModifiedMap));
}
function saveQueue() {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ────────────────────────────────────────────────────────────
// FETCH COM TIMEOUT, FALLBACK E RETRIES
// ────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(id);
  }
}
async function fetchWithFallback(urls, options) {
  let err;
  for (let url of urls) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fetchWithTimeout(url, options);
      } catch (e) {
        err = e;
        console.warn(`Falha ${attempt} em ${url}:`, e);
        await new Promise(r => setTimeout(r, 300 * attempt));
      }
    }
  }
  throw err;
}

// ────────────────────────────────────────────────────────────
// INTERCEPT LOCALSTORAGE.SETITEM → ENFILEIRA OPERAÇÃO
// ────────────────────────────────────────────────────────────
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (key, value) => {
  originalSetItem(key, value);
  if (!chaves.includes(key)) return;

  const ts = Date.now();
  lastModifiedMap[key] = ts;
  saveTsMap();

  queue.push({ key, value, timestamp: ts });
  saveQueue();

  showLoading();
  flushQueue().finally(hideLoading);
};

// ────────────────────────────────────────────────────────────
// ENVIO DAS OPERAÇÕES PENDENTES (FIFO, atomic batch)
// ────────────────────────────────────────────────────────────
async function flushQueue() {
  if (flushing || !navigator.onLine || queue.length === 0) return;
  flushing = true;

  // agrupa pela última operação de cada chave
  const batchMap = {};
  queue.forEach(op => batchMap[op.key] = op);
  const payloadDados = {};
  for (let key in batchMap) {
    const { value, timestamp } = batchMap[key];
    payloadDados[key] = { value, timestamp };
  }
  const body = JSON.stringify({ userId, dados: JSON.stringify(payloadDados) });

  try {
    await fetchWithFallback(
      [SERVER_PHP, WORKER_URL],
      { method:'POST', headers:{'Content-Type':'application/json'}, body }
    );
    queue = [];
    saveQueue();
    const now = Date.now();
    for (let key in payloadDados) lastModifiedMap[key] = now;
    saveTsMap();

    showPopup('Dados sincronizados com sucesso', 'success');
  } catch (e) {
    console.error('❌ Falha no flush:', e);
    showPopup('Erro ao sincronizar. Tentando novamente...', 'error');
  } finally {
    flushing = false;
  }
}

// ────────────────────────────────────────────────────────────
// RESTAURAR servidor → localStorage (só se mais novo)
// ────────────────────────────────────────────────────────────
async function fetchAllEndpoints(query) {
  const urls = [WORKER_URL + query, SERVER_LOAD_PHP + query];
  const results = await Promise.allSettled(
    urls.map(u => fetchWithTimeout(u, {method:'GET',cache:'no-store'}).then(r=>r.json()))
  );
  const merged = {};
  for (let r of results) {
    if (r.status === 'fulfilled' && r.value?.dados) {
      const srv = JSON.parse(r.value.dados);
      for (let key in srv) {
        const { value, timestamp } = srv[key];
        if (!merged[key] || merged[key].timestamp < timestamp) {
          merged[key] = { value, timestamp };
        }
      }
    }
  }
  return merged;
}
async function restoreStorage() {
  showLoading();
  try {
    const qs = `?userId=${encodeURIComponent(userId)}`;
    const serverData = await fetchAllEndpoints(qs);
    let applied = 0;
    for (let key in serverData) {
      if (!chaves.includes(key)) continue;
      const { value, timestamp } = serverData[key];
      const localTs = lastModifiedMap[key] || 0;
      if (timestamp > localTs) {
        originalSetItem(key, value);
        lastModifiedMap[key] = timestamp;
        applied++;
      }
    }
    if (applied) showPopup(`${applied} itens restaurados`, 'info');
    saveTsMap();
  } catch (e) {
    console.error('❌ Erro ao restaurar:', e);
    showPopup('Falha ao restaurar dados', 'error');
  } finally {
    hideLoading();
    // após restaurar, tenta enviar qualquer mudança
    flushing = false;
    flushQueue();
  }
}

// ────────────────────────────────────────────────────────────
// EVENTOS DE REDE E CICLO DE VIDA
// ────────────────────────────────────────────────────────────
window.addEventListener('online',  () => { showPopup('Online', 'info'); restoreStorage(); });
window.addEventListener('offline', () => showPopup('Offline', 'error'));

window.addEventListener('beforeunload', () => {
  if (navigator.onLine) flushQueue();
});

document.addEventListener('DOMContentLoaded', () => {
  if (navigator.onLine) restoreStorage();
  else showPopup('Iniciado offline; aguardando conexão', 'info');
});

// ────────────────────────────────────────────────────────────
// FUNÇÃO MANUAL PARA DEBUG
// ────────────────────────────────────────────────────────────
window.sincronizarAgora = async () => {
  if (!navigator.onLine) return showPopup('Sem conexão', 'error');
  showPopup('Sincronizando manualmente...', 'info');
  try {
    await restoreStorage();
    await flushQueue();
    showPopup('Sincronização concluída', 'success');
  } catch {
    showPopup('Erro na sincronização manual', 'error');
  }
};
