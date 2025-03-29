  // Verifica autenticação do usuário
    const username = localStorage.getItem('username');
    if (!username) {
      window.location.href = '/WMS-Tools/404.html';
    } else {
      document.getElementById('userNameDisplay').textContent = username;
    }
