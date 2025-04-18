(function() {
  'use strict';

  const username = localStorage.getItem('username');
  if (!username) {
    // redireciona quem não estiver logado
    window.location.replace('/WMS-Tools/404.html');
    return;
  }

  // se houve login, preenche o nome
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('userNameDisplay');
    if (el) el.textContent = username;
  });
})();
