  // Verifica autenticação do usuário
    const username = localStorage.getItem('username');
    if (!username) {
      window.location.href = 'WMS-Tools/login.html';
    } else {
      document.getElementById('userNameDisplay').textContent = username;
    }
