// auth.js
const username = localStorage.getItem('username');
const expiry = localStorage.getItem('expiry');

// Verifica se o username existe no banco de dados de usuários (users.js)
const userIsValid = users[username];

// Verifica a validade do login
if (!username || !expiry || !userIsValid || Date.now() > parseInt(expiry)) {
  // Remove qualquer dado antigo
  localStorage.removeItem('username');
  localStorage.removeItem('expiry');
  
  // Redireciona para página de login 
  top.location.href = '/WMS-Tools/login.html';  
} else {
  // Login válido, exibe o nome
  const userSpan = document.getElementById('userNameDisplay');
  if (userSpan) {
    userSpan.textContent = username;
  }
}
