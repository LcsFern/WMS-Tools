// ────────────────────────────────────────────────────────────
// CONSTANTES DE CONFIGURAÇÃO
// ────────────────────────────────────────────────────────────
const SERVER_PHP       = 'https://labsuaideia.store/api/save.php';
const SERVER_LOAD_PHP  = 'https://labsuaideia.store/api/load.php';
const WORKER_URL       = 'https://tight-field-106d.tjslucasvl.workers.dev/'; // fallback em caso de falha

// ────────────────────────────────────────────────────────────
// VARIÁVEIS DE ESTADO
// ────────────────────────────────────────────────────────────
const userId = localStorage.getItem('username')?.toLowerCase();
const chaves = [
  'ondasdin','gradeCompleta','movimentacoesProcessadas',
  'ondas','result_state_monitor','checkbox_state_monitor',
  'dashboardHTML','rankingArray','logHistoricoMudancas','reaba'
];
const LAST_MODIFIED_KEY = 'syncLastModified';
const DEBOUNCE_DELAY    = 5000; // ms

let hasRestored = false;
let syncing     = false;
let needSync    = false;
let debounceId  = null;
let lastModifiedMap = {};

// ────────────────────────────────────────────────────────────
// HELPERS DE UI (loading + popups)
// ────────────────────────────────────────────────────────────
function showLoading(msg = 'Restaurando dados...') {
  if (document.getElementById('loading-overlay')) return;
  const d = document.createElement('div');
  Object.assign(d.style, {
    position:'fixed',top:0,left:0,width:'100%',height:'100%',
    backgroundColor:'rgba(0,0,0,0.7)',display:'flex',
    alignItems:'center',justifyContent:'center',
    font:'24px Arial',color:'#fff',zIndex:9999
  });
  d.id = 'loading-overlay';
  d.textContent = msg;
  document.body.appendChild(d);
}
function hideLoading() {
  const d = document.getElementById('loading-overlay');
  if (d) d.remove();
}
function showPopup(msg, type = 'info') {
  const COLORS = {
    success: '#4CAF50', error: '#F44336', info: '#2196F3'
  };
  let p = document.getElementById('sync-notification-popup');
  if (!p) {
    p = document.createElement('div');
    Object.assign(p.style, {
      position:'fixed',right:'20px',bottom:'20px',
      padding:'15px 20px',borderRadius:'6px',
      boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
      font:'14px Arial',transform:'translateY(100px)',
      opacity:0,transition:'0.3s',zIndex:10000
    });
    p.id = 'sync-notification-popup';
    document.body.appendChild(p);
  }
  p.textContent = msg;
  p.style.backgroundColor = COLORS[type] || COLORS.info;
  p.style.color = '#fff';
  setTimeout(() => {
    p.style.transform = 'translateY(0)';
    p.style.opacity = '1';
  }, 10);
  setTimeout(() => {
    p.style.transform = 'translateY(100px)';
    p.style.opacity = '0';
    setTimeout(() => { p.remove(); }, 300);
  }, 3000);
}

// ────────────────────────────────────────────────────────────
// CARREGA MAPA LAST_MODIFIED DO LOCALSTORAGE
// ────────────────────────────────────────────────────────────
try {
  lastModifiedMap = JSON.parse(localStorage.getItem(LAST_MODIFIED_KEY)) || {};
} catch { lastModifiedMap = {}; }

// ────────────────────────────────────────────────────────────
// INTERCEPT LOCALSTORAGE.SETITEM
// ────────────────────────────────────────────────────────────
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (key, value) => {
  const old = localStorage.getItem(key);
  originalSetItem(key, value);
  if (chaves.includes(key) && old !== value) {
    lastModifiedMap[key] = Date.now();
    // atualiza o mapa sem recursão
    originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
    scheduleSync();
  }
};

// ────────────────────────────────────────────────────────────
// MARCAR E DEBOUNCE DE SINCRONIZAÇÃO
// ────────────────────────────────────────────────────────────
function scheduleSync() {
  needSync = true;
  if (debounceId) clearTimeout(debounceId);
  debounceId = setTimeout(() => { if (needSync) saveStorage(); }, DEBOUNCE_DELAY);
}

