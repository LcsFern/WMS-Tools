////////////////////////////////////////////////////////////////////////////////
// ─── CONFIGURAÇÕES ──────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

// URLs do servidor (save.php e load.php continuam os mesmos)
const SERVER_SAVE   = 'https://labsuaideia.store/api/save.php';
const SERVER_LOAD   = 'https://labsuaideia.store/api/load.php';
const WORKER_URL    = 'https://dry-scene-2df7.tjslucasvl.workers.dev/';

const FETCH_TIMEOUT = 30000;  // ms
const MAX_RETRIES   = 3;      // Tentativas por requisição

// Todas as chaves que serão sincronizadas
const SYNC_KEYS = [
  'ondasDinamicos','gradeCompleta','movimentacoesProcessadas',
  'ondas','estadoMonitorResultados','estadoCheckboxMonitor',
  'htmlDashboard','arrayRanking','ondasReabastecimentoseabastecimentos,
  'pickingData','pickingTimestamp'
];

// Internal storage keys
const QUEUE_KEY  = 'syncQueue';
const TS_MAP_KEY = 'syncLastModified';

// Identificador global (todos compartilham os mesmos dados)
const bucketId = 'all';  // dados são salvos em bucket global
const userId   = (localStorage.getItem('username') || 'desconhecido').toLowerCase();

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

  // Fecha o spinner automaticamente após 1,5 s (1500 ms)
  setTimeout(hideLoading, 1500);
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

  // só reage se for chave sincronizada e valor mudou
  if (value === prev || !SYNC_KEYS.includes(key)) return;

  const ts = Date.now();
  lastModifiedMap[key] = ts;

  // Evita duplicar na fila
  queue.push({ userId, key, value, timestamp: ts, bucketId });
  saveTsMap();
  saveQueue();

  showLoading();

flushQueue().finally(hideLoading);
};



// Envia a fila de dados para o servidor
async function flushQueue() {
  if (flushing || !navigator.onLine || queue.length === 0) return 0;
  flushing = true;
  let successCount = 0;

  try {
    for (const op of [...queue]) {
      try {
        const { userId, bucketId, key, value, timestamp } = op;
        const body = JSON.stringify({ userId, key, value, timestamp });
        const uploadURL = `${SERVER_SAVE}?userId=${encodeURIComponent(bucketId)}`;
        await fetchWithFallback(
          [uploadURL, WORKER_URL],
          { method: 'POST', headers: {'Content-Type': 'application/json'}, body }
        );

        // Remove da fila
        queue = queue.filter(q => !(q.key === op.key && q.timestamp === op.timestamp));
        lastModifiedMap[op.key] = op.timestamp;
        saveQueue();
        saveTsMap();
        successCount++;
      } catch (e) {
        if (e.name === 'AbortError') {
  console.warn(`Tempo excedido ao sincronizar "${op.key}".`);
} else {
  console.error(`Erro ao sincronizar "${op.key}":`, e);
}
        showPopup(`Erro ao sincronizar "${op.key}".`, 'error');
        // Não remove da fila, tenta novamente na próxima execução
      }
    }

    // Notificar resultado da sincronização
    if (successCount > 0) {
      showPopup(`${successCount} item(ns) sincronizado(s) com sucesso.`, 'success');
    } else {
      showPopup('Nenhum dado para enviar.', 'info');
    }
    return successCount;
  } catch (e) {
    console.error('Erro geral em flushQueue:', e);
    showPopup('Erro ao sincronizar dados. Será re-tentado em 5 min.', 'error');
    return 0;
  } finally {
    flushing = false;
  }
}


////////////////////////////////////////////////////////////////////////////////
// ─── RESTAURA DO SERVIDOR ─────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
// Função para restaurar dados com verificação de timestamp
async function restoreStorage() {
  if (!navigator.onLine) return 0; // Não tenta restaurar se estiver offline
  showLoading();

  let applied = 0;
  try {
    const res = await fetchWithTimeout(`${SERVER_LOAD}?userId=${bucketId}`, { cache: 'no-store' });
    const json = await res.json();

    if (json.dados) {
      for (const [key, { value, timestamp }] of Object.entries(json.dados)) {
        if (!SYNC_KEYS.includes(key)) continue;

        const localValue = localStorage.getItem(key);
        const localTimestamp = lastModifiedMap[key] || 0;

        // Aplica a restauração somente se o valor do servidor for mais novo
        if (localValue === null || timestamp > localTimestamp) {
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

  // Retorna o número de itens restaurados
  return applied;
}


////////////////////////////////////////////////////////////////////////////////
// ─── EVENTOS DE REDE ────────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
window.addEventListener('online',  () => { showPopup('Online', 'info'); /* REMOVER restoreStorage(); */ });
window.addEventListener('offline', () => showPopup('Offline', 'error'));


////////////////////////////////////////////////////////////////////////////////
// ─── Expondo restoreStorage para uso externo ───────────────────────────────
////////////////////////////////////////////////////////////////////////////////
window.restoreStorage = restoreStorage;

////////////////////////////////////////////////////////////////////////////////
// ─── Chamável via console: sincroniza manualmente ───────────────────────────
////////////////////////////////////////////////////////////////////////////////
window.sincronizarAgora = async () => {
  if (!navigator.onLine) return showPopup('Sem conexão', 'error');
  showPopup('Sincronizando manualmente...', 'info');
  await flushQueue();
  await restoreStorage();
};
////////////////////////////////////////////////////////////////////////////////
// ─── RESTAURAÇÃO PERIÓDICA ──────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

// A cada 15 minutos (em ms), tenta restaurar dados se a aba estiver ativa
setInterval(() => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    console.log('[Sync] Verificando atualizações do servidor...');
    showPopup('Verificando atualizações do servidor...', 'info');
    // Chama a função de restauração
    restoreStorage();
  }
}, 900000); // 15 minutos em milissegundos
// ─── RETRY DE SINCRONIZAÇÃO A CADA 5 MINUTOS ─────────────────────────────
setInterval(() => {
  if (navigator.onLine) {
    console.log('[Sync] Tentativa automática de Sincronização...');
    showPopup('Tentativa automática de Sincronização...', 'info');
    flushQueue();
  }
}, 300000); // 300000 ms = 5 minutos
////////////////////////////////////////////////////////////////////////////////
// ─── VER FILA DE SINCRONIZAÇÃO ──────────────────────────────────────────────
window.verFilaDeSincronizacao = () => {
  const fila = JSON.parse(localStorage.getItem('syncQueue')) || [];
  if (fila.length === 0) {
    showPopup('Fila de sincronização vazia.', 'info');
    console.log('[Sync] Fila vazia');
  } else {
    console.table(fila.map(({ key, timestamp }) => ({
      chave: key,
      data: new Date(timestamp).toLocaleString()
    })));
    showPopup(`Existem ${fila.length} item(ns) na fila de sincronização.`, 'info');
  }
};
