////////////////////////////////////////////////////////////////////////////////
// ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

const SERVER_SAVE   = 'https://labsuaideia.store/api/save.php';
const SERVER_LOAD   = 'https://labsuaideia.store/api/load.php';
const WORKER_URL    = 'https://dry-scene-2df7.tjslucasvl.workers.dev/';

const FETCH_TIMEOUT = 10000;  // ms
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

let lastModifiedMap = {};
let queue            = [];
let flushing         = false;
let retryTimeout     = null;

try { lastModifiedMap = JSON.parse(localStorage.getItem(TS_MAP_KEY)) || {}; } catch {}
try { queue           = JSON.parse(localStorage.getItem(QUEUE_KEY))   || []; } catch {}

////////////////////////////////////////////////////////////////////////////////
// ─── HELPERS DE UI ─────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

let loadingStartTime = 0; // Armazena o tempo de início do loading

function showLoading() {
  loadingStartTime = Date.now();

  if (document.getElementById('loading-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  Object.assign(overlay.style, {
    position:'fixed', top:0, left:0, width:'100%', height:'100%',
    backgroundColor:'rgba(0,0,0,0.7)', display:'flex',
    alignItems:'center', justifyContent:'center',
    zIndex:10000, opacity:0, transition:'opacity 0.3s ease'
  });
  const icon = document.createElement('i');
  icon.className = 'fa-duotone fa-solid fa-spinner-third';
  Object.assign(icon.style, {
    fontSize:'3rem', color:'#008d4c', animation:'spin 1s linear infinite'
  });
  overlay.appendChild(icon);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.style.opacity = '1');
}

function hideLoading() {
  const o = document.getElementById('loading-overlay');
  if (!o) return;
  o.style.opacity = '0';
  o.addEventListener('transitionend', () => o.remove(), { once:true });
}

function showPopup(msg, type = 'info') {
  const COLORS = {
    success: '#34c759',
    error: '#F44336',
    info: '#2196F3'
  };

  let p = document.getElementById('sync-notification-popup');
  if (p) p.remove();

  p = document.createElement('div');
  p.id = 'sync-notification-popup';
  p.textContent = msg;

  Object.assign(p.style, {
    position: 'fixed',
    right: '30px',
    bottom: '30px',
    padding: '14px 24px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: `1px solid ${COLORS[type] || COLORS.info}`,
    color: '#f8fafc',
    font: '14px "Segoe UI", sans-serif',
    boxShadow: `0 8px 24px ${COLORS[type]}33`,
    transform: 'translateY(30px)',
    opacity: 0,
    zIndex: 10001,
    transition: 'transform 0.4s ease, opacity 0.4s'
  });

  document.body.appendChild(p);

  requestAnimationFrame(() => {
    p.style.opacity = '1';
    p.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    p.style.opacity = '0';
    p.style.transform = 'translateY(30px)';
    p.addEventListener('transitionend', () => p.remove(), { once: true });
  }, 3500);
}

