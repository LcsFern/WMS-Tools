////////////////////////////////////////////////////////////////////////////////
// ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

const SERVER_SAVE   = 'https://labsuaideia.store/api/save.php';
const SERVER_LOAD   = 'https://labsuaideia.store/api/load.php';
const WORKER_URL    = 'https://dry-scene-2df7.tjslucasvl.workers.dev/';

const FETCH_TIMEOUT = 10000;
const MAX_RETRIES   = 3;

const SYNC_KEYS = [
  'ondasdin','gradeCompleta','movimentacoesProcessadas',
  'ondas','result_state_monitor','checkbox_state_monitor',
  'dashboardHTML','rankingArray','reaba',
  'pickingData','pickingTimestamp'
];

const QUEUE_KEY  = 'syncQueue';
const TS_MAP_KEY = 'syncLastModified';

const bucketId = 'all';
const userId   = (localStorage.getItem('username') || 'desconhecido').toLowerCase();

let queue = [];
let flushing = false;
let retryTimeout = null;
let lastModifiedMap = {};

try { lastModifiedMap = JSON.parse(localStorage.getItem(TS_MAP_KEY)) || {}; } catch {}
try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch {}

////////////////////////////////////////////////////////////////////////////////
// ─── FUNÇÕES VISUAIS (POPUP E LOADING) ──────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

// Mostra um overlay de carregamento
function showLoading(text = 'Carregando...') {
  let el = document.getElementById('custom-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'custom-loading';
    el.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      font-family: sans-serif; font-size: 1.2rem; color: white;
    `;
    el.innerHTML = `<div id="custom-loading-text">${text}</div>`;
    document.body.appendChild(el);
  } else {
    document.getElementById('custom-loading-text').textContent = text;
    el.style.display = 'flex';
  }
}

// Esconde o overlay de carregamento
function hideLoading() {
  const el = document.getElementById('custom-loading');
  if (el) el.style.display = 'none';
}

// Mostra um popup temporário
function showPopup(msg = '', tempo = 3000) {
  const popup = document.createElement('div');
  popup.textContent = msg;
  popup.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: #00a65a; color: white; padding: 12px 24px;
    border-radius: 8px; font-family: sans-serif; z-index: 9999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.4); font-size: 1rem;
    opacity: 0; transition: opacity 0.3s ease;
  `;
  document.body.appendChild(popup);
  setTimeout(() => { popup.style.opacity = 1; }, 10);
  setTimeout(() => {
    popup.style.opacity = 0;
    setTimeout(() => popup.remove(), 300);
  }, tempo);
}

////////////////////////////////////////////////////////////////////////////////
// ─── FUNÇÕES AUXILIARES ─────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

const saveQueue = () => localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
const saveTsMap = () => localStorage.setItem(TS_MAP_KEY, JSON.stringify(lastModifiedMap));

async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchWithFallback(urls, options) {
  let lastError;
  for (const url of urls) {
    for (let i = 1; i <= MAX_RETRIES; i++) {
      try {
        return await fetchWithTimeout(url, options);
      } catch (e) {
        lastError = e;
        await new Promise(r => setTimeout(r, 300 * i));
      }
    }
  }
  throw lastError;
}

////////////////////////////////////////////////////////////////////////////////
// ─── INTERCEPTA localStorage.setItem ────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (key, value) => {
  const prev = localStorage.getItem(key);
  originalSetItem(key, value);

  if (value === prev || !SYNC_KEYS.includes(key)) return;

  const timestamp = Date.now();
  lastModifiedMap[key] = timestamp;

  queue.push({ userId, key, value, timestamp, bucketId });
  saveQueue();
  saveTsMap();

  flushQueue();
};

////////////////////////////////////////////////////////////////////////////////
// ─── ENVIA A FILA PARA O SERVIDOR ───────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

async function flushQueue() {
  if (flushing || !navigator.onLine || queue.length === 0) return 0;
  flushing = true;
  let successCount = 0;

  showLoading('Enviando dados...');

  for (const op of [...queue]) {
    try {
      const { userId, bucketId, key, value, timestamp } = op;
      const body = JSON.stringify({ userId, key, value, timestamp });

      const uploadURL = `${SERVER_SAVE}?userId=${encodeURIComponent(bucketId)}`;

      await fetchWithFallback(
        [uploadURL, WORKER_URL],
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        }
      );

      queue = queue.filter(q => !(q.key === key && q.timestamp === timestamp));
      lastModifiedMap[key] = timestamp;
      successCount++;
    } catch (e) {
      console.error('Erro ao sincronizar', op.key, e);
    }
  }

  saveQueue();
  saveTsMap();
  flushing = false;

  hideLoading();

  if (successCount > 0) {
    showPopup(`Sincronizados ${successCount} itens com sucesso.`);
  }

  if (queue.length > 0 && navigator.onLine && !retryTimeout) {
    retryTimeout = setTimeout(() => {
      retryTimeout = null;
      flushQueue();
    }, 30000);
  }

  return successCount;
}

////////////////////////////////////////////////////////////////////////////////
// ─── RESTAURA DADOS DO SERVIDOR ─────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

async function restoreStorage() {
  if (!navigator.onLine) return 0;

  showLoading('Restaurando dados...');
  let restored = 0;

  try {
    const res = await fetchWithTimeout(`${SERVER_LOAD}?userId=${bucketId}`, { cache: 'no-store' });
    const json = await res.json();

    if (json.dados) {
      for (const [key, { value, timestamp }] of Object.entries(json.dados)) {
        if (!SYNC_KEYS.includes(key)) continue;

        const localValue = localStorage.getItem(key);
        const localTimestamp = lastModifiedMap[key] || 0;

        if (localValue === null || timestamp > localTimestamp) {
          originalSetItem(key, value);
          lastModifiedMap[key] = timestamp;
          restored++;
        }
      }
    }
  } catch (e) {
    console.error('Erro ao restaurar dados:', e);
    showPopup('Erro ao restaurar dados do servidor.');
  }

  hideLoading();
  saveTsMap();

  if (restored > 0) {
    showPopup(`Restaurados ${restored} itens do servidor.`);
  }

  return restored;
}

////////////////////////////////////////////////////////////////////////////////
// ─── FUNÇÕES GLOBAIS ────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

window.restoreStorage = restoreStorage;

window.sincronizarAgora = async () => {
  if (!navigator.onLine) {
    showPopup('Sem conexão com a internet!');
    return;
  }

  showLoading('Sincronizando...');
  await restoreStorage();
  await flushQueue();
  hideLoading();
};

////////////////////////////////////////////////////////////////////////////////
// ─── RESTAURAÇÃO AUTOMÁTICA A CADA 5 MINUTOS ───────────────────────────────
////////////////////////////////////////////////////////////////////////////////

setInterval(() => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    restoreStorage();
  }
}, 300000); // 5 minutos
