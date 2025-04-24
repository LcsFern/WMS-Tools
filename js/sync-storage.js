(function () {
  const userId = localStorage.getItem('username')?.toLowerCase();
  if (!userId) return;

  const chavesParaSincronizar = [
    'ondasdin', 'gradeCompleta', 'movimentacoesProcessadas',
    'ondas', 'result_state_monitor', 'checkbox_state_monitor',
    'dashboardHTML', 'rankingArray' , 'logHistoricoMudancas'
  ];

  // 🔁 Override para salvar automaticamente ao alterar localStorage
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);

    if (chavesParaSincronizar.includes(key)) {
      salvarLocalStorage();
    }
  };

  // 🧠 Restaura do servidor
  fetch(`https://dry-scene-2df7.tjslucasvl.workers.dev/proxy/pegar.php?userId=${userId}`)
    .then(res => res.json())
    .then(data => {
      if (data?.dados) {
        const restaurados = JSON.parse(data.dados);
        Object.keys(restaurados).forEach(key => {
          localStorage.setItem(key, restaurados[key]);
        });
        console.log('✅ Dados restaurados do servidor');
      }
    });

  // 💾 Salva no servidor
  function salvarLocalStorage() {
    const dados = {};
    chavesParaSincronizar.forEach(key => {
      const valor = localStorage.getItem(key);
      if (valor !== null) dados[key] = valor;
    });

    fetch('https://dry-scene-2df7.tjslucasvl.workers.dev/proxy/salvar.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dados: JSON.stringify(dados) })
    })
    .then(() => console.log('💾 Dados enviados ao servidor'));
  }

  // 🔁 Salva também ao sair
  window.addEventListener('beforeunload', salvarLocalStorage);

  // 🔘 Exporta função manual
  window.sincronizarAgora = salvarLocalStorage;

    // ⏱️ Backup automático a cada 10 segundos
    setInterval(() => {
      salvarLocalStorage();
    }, 10000); // 10000 ms = 10 segundos
  
})();
