(function () {
  const userId = localStorage.getItem('username')?.toLowerCase();
  if (!userId) return;

  const chavesParaSincronizar = [
    'ondasdin', 'gradeCompleta', 'movimentacoesProcessadas',
    'ondas', 'result_state_monitor', 'checkbox_state_monitor',
    'dashboardHTML', 'rankingArray', 'logHistoricoMudancas'
  ];
  const LAST_MODIFIED_KEY = 'syncLastModified';
  let skipSync = false;
  const originalSetItem = localStorage.setItem.bind(localStorage);

  // Carrega mapa de timestamps de modificações locais
  let lastModifiedMap = {};
  try {
    lastModifiedMap = JSON.parse(localStorage.getItem(LAST_MODIFIED_KEY)) || {};
  } catch { /* ignorar se inválido */ }

  // Envia dados ao servidor
  function salvarLocalStorage() {
    const payload = {};
    chavesParaSincronizar.forEach(key => {
      const v = localStorage.getItem(key);
      if (v !== null) {
        payload[key] = { value: v, timestamp: lastModifiedMap[key] || Date.now() };
      }
    });
    fetch('https://dry-scene-2df7.tjslucasvl.workers.dev/proxy/salvar.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dados: JSON.stringify(payload) })
    }).then(() => console.log('💾 Dados sincronizados ao servidor'));
  }

  // Override de setItem para interceptar alterações
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

  // Recupera do servidor sem sobrescrever dados locais mais recentes
  function restaurarLocalStorage() {
    fetch(`https://dry-scene-2df7.tjslucasvl.workers.dev/proxy/pegar.php?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (!data?.dados) return;
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
      .catch(console.error);
  }

  // Inicializa restauração
  restaurarLocalStorage();

  // Salva antes de sair e em intervalos
  window.addEventListener('beforeunload', salvarLocalStorage);
  setInterval(salvarLocalStorage, 10000);

  // Garanta restauração ao recarregar iframes
  document.addEventListener('DOMContentLoaded', () => {
    restaurarLocalStorage();
    document.querySelectorAll('iframe').forEach(frm => {
      frm.addEventListener('load', restaurarLocalStorage);
    });
  });

  // Disponibiliza manualmente
  window.sincronizarAgora = salvarLocalStorage;
})();
// Fim do código