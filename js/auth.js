// js/auth.js

(function() {
  // Caminho da página de login
  const LOGIN_PAGE = '/WMS-Tools/login.html';

  // Função de redirecionamento segura
  function redirectToLogin() {
    try {
      if (window.top !== window.self) {
        window.top.location.href = LOGIN_PAGE;
      } else {
        window.location.href = LOGIN_PAGE;
      }
    } catch (e) {
      window.location.href = LOGIN_PAGE;
    }
  }

  // Função de logout
  function logout(clearAll = false) {
    if (clearAll) {
      // Limpa todo o localStorage do site
      localStorage.clear();
    } else {
      // Apenas remove dados de login
      localStorage.removeItem('username');
      localStorage.removeItem('expiry');
    }
    redirectToLogin();
  }

  // Função principal de autenticação
  function authenticateUser() {
    // Se já estamos na página de login, não faz nada
    if (window.location.pathname.includes(LOGIN_PAGE)) return;

    const username = localStorage.getItem('username');
    const expiry = localStorage.getItem('expiry');

    if (!username || !expiry) {
      return logout();
    }

    const expiryTime = parseInt(expiry, 10);

    if (isNaN(expiryTime) || Date.now() > expiryTime) {
      return logout();
    }

    // Confirma que o objeto 'users' foi carregado
    if (typeof users !== 'object' || !users) {
      console.error('Erro: Banco de usuários não carregado.');
      return logout();
    }

    const userIsValid = Object.values(users).includes(username);

    if (!userIsValid) {
      return logout();
    }

    // Se chegou aqui, o login é válido, exibe o nome do usuário
    const userSpan = document.getElementById('userNameDisplay');
    if (userSpan) {
      userSpan.textContent = username;
    }
  }

  // Aguarda o carregamento completo do DOM
  document.addEventListener('DOMContentLoaded', authenticateUser);

  // Torna as funções disponíveis globalmente se precisar chamar manualmente
  window.logout = logout;
})();
