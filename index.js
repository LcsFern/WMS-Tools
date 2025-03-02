/**
 * Verifica autenticação do usuário
 * Redireciona para login se não autenticado
 */
const username = localStorage.getItem('username');
if (!username) {
  window.location.href = 'login.htm';
} else {
  document.getElementById('userNameDisplay').textContent = username;
}

/**
 * Configurações de Event Listeners
 */
document.addEventListener('DOMContentLoaded', () => {
  // Botões de navegação
  document.querySelectorAll('header button').forEach(button => {
    button.addEventListener('click', () => {
      loadPage(button.dataset.page);
    });
  });

  // Botão de logout
  document.querySelector('.logout-btn').addEventListener('click', logout);
});

/**
 * Carrega página no iframe
 * @param {string} page - Caminho da página a ser carregada
 */
function loadPage(page) {
  document.getElementById('contentFrame').src = page;
}

/**
 * Realiza logout do sistema
 * Remove dados do localStorage e redireciona
 */
function logout() {
  localStorage.removeItem('username');
  window.location.href = 'login.htm';
}