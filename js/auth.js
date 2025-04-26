// js/auth.js

(function() {
  // Função de redirecionamento segura
  function redirectToLogin() {
    try {
      if (window.top !== window.self) {
        window.top.location.href = '/WMS-Tools/login.html';
      } else {
        window.location.href = '/WMS-Tools/login.html';
      }
    } catch (e) {
      // Se não conseguir acessar window.top, tenta no próprio frame
      window.location.href = '/WMS-Tools/login.html';
    }
  }

  // Função principal de autenticação
  function authenticateUser() {
    const username = localStorage.getItem('username');
    const expiry = localStorage.getItem('expiry');

    if (!username || !expiry) {
      return redirectToLogin();
    }

    const expiryTime = parseInt(expiry, 10);

    if (isNaN(expiryTime) || Date.now() > expiryTime) {
      return redirectToLogin();
    }

    // Confirma que o objeto 'users' foi carregado
    if (typeof users !== 'object' || !users) {
      console.error('Erro: Banco de usuários não carregado.');
      return redirectToLogin();
    }

    const userIsValid = Object.values(users).includes(username);

    if (!userIsValid) {
      return redirectToLogin();
    }

    // Se chegou aqui, o login é válido, exibe o nome do usuário
    const userSpan = document.getElementById('userNameDisplay');
    if (userSpan) {
      userSpan.textContent = username;
    }
  }

  // Aguarda o carregamento completo do DOM
  document.addEventListener('DOMContentLoaded', authenticateUser);
})();
