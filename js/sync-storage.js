(function () {
  const userId = localStorage.getItem('username');
  if (!userId) return;

  const chavesParaSincronizar = ['ondasdin', 'gradeCompleta', 'movimentacoesProcessadas' , 'ondas' , 'result_state_monitor' , 'checkbox_state_monitor' , 'dashboardHTML' , 'rankingArray']; // adicione as chaves que quiser

  // Restaura do servidor via proxy (Cloudflare Worker)
  fetch(`https://dry-scene-2df7.tjslucasvl.workers.dev/proxy/pegar.php?userId=${userId}`)
    .then(res => res.json())
    .then(data => {
      if (data?.dados) {
        const restaurados = JSON.parse(data.dados);
        Object.keys(restaurados).forEach(key => {
          localStorage.setItem(key, restaurados[key]);
        });
        console.log('Dados restaurados do servidor');
      }
    });

  // Salva no servidor via proxy (Cloudflare Worker)
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
    }).then(() => console.log('Dados enviados ao servidor'));
  }

  // Salva ao sair da página
  window.addEventListener('beforeunload', salvarLocalStorage);

  // Opcional: você pode exportar a função para usar manualmente
  window.sincronizarAgora = salvarLocalStorage;
})();
