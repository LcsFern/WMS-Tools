////////////////////////////////////////////////////////////////////////////////
// ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

// URL do seu endpoint save.php (não precisa de query string)
const SERVER_SAVE   = 'https://labsuaideia.store/api/save.php';
// URL do seu Cloudflare Worker que faz proxy para o save.php
const WORKER_URL    = 'https://dry-scene-2df7.tjslucasvl.workers.dev/';

const FETCH_TIMEOUT = 10000;  // ms de timeout por requisição
const MAX_RETRIES   = 3;      // tentativas por requisição

// Todas as chaves que serão sincronizadas
const SYNC_KEYS = [
  'ondasdin','gradeCompleta','movimentacoesProcessadas',
  'ondas','result_state_monitor','checkbox_state_monitor',
  'dashboardHTML','rankingArray','reaba',
  'pickingData','pickingTimestamp'
];

// Chaves internas de localStorage
const QUEUE_KEY  = 'syncQueue';
const TS_MAP_KEY = 'syncLastModified';

// Identificador global (usar sempre este userId em save.php)
const bucketId = 'all';

// User ID real só serve para nome de usuário local, não para gravação no server
const localUserId = (localStorage.getItem('username') || 'desconhecido').toLowerCase();

let lastModifiedMap = {};
let queue            = [];
let flushing         = false;

// Carrega estado interno do localStorage
try { lastModifiedMap = JSON.parse(localStorage.getItem(TS_MAP_KEY)) || {}; } catch {}
try { queue            = JSON.parse(localStorage.getItem(QUEUE_KEY))   || []; } catch {}

////////////////////////////////////////////////////////////////////////////////
// ─── HELPERS DE UI ─────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
function showLoading() {
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
    position: 'fixed', right: '30px', bottom: '30px',
    padding: '14px 24px', borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    border: `1px solid ${COLORS[type] || COLORS.info}`,
    color: '#f8fafc', font: '14px "Segoe UI", sans-serif',
    boxShadow: `0 8px 24px ${COLORS[type]}33`,
    transform: 'translateY(30px)', opacity: 0,
    zIndex: 10001, transition: 'transform 0.4s ease, opacity 0.4s'
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

// Spinner keyframes
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

  // só reage se for chave sincronizada e valor mudou
  if (value === prev || !SYNC_KEYS.includes(key)) return;

  const ts = Date.now();
  lastModifiedMap[key] = ts;

  // adiciona na fila de envio
  queue.push({ userId: localUserId, bucketId, key, value, timestamp: ts });
  saveTsMap();
  saveQueue();

  showLoading();
  flushQueue().finally(hideLoading);
};

////////////////////////////////////////////////////////////////////////////////
// ─── ENVIA A FILA DE DADOS PARA O SERVIDOR ─────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
async function flushQueue() {
  if (flushing || !navigator.onLine || queue.length === 0) return 0;
  flushing = true;
  let successCount = 0;

  // copia a fila para evitar mutação durante o loop
  for (const op of [...queue]) {
    try {
      const { bucketId, key, value, timestamp } = op;
      // envia sempre bucketId como userId para o servidor
      const body = JSON.stringify({
        userId:    bucketId,
        key:       key,
        value:     value,
        timestamp: timestamp
      });

      // URLs de fallback: primeiro seu save.php, depois o Worker
      await fetchWithFallback(
        [SERVER_SAVE, WORKER_URL],
        { method: 'POST', headers: {'Content-Type': 'application/json'}, body }
      );

      // se salvou, remove da fila e atualiza timestamp local
      queue = queue.filter(q => !(q.key === key && q.timestamp === timestamp));
      lastModifiedMap[key] = timestamp;
      saveQueue();
      saveTsMap();
      successCount++;
    } catch (e) {
      console.error('Erro ao sincronizar chave', op.key, e);
    }
  }

  flushing = false;
  return successCount;
}

////////////////////////////////////////////////////////////////////////////////
// ─── RESTAURA DO SERVIDOR ─────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
async function restoreStorage() {
  if (!navigator.onLine) return 0;
  showLoading();
  let applied = 0;
  try {
    const res = await fetchWithTimeout(`${SERVER_LOAD}?userId=${bucketId}`, { cache: 'no-store' });
    const json = await res.json();
    if (json.dados) {
      for (const [key, { value, timestamp }] of Object.entries(json.dados)) {
        if (!SYNC_KEYS.includes(key)) continue;
        const localValue     = localStorage.getItem(key);
        const localTimestamp = lastModifiedMap[key] || 0;
        if (localValue === null || timestamp > localTimestamp) {
          // usa originalSetItem para não retriggerar a fila
          originalSetItem(key, value);
          lastModifiedMap[key] = timestamp;
          applied++;
        }
      }
    }
  } catch (e) {
    console.error('Erro ao restaurar:', e);
    showPopup('Falha ao restaurar dados', 'error');
  } finally {
    hideLoading();
    flushing = false;
    flushQueue();
  }
  return applied;
}

////////////////////////////////////////////////////////////////////////////////
// ─── EVENTOS DE REDE ────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
window.addEventListener('online',  () => showPopup('Online', 'info'));
window.addEventListener('offline', () => showPopup('Offline', 'error'));

////////////////////////////////////////////////////////////////////////////////
// ─── EXPÕE FUNÇÕES PARA USO EXTERNO ────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
window.restoreStorage    = restoreStorage;
window.sincronizarAgora  = async () => {
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
}, 300000); // a cada 5 minutos