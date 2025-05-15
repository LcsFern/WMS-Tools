////////////////////////////////////////////////////////////////////////////////
// ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

const SERVER_SAVE   = 'https://labsuaideia.store/api/save.php';
const SERVER_LOAD   = 'https://labsuaideia.store/api/load.php';
const WORKER_URL    = 'https://dry-scene-2df7.tjslucasvl.workers.dev/';

const FETCH_TIMEOUT = 10000;  // Tempo limite para requisições em ms
const MAX_RETRIES   = 3;      // Número máximo de tentativas

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
let loadingStartTime = 0;

try { lastModifiedMap = JSON.parse(localStorage.getItem(TS_MAP_KEY)) || {}; } catch {}
try { queue            = JSON.parse(localStorage.getItem(QUEUE_KEY))   || []; } catch {}

////////////////////////////////////////////////////////////////////////////////
// ─── HELPERS DE UI ─────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

// Exibe o overlay de carregamento
function showLoading() {
  if (document.getElementById('loading-overlay')) return;
  loadingStartTime = Date.now();

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

// Esconde o overlay de carregamento
function hideLoading() {
  const o = document.getElementById('loading-overlay');
  if (!o) return;
  o.style.opacity = '0';
  o.addEventListener('transitionend', () => o.remove(), { once:true });
}

// Mostra uma notificação flutuante
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

// Keyframes para animação do spinner
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
  // salva sempre no storage
  originalSetItem(key, value);

  // só sincroniza se a chave estiver na lista
  if (!SYNC_KEYS.includes(key)) return;

  // registra timestamp e adiciona na fila
  const ts = Date.now();
  lastModifiedMap[key] = ts;
  queue.push({ userId, key, value, timestamp: ts, bucketId });
  saveTsMap();
  saveQueue();

  // exibe spinner e marca início
  showLoading();

  // dispara a sincronização
  flushQueue().then(success => {
    const elapsed = Date.now() - loadingStartTime;
    const delay = Math.max(0, 1500 - elapsed);

    setTimeout(() => {
      hideLoading();
      if (success > 0) {
        showPopup(`🔄 ${success} dado${success > 1 ? 's' : ''} sincronizado${success > 1 ? 's' : ''}`, 'success');
      } else {
        showPopup('⚠️ Nenhum dado sincronizado', 'error');
      }
    }, delay);
  }).catch(err => {
    const elapsed = Date.now() - loadingStartTime;
    const delay = Math.max(0, 1500 - elapsed);

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
      // usa userId correto
      const uploadURL = `${SERVER_SAVE}?userId=${encodeURIComponent(userId)}`;

      await fetchWithFallback(
        [uploadURL, WORKER_URL],
        { method: 'POST', headers: {'Content-Type': 'application/json'}, body }
      );

      // remove da fila e atualiza ts
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

  // se ainda tiver dados na fila, agenda nova tentativa
  if (queue.length > 0 && navigator.onLine && !retryTimeout) {
    retryTimeout = setTimeout(() => {
      retryTimeout = null;
      flushQueue();
    }, 30000);
  }

  return successCount;
}

////////////////////////////////////////////////////////////////////////////////
// ─── RESTAURA DO SERVIDOR ─────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

async function restoreStorage() {
  if (!navigator.onLine) return 0;
  showLoading();
  loadingStartTime = Date.now();

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
    applied = -1;
  } finally {
    const elapsed = Date.now() - loadingStartTime;
    const delay = Math.max(0, 1500 - elapsed);

    setTimeout(() => {
      hideLoading();
      if (applied > 0) {
        showPopup(`☁️ ${applied} item${applied > 1 ? 's' : ''} restaurado${applied > 1 ? 's' : ''}`, 'success');
      } else if (applied === 0) {
        showPopup('ℹ️ Nenhum dado novo encontrado', 'info');
      } else {
        showPopup('❌ Falha ao restaurar dados', 'error');
      }
      flushing = false;
      flushQueue();
    }, delay);
  }

  return applied;
}

////////////////////////////////////////////////////////////////////////////////
// ─── EVENTOS DE REDE ────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

window.addEventListener('online',  () => { showPopup('📶 Online', 'info'); });
window.addEventListener('offline', () => showPopup('📴 Offline', 'error'));

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
}, 300000); // A cada 5 minutos