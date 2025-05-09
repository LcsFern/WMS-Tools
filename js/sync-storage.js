// sync-storage.js
// Gerencia sincronização contínua de chaves individuais do localStorage com o servidor,
// exibindo popups apenas em caso de sucesso/falha real e restaurando dados baseado em timestamps.

/* ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────── */
const SERVER_SAVE   = 'https://labsuaideia.store/api/save.php';
const SERVER_LOAD   = 'https://labsuaideia.store/api/load.php';
const WORKER_URL    = 'https://dry-scene-2df7.tjslucasvl.workers.dev/';

const FETCH_TIMEOUT = 10000;  // ms
const MAX_RETRIES   = 3;      // Tentativas por requisição

// Quais chaves do localStorage serão sincronizadas
const SYNC_KEYS = [
  'ondasdin','gradeCompleta','movimentacoesProcessadas',
  'ondas','result_state_monitor','checkbox_state_monitor',
  'dashboardHTML','rankingArray','logHistoricoMudancas','reaba',
  'pickingData','pickingTimestamp'
];

// Storage interno para fila de operações e mapa de timestamps
const QUEUE_KEY  = 'syncQueue';
const TS_MAP_KEY = 'syncLastModified';

let lastModifiedMap = {};
let queue            = [];
let flushing         = false;

// Identificador do usuário (deve vir de algum localStorage ou contexto de autenticação)
const userId = localStorage.getItem('username')?.toLowerCase();
if (!userId) {
  throw new Error('Usuário não autenticado. Por favor, faça login.');
}

/* ─── Inicializa estado interno a partir do localStorage ─────────────────── */
try { lastModifiedMap = JSON.parse(localStorage.getItem(TS_MAP_KEY)) || {}; } catch {}
try { queue            = JSON.parse(localStorage.getItem(QUEUE_KEY))   || []; } catch {}

/* ─── HELPERS DE UI ───────────────────────────────────────────────────────── */
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
  icon.className = 'fas fa-spinner';
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
function showPopup(msg, type='info') {
  const COLORS = { success:'#4CAF50', error:'#F44336', info:'#2196F3' };
  let p = document.getElementById('sync-notification-popup');
  if (p) p.remove();
  p = document.createElement('div');
  p.id = 'sync-notification-popup';
  p.textContent = msg;
  Object.assign(p.style, {
    position:'fixed', right:'20px', bottom:'20px', padding:'15px 20px',
    borderRadius:'6px', backgroundColor:COLORS[type]||COLORS.info,
    color:'#fff', boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
    font:'14px Arial, sans-serif',
    transition:'transform 0.4s ease, opacity 0.4s',
    transform:'translateY(20px)', opacity:0, zIndex:10001
  });
  document.body.appendChild(p);
  // anima entrada
  requestAnimationFrame(() => {
    p.style.transform = 'translateY(0)';
    p.style.opacity = '1';
  });
  // remove após 3s
  setTimeout(() => {
    p.style.transform = 'translateY(20px)';
    p.style.opacity = '0';
    p.addEventListener('transitionend', () => p.remove(), { once:true });
  }, 3000);
}
// keyframes para spinner
const style = document.createElement('style');
style.textContent = `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
document.head.appendChild(style);

/* ─── HELPERS DE SINCRONIZAÇÃO ─────────────────────────────────────────────── */
// Persiste fila e timestamps no localStorage
const saveQueue   = () => localStorage.setItem(QUEUE_KEY,  JSON.stringify(queue));
const saveTsMap   = () => localStorage.setItem(TS_MAP_KEY, JSON.stringify(lastModifiedMap));

// fetch com timeout
async function fetchWithTimeout(url, options={}, timeout=FETCH_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {...options, signal:controller.signal});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally { clearTimeout(id); }
}
// fallback entre server e worker
async function fetchWithFallback(urls, options) {
  let lastErr;
  for (const url of urls) {
    for (let i=1; i<=MAX_RETRIES; i++) {
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

/* ─── INTERCEPTA localStorage.setItem PARA SINCRONIZAR ─────────────────────── */
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (key, value) => {
  const prev = localStorage.getItem(key);
  originalSetItem(key, value);

  // 🛠️ Correção aqui: só salva se o valor mudou de verdade
  if (value === prev || !SYNC_KEYS.includes(key)) return;

  const ts = Date.now();
  lastModifiedMap[key] = ts;
  queue.push({ userId, key, value, timestamp: ts });
  saveTsMap();
  saveQueue();

  showLoading();
  flushQueue().finally(hideLoading);
};


/* ─── ENVIA CADA OPERAÇÃO AO SERVIDOR ─────────────────────────────────────── */
async function flushQueue() {
  if (flushing || !navigator.onLine || queue.length === 0) return;
  flushing = true;
  let successCount = 0;

  // Processa cada item da fila individualmente
  for (const op of [...queue]) {
    try {
      const body = JSON.stringify(op);
      await fetchWithFallback(
        [SERVER_SAVE, WORKER_URL],
        { method:'POST', headers:{'Content-Type':'application/json'}, body }
      );
      // remove da fila e atualiza timestamp em cache
      queue = queue.filter(q => !(q.key===op.key && q.timestamp===op.timestamp));
      lastModifiedMap[op.key] = op.timestamp;
      saveQueue();
      saveTsMap();
      successCount++;
    } catch (e) {
      console.error('Erro sync key', op.key, e);
    }
  }

  // feedback ao usuário
  if (successCount > 0) showPopup(`Sincronizados ${successCount} item(s)`, 'success');
  if (queue.length  > 0) showPopup(`${queue.length} item(s) pendente(s)`, 'error');
  flushing = false;
}

/* ─── RESTAURA DO SERVIDOR SE MAIS NOVO QUE LOCAL ─────────────────────────── */
async function restoreStorage() {
  if (!navigator.onLine) return;
  showLoading();
  try {
    const res = await fetchWithTimeout(`${SERVER_LOAD}?userId=${encodeURIComponent(userId)}`, {cache:'no-store'});
    const json = await res.json();
    let applied = 0;

    if (json.dados) {
      for (const [key, { value, timestamp }] of Object.entries(json.dados)) {
        if (!SYNC_KEYS.includes(key)) continue;
        const localTs = lastModifiedMap[key] || 0;
        if (timestamp > localTs) {
          originalSetItem(key, value);
          lastModifiedMap[key] = timestamp;
          applied++;
        }
      }
    }

    if (applied) showPopup(`${applied} item(s) restaurado(s)`, 'info');
    saveTsMap();
  } catch (e) {
    console.error('Erro ao restaurar:', e);
    showPopup('Falha ao restaurar dados', 'error');
  } finally {
    hideLoading();
    flushing = false;
    // após restaurar, tente enviar pendentes
    flushQueue();
  }
}

/* ─── EVENTOS DE REDE E CICLO DE VIDA ─────────────────────────────────────── */
window.addEventListener('online',  () => { showPopup('Online', 'info');  restoreStorage(); });
window.addEventListener('offline', () => showPopup('Offline', 'error'));
window.addEventListener('beforeunload', () => { if (navigator.onLine) flushQueue(); });
document.addEventListener('DOMContentLoaded', () => {
  if (navigator.onLine) restoreStorage();
  else showPopup('Iniciado offline; aguardando rede', 'info');
});

// Chamável via console: sincroniza manualmente
window.sincronizarAgora = async () => {
  if (!navigator.onLine) return showPopup('Sem conexão', 'error');
  showPopup('Sincronizando manualmente...', 'info');
  await restoreStorage();
  await flushQueue();
};