// keyframes para spinner
const style = document.createElement('style');
style.textContent = `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
document.head.appendChild(style);

////////////////////////////////////////////////////////////////////////////////
// ─── HELPERS DE SINCRONIZAÇÃO ───────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

const saveQueue = () => localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
const saveTsMap = () => localStorage.setItem(TS_MAP_KEY, JSON.stringify(lastModifiedMap));

async function fetchWithTimeout(url, options={}, timeout=FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {...options, signal:controller.signal});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally { clearTimeout(id); }
}

async function fetchWithFallback(urls, options) {
  let lastErr;
  for (const url of urls) {
    for (let i = 1; i <= MAX_RETRIES; i++) {
      try {
        return await fetchWithTimeout(url, options);
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 300 * i));
      }
    }
  }
  throw lastErr;
}

////////////////////////////////////////////////////////////////////////////////
// ─── INTERCEPTA localStorage.setItem PARA SINCRONIZAR ───────────────────────
////////////////////////////////////////////////////////////////////////////////

const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (key, value) => {
  const prev = localStorage.getItem(key);
  originalSetItem(key, value);

  if (value === prev || !SYNC_KEYS.includes(key)) return;

  const ts = Date.now();
  lastModifiedMap[key] = ts;

  queue.push({ userId, key, value, timestamp: ts, bucketId });
  saveTsMap();
  saveQueue();

  showLoading();

  // Dispara sincronização e mostra notificação após loading mínimo de 1.5s
  flushQueue().then(success => {
    const delay = Math.max(0, 1500 - (Date.now() - loadingStartTime));
    setTimeout(() => {
      hideLoading();
      if (success > 0) {
        showPopup(`🔄 ${success} dado${success > 1 ? 's' : ''} sincronizado${success > 1 ? 's' : ''}`, 'success');
      } else {
        showPopup('⚠️ Nenhum dado sincronizado', 'error');
      }
    }, delay);
  }).catch(err => {
    const delay = Math.max(0, 1500 - (Date.now() - loadingStartTime));
    setTimeout(() => {
      hideLoading();
      showPopup('❌ Erro na sincronização', 'error');
      console.error('Erro no flushQueue:', err);
    }, delay);
  });
};

////////////////////////////////////////////////////////////////////////////////
// ─── Envia a fila de dados para o servidor ──────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

async function flushQueue() {
  if (flushing || !navigator.onLine || queue.length === 0) return 0;
  flushing = true;
  let successCount = 0;

  for (const op of [...queue]) {
    try {
      const { userId, bucketId, key, value, timestamp } = op;
      const body = JSON.stringify({ userId, key, value, timestamp });
      const uploadURL = `${SERVER_SAVE}?userId=${encodeURIComponent(bucketId)}`;

      await fetchWithFallback(
        [uploadURL, WORKER_URL],
        { method: 'POST', headers: {'Content-Type': 'application/json'}, body }
      );

      queue = queue.filter(q => !(q.key === op.key && q.timestamp === op.timestamp));
      lastModifiedMap[op.key] = op.timestamp;
      saveQueue();
      saveTsMap();
      successCount++;
    } catch (e) {
      console.error('Erro sync key', op.key, e);
    }
  }

  flushing = false;

  // Se ainda restaram dados na fila, agendar nova tentativa
  if (queue.length > 0 && navigator.onLine && !retryTimeout) {
    retryTimeout = setTimeout(() => {
      retryTimeout = null;
      flushQueue();
    }, 30000); // 30 segundos
  }

  return successCount;
}

////////////////////////////////////////////////////////////////////////////////
// ─── RESTAURA DO SERVIDOR ─────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

async function restoreStorage() {
  if (!navigator.onLine) return 0;
  showLoading();
  const start = Date.now();
  let applied = 0;

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
          applied++;
        }
      }
    }
  } catch (e) {
    console.error('Erro ao restaurar:', e);
  }

  const delay = Math.max(0, 1500 - (Date.now() - start));
  setTimeout(() => {
    hideLoading();
    showPopup(applied > 0 ? `✔️ ${applied} chave${applied > 1 ? 's' : ''} restaurada${applied > 1 ? 's' : ''}` : '⚠️ Nenhuma chave restaurada', applied > 0 ? 'success' : 'info');
    flushing = false;
    flushQueue();
  }, delay);

  return applied;
}

////////////////////////////////////////////////////////////////////////////////
// ─── EVENTOS DE REDE ────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

window.addEventListener('online',  () => { showPopup('Online', 'info'); });
window.addEventListener('offline', () => showPopup('Offline', 'error'));

////////////////////////////////////////////////////////////////////////////////
// ─── Expondo funções úteis globalmente ──────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

window.restoreStorage = restoreStorage;

window.sincronizarAgora = async () => {
  if (!navigator.onLine) return showPopup('Sem conexão', 'error');
  showPopup('Sincronizando manualmente...', 'info');
  await restoreStorage();
  await flushQueue();
};

////////////////////////////////////////////////////////////////////////////////
// ─── RESTAURAÇÃO PERIÓDICA ──────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

setInterval(() => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    console.log('[Sync] Verificando atualizações do servidor...');
    restoreStorage();
  }
}, 300000); // 5 minutos
