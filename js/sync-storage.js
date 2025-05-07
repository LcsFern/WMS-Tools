// ────────────────────────────────────────────────────────────
// CONSTANTES DE CONFIGURAÇÃO
// ────────────────────────────────────────────────────────────
const SERVER_PHP       = 'https://labsuaideia.store/api/save.php';
const SERVER_LOAD_PHP  = 'https://labsuaideia.store/api/load.php';
const WORKER_URL       = 'https://dry-scene-2df7.tjslucasvl.workers.dev/'; // fallback

const DEBOUNCE_DELAY   = 5000;     // ms debounce para save automático
const FETCH_TIMEOUT    = 10000;    // ms timeout padrão para fetch
const MAX_RETRIES      = 3;        // tentativas em fetchWithFallback

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
const LAST_MODIFIED_KEY = 'syncLastModified';

let lastModifiedMap = {};  // { key: timestamp }
let hasRestored      = false;
let syncing          = false;
let needSync         = false;
let debounceId       = null;

// ────────────────────────────────────────────────────────────
// HELPERS DE UI (loading + popups)
// ────────────────────────────────────────────────────────────
function showLoading() {
  // não duplica overlay se já existir
  if (document.getElementById('loading-overlay')) return;

  // cria container de overlay
  const d = document.createElement('div');
  Object.assign(d.style, {
    position:      'fixed',
    top:           0,
    left:          0,
    width:         '100%',
    height:        '100%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    zIndex:        9999
  });
  d.id = 'loading-overlay';

  // cria o ícone foguete com classe de animação
  const icon = document.createElement('i');
  icon.className = 'fas fa-rocket rocket-spinner';
  d.appendChild(icon);

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
// INICIALIZAÇÃO: carrega mapa de timestamps
// ────────────────────────────────────────────────────────────
try {
  lastModifiedMap = JSON.parse(localStorage.getItem(LAST_MODIFIED_KEY)) || {};
} catch {
  lastModifiedMap = {};
}

// ────────────────────────────────────────────────────────────
// INTERCEPT LOCALSTORAGE.SETITEM COM GUARDAS
// ────────────────────────────────────────────────────────────
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (key, value) => {
  // salva sempre localmente
  originalSetItem(key, value);
  
  // não faz sync automático antes da restauração inicial
  if (!hasRestored) return;

  // só interessa para as chaves monitoradas
  if (chaves.includes(key)) {
    const old = localStorage.getItem(key);
    if (old !== value) {
      lastModifiedMap[key] = Date.now();
      // grava mapa sem disparar este intercept
      originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
      scheduleSync();
    }
  }
};

// ────────────────────────────────────────────────────────────
// MARCAR E DEBOUNCE DE SINCRONIZAÇÃO
// ────────────────────────────────────────────────────────────
function scheduleSync() {
  needSync = true;
  clearTimeout(debounceId);
  debounceId = setTimeout(() => {
    if (needSync) saveStorage();
  }, DEBOUNCE_DELAY);
}

// ────────────────────────────────────────────────────────────
// FETCH COM TIMEOUT, FALLBACK E RETRIES
// ────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(to);
  }
}

async function fetchWithFallback(urls, options) {
  let err;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fetchWithTimeout(url, options);
      } catch (e) {
        err = e;
        console.warn(`Tentativa ${attempt} falhou em ${url}:`, e);
        // espera exponencial antes do retry
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw err;
}

// ────────────────────────────────────────────────────────────
// FETCH MÚLTIPLO E MERGE (RESTORE)
// ────────────────────────────────────────────────────────────
async function fetchAllEndpoints(queryStr) {
  const urls = [
    WORKER_URL + queryStr,
    SERVER_LOAD_PHP + queryStr
  ];
  const results = await Promise.allSettled(
    urls.map(url =>
      fetchWithTimeout(url, { method: 'GET', cache: 'no-store' })
        .then(res => res.json())
    )
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

// ────────────────────────────────────────────────────────────
// RESTAURAR servidor → localStorage
// ────────────────────────────────────────────────────────────
async function restoreStorage() {
  if (syncing) return;
  syncing = true;
  showLoading();
  try {
    const qs = `?userId=${encodeURIComponent(userId)}`;
    const serverData = await fetchAllEndpoints(qs);

    let count = 0;
    for (let key in serverData) {
      if (!chaves.includes(key)) continue;
      const { value, timestamp } = serverData[key];
      const localTs = lastModifiedMap[key] || 0;
      if (localTs < timestamp) {
        // aplica sem disparar intercept
        originalSetItem(key, value);
        lastModifiedMap[key] = timestamp;
        count++;
      }
    }
    // salva timestamps atualizados
    originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
    if (count) showPopup(`${count} itens restaurados`, 'success');
  } catch (e) {
    console.error('❌ Erro ao restaurar:', e);
    showPopup('Falha ao restaurar dados', 'error');
  } finally {
    hasRestored = true; // desbloqueia o save automático
    syncing     = false;
    hideLoading();
  }
}

// ────────────────────────────────────────────────────────────
// SALVAR localStorage → servidor
// ────────────────────────────────────────────────────────────
async function saveStorage() {
  if (!hasRestored || syncing) return;
  syncing = true;
  needSync = false;
  showLoading();
  
  // prepara payload com timestamps atuais
  const payload = {};
  const now = Date.now();
  chaves.forEach(key => {
    const v = localStorage.getItem(key);
    if (v !== null) {
      // usamos timestamps do lastModified, ou o "now" se ausente
      lastModifiedMap[key] = lastModifiedMap[key] || now;
      payload[key] = {
        value: v,
        timestamp: lastModifiedMap[key]
      };
    }
  });
  if (!Object.keys(payload).length) {
    syncing = false;
    hideLoading();
    return;
  }

  try {
    const body = JSON.stringify({ userId, dados: JSON.stringify(payload) });
    await fetchWithFallback(
      [WORKER_URL, SERVER_PHP],
      {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body
      }
    );
    // após sucesso, atualizamos todos os timestamps para NOW,
    // garantindo que não haja sobrescrita de versões mais novas
    const tsSuccess = Date.now();
    chaves.forEach(key => {
      if (payload[key]) {
        lastModifiedMap[key] = tsSuccess;
      }
    });
    originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
    console.log('✅ Sincronizado com sucesso');
    showPopup('Dados sincronizados com sucesso', 'success');
  } catch (e) {
    console.error('❌ Erro na sincronização:', e);
    showPopup('Falha ao sincronizar. Ver console.', 'error');
    needSync = true; // re-tenta depois
  } finally {
    syncing = false;
    hideLoading();
  }
}

// ────────────────────────────────────────────────────────────
// EVENTOS DE REDE E CICLO DE VIDA
// ────────────────────────────────────────────────────────────
function onlineHandler() {
  console.log('✅ Online: restaurando + salvando');
  restoreStorage().then(() => {
    if (needSync) saveStorage();
  });
}

window.addEventListener('online',  onlineHandler);
window.addEventListener('offline', () => console.log('🛑 Offline'));

window.addEventListener('beforeunload', () => {
  if (navigator.onLine && needSync) saveStorage();
});

document.addEventListener('DOMContentLoaded', () => {
  if (navigator.onLine) {
    restoreStorage();
  } else {
    hasRestored = true;
  }
  // re-restaura em iframes
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
