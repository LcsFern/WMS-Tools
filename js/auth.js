// auth.js

const username = localStorage.getItem('username');
const expiry = localStorage.getItem('expiry');

if (!username || !expiry || Date.now() > parseInt(expiry)) {
  // Remove qualquer dado antigo
  localStorage.removeItem('username');
  localStorage.removeItem('expiry');
  
  // Redireciona para página de login ou erro
  window.location.href = '/WMS-Tools/login.html';
} else {
  // Login válido, exibe o nome
  const userSpan = document.getElementById('userNameDisplay');
  if (userSpan) {
    userSpan.textContent = username;
  }
}
