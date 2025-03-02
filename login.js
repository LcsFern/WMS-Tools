/**
 * Função principal de login
 * Verifica a senha contra o objeto users e redireciona se válida
 */
function login() {
  const password = document.getElementById('password').value;
  
  // Verifica se a senha existe no objeto users (importado de users.js)
  if (users[password]) {
    localStorage.setItem('username', users[password]);
    window.location.href = 'index.htm';
  } else {
    document.getElementById('errorMsg').textContent = 'Senha incorreta!';
  }
}

// Configuração inicial após carregamento da página
document.addEventListener('DOMContentLoaded', function() {
  // Adiciona listener para tecla Enter no campo de senha
  const passwordField = document.getElementById('password');
  passwordField.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      login();
    }
  });

  // Foco automático no campo de senha
  passwordField.focus();
});

/**
 * Estrutura esperada do users.js:
 * window.users = {
 *   "senha1": "Nome do Usuário 1",
 *   "senha2": "Nome do Usuário 2"
 * }
 */