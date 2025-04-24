(function () {
  const userId = localStorage.getItem('username')?.toLowerCase();
  if (!userId) return;

  const chavesParaSincronizar = [
    'ondasdin', 'gradeCompleta', 'movimentacoesProcessadas',
    'ondas', 'result_state_monitor', 'checkbox_state_monitor',
    'dashboardHTML', 'rankingArray', 'logHistoricoMudancas',
  ];
  const LAST_MODIFIED_KEY = 'syncLastModified';

  let hasRestored = false;
  let skipSync = false;
  let lastModifiedMap = {};
  try {
    lastModifiedMap = JSON.parse(localStorage.getItem(LAST_MODIFIED_KEY)) || {};
  } catch { /* ignora JSON inválido */ }

  const originalSetItem = localStorage.setItem.bind(localStorage);

  // Intercepta setItem para marcar timestamp e disparar sync
  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (skipSync) return;
    if (chavesParaSincronizar.includes(key)) {
      lastModifiedMap[key] = Date.now();
      skipSync = true;
      originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
      skipSync = false;
      salvarLocalStorage();
    }
  };

  // Envia ao servidor somente após restauração e se houver algo para enviar
  function salvarLocalStorage() {
    if (!hasRestored) {
      console.log('🛑 Aguardando restauração completa antes de sincronizar');
      return;
    }

    const payload = {};
    chavesParaSincronizar.forEach(key => {
      const v = localStorage.getItem(key);
      if (v !== null) {
        payload[key] = { value: v, timestamp: lastModifiedMap[key] || Date.now() };
      }
    });

    if (Object.keys(payload).length === 0) {
      console.log('🛑 Nenhum dado para sincronizar');
      return;
    }

    fetch('https://dry-scene-2df7.tjslucasvl.workers.dev/proxy/salvar.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dados: JSON.stringify(payload) })
    })
    .then(() => console.log('💾 Dados sincronizados ao servidor'))
    .catch(err => console.error('❌ Erro ao sincronizar:', err));
  }

  // Recupera do servidor e atualiza localStorage se o servidor estiver mais novo
  function restaurarLocalStorage() {
    return fetch(`https://dry-scene-2df7.tjslucasvl.workers.dev/proxy/pegar.php?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (!data?.dados) {
          // mesmo sem dados, marcamos restauração concluída
          hasRestored = true;
          return;
        }
        const serverData = JSON.parse(data.dados);
        let updated = false;

        Object.keys(serverData).forEach(key => {
          if (!chavesParaSincronizar.includes(key)) return;
          const { value, timestamp } = serverData[key];
          const localTime = lastModifiedMap[key] || 0;
          if (timestamp > localTime) {
            skipSync = true;
            originalSetItem(key, value);
            skipSync = false;
            lastModifiedMap[key] = timestamp;
            updated = true;
          }
        });

        if (updated) {
          skipSync = true;
          originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
          skipSync = false;
          console.log('✅ Dados restaurados do servidor');
        }
      })
      .catch(err => console.error('❌ Erro ao restaurar:', err))
      .finally(() => {
        hasRestored = true;
      });
  }

  // Inicializa
  restaurarLocalStorage();
  window.addEventListener('beforeunload', salvarLocalStorage);
  setInterval(salvarLocalStorage, 10000);

  document.addEventListener('DOMContentLoaded', () => {
    restaurarLocalStorage();
    document.querySelectorAll('iframe').forEach(frm =>
      frm.addEventListener('load', restaurarLocalStorage)
    );
  });

  // Para sincronização manual
  window.sincronizarAgora = salvarLocalStorage;
})();
