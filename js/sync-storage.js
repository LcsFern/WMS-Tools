(function () {
  const SERVER_PHP = 'https://labsuaideia.store/api/save.php'; // <- Atualize com sua URL real
  const SERVER_LOAD_PHP = 'https://labsuaideia.store/api/load.php'; // <- Atualize com sua URL real
  const WORKER_URL = 'https://tight-field-106d.tjslucasvl.workers.dev/'; // Fallback

  const userId = localStorage.getItem('username')?.toLowerCase();
  const LAST_MODIFIED_KEY = 'syncLastModified';
  const DEBOUNCE_DELAY = 5000;
  
  const keysToSync = [
    'ondasdin', 'gradeCompleta', 'movimentacoesProcessadas',
    'ondas', 'result_state_monitor', 'checkbox_state_monitor',
    'dashboardHTML', 'rankingArray', 'logHistoricoMudancas', 'reaba',
  ];
  
  let hasRestored = false;
  let syncingNow = false;
  let skipSync = false;
  let needSync = false;
  let debounceTimer = null;
  let lastModified = {};

  try {
    lastModified = JSON.parse(localStorage.getItem(LAST_MODIFIED_KEY)) || {};
  } catch { }

  function showToast(msg, type = 'info') {
    let toast = document.createElement('div');
    toast.className = `toast-${type}`;
    toast.style = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
      color: white;
      padding: 12px 18px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      opacity: 0;
      transform: translateY(30px);
      transition: all 0.3s ease;
      z-index: 10000;
    `;
    toast.innerText = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(30px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    const oldValue = localStorage.getItem(key);
    originalSetItem(key, value);
    if (skipSync) return;
    if (keysToSync.includes(key) && oldValue !== value) {
      lastModified[key] = Date.now();
      skipSync = true;
      originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModified));
      skipSync = false;
      markForSync();
    }
  };

  function markForSync() {
    needSync = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (needSync) saveStorage();
    }, DEBOUNCE_DELAY);
  }

  async function saveStorage() {
    if (!hasRestored || syncingNow) return;
    syncingNow = true;
    needSync = false;

    const payload = {};
    keysToSync.forEach(key => {
      const val = localStorage.getItem(key);
      if (val !== null) {
        payload[key] = { value: val, timestamp: lastModified[key] || Date.now() };
      }
    });

    if (Object.keys(payload).length === 0) {
      syncingNow = false;
      return;
    }

    const body = JSON.stringify({ userId, dados: JSON.stringify(payload) });

    try {
      const res = await fetch(SERVER_PHP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) throw new Error('Falha PHP');
      showToast('✔️ Dados salvos com sucesso!', 'success');
    } catch (e) {
      console.warn('Erro PHP, tentando Worker...', e);
      try {
        await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(10000)
        });
        showToast('✔️ Salvo via fallback Worker!', 'info');
      } catch (err2) {
        console.error('Erro total:', err2);
        showToast('❌ Falha ao salvar dados', 'error');
        needSync = true;
      }
    } finally {
      syncingNow = false;
    }
  }

  async function restoreStorage() {
    if (syncingNow) return;
    syncingNow = true;

    try {
      const res = await fetch(`${SERVER_LOAD_PHP}?userId=${userId}`, {
        signal: AbortSignal.timeout(10000)
      });

      if (!res.ok) throw new Error('Falha PHP load');
      const data = await res.json();
      if (!data?.dados) {
        hasRestored = true;
        syncingNow = false;
        return;
      }

      const serverData = JSON.parse(data.dados);
      let restoredCount = 0;

      for (const key of Object.keys(serverData)) {
        if (!keysToSync.includes(key)) continue;
        const { value, timestamp } = serverData[key];
        const localValue = localStorage.getItem(key);
        const localTime = lastModified[key] || 0;
        if (timestamp > localTime && value !== null && value !== "") {
          skipSync = true;
          originalSetItem(key, value);
          skipSync = false;
          lastModified[key] = timestamp;
          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        skipSync = true;
        originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModified));
        skipSync = false;
        showToast(`✅ ${restoredCount} dados restaurados!`, 'success');
      }
    } catch (err) {
      console.warn('Falha no PHP, tentando Worker...', err);
      try {
        const res = await fetch(`${WORKER_URL}?userId=${userId}`, { signal: AbortSignal.timeout(10000) });
        const data = await res.json();
        if (!data?.dados) return;
        const serverData = JSON.parse(data.dados);
        let restoredCount = 0;

        for (const key of Object.keys(serverData)) {
          if (!keysToSync.includes(key)) continue;
          const { value, timestamp } = serverData[key];
          const localValue = localStorage.getItem(key);
          const localTime = lastModified[key] || 0;
          if (timestamp > localTime && value !== null && value !== "") {
            skipSync = true;
            originalSetItem(key, value);
            skipSync = false;
            lastModified[key] = timestamp;
            restoredCount++;
          }
        }

        if (restoredCount > 0) {
          skipSync = true;
          originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModified));
          skipSync = false;
          showToast(`✅ ${restoredCount} dados restaurados pelo Worker!`, 'info');
        }
      } catch (err2) {
        console.error('Falha total ao restaurar:', err2);
        showToast('❌ Falha ao restaurar dados', 'error');
      }
    } finally {
      hasRestored = true;
      syncingNow = false;
    }
  }

  window.sincronizarAgora = function () {
    if (!navigator.onLine) return showToast('❌ Sem conexão', 'error');
    restoreStorage().then(() => saveStorage());
  };

  window.addEventListener('online', () => {
    restoreStorage().then(() => saveStorage());
  });

  window.addEventListener('beforeunload', () => {
    if (navigator.onLine && needSync) saveStorage();
  });

  if (navigator.onLine) restoreStorage();
})();