// ────────────────────────────────────────────────────────────
// FETCH COM FALLBACK ENTRE WORKER E PHP
// ────────────────────────────────────────────────────────────
async function fetchWithFallback(urls, options) {
  for (let url of urls) {
    try {
      const controller = new AbortController();
      const toId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(toId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      console.warn(`Falha em ${url}:`, e);
    }
  }
  throw new Error('Todas as tentativas de fetch falharam');
}

// ────────────────────────────────────────────────────────────
// SALVAR localStorage → servidor
// ────────────────────────────────────────────────────────────
async function saveStorage() {
  if (!hasRestored || syncing) return;
  const payload = {};
  chaves.forEach(key => {
    const v = localStorage.getItem(key);
    if (v !== null) {
      payload[key] = { value: v, timestamp: lastModifiedMap[key] || Date.now() };
    }
  });
  if (!Object.keys(payload).length) return;
  syncing = true;
  needSync = false;

  try {
    const body = JSON.stringify({ userId, dados: JSON.stringify(payload) });
    await fetchWithFallback(
      [WORKER_URL, SERVER_PHP],
      { method: 'POST', headers: { 'Content-Type':'application/json' }, body }
    );
    console.log('✅ Sincronizado com sucesso');
    showPopup('Dados sincronizados com sucesso', 'success');
  } catch (e) {
    console.error('❌ Erro na sincronização:', e);
    showPopup('Falha ao sincronizar. Ver console.', 'error');
    needSync = true; // re-tentar depois
  } finally {
    syncing = false;
  }
}

// ────────────────────────────────────────────────────────────
// RESTAURAR servidor → localStorage
// ────────────────────────────────────────────────────────────
async function restoreStorage() {
  if (syncing) return;
  syncing = true;
  showLoading();

  try {
    const query = `?userId=${encodeURIComponent(userId)}`;
    const res = await fetchWithFallback(
      [WORKER_URL + query, SERVER_LOAD_PHP + query],
      { method: 'GET' }
    );
    const data = await res.json();
    if (data?.dados) {
      const serverData = JSON.parse(data.dados);
      let count = 0;
      for (let key in serverData) {
        if (!chaves.includes(key)) continue;
        const { value, timestamp } = serverData[key];
        if ((lastModifiedMap[key] || 0) < timestamp) {
          // aplica sem disparar sync
          const skip = originalSetItem;
          skip.call(localStorage, key, value);
          lastModifiedMap[key] = timestamp;
          count++;
        }
      }
      // salva novo mapa
      originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
      if (count) showPopup(`${count} itens restaurados`, 'success');
    }
  } catch (e) {
    console.error('❌ Erro ao restaurar:', e);
    showPopup('Falha ao restaurar dados', 'error');
  } finally {
    hasRestored = true;
    syncing = false;
    hideLoading();
  }
}

// ────────────────────────────────────────────────────────────
// EVENTOS DE REDE E VIDA ÚTIL DA PÁGINA
// ────────────────────────────────────────────────────────────
function onlineHandler() {
  console.log('✅ Online: restaurando + salvando');
  restoreStorage().then(saveStorage);
}
window.addEventListener('online',  onlineHandler);
window.addEventListener('offline', () => console.log('🛑 Offline'));

window.addEventListener('beforeunload', () => {
  if (navigator.onLine && needSync) saveStorage();
});

document.addEventListener('DOMContentLoaded', () => {
  navigator.onLine ? restoreStorage() : (hasRestored = true);
  // re-restaura em iframes após carregarem
  document.querySelectorAll('iframe').forEach(frm =>
    frm.addEventListener('load', () => {
      if (navigator.onLine) restoreStorage();
    })
  );
});

// expõe função manual
window.sincronizarAgora = async () => {
  if (!navigator.onLine) return showPopup('Sem conexão com a internet', 'error');
  showPopup('Sincronizando...', 'info');
  try {
    await restoreStorage();
    await saveStorage();
    showPopup('Sincronização concluída', 'success');
  } catch {
    showPopup('Erro durante a sincronização', 'error');
  }
};
