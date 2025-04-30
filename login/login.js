// Função assíncrona para realizar o login
async function login() {
  // Obtém o valor digitado no campo de senha
  const password = document.getElementById('password').value;
  const button = document.querySelector('button');
  const errorMsg = document.getElementById('errorMsg');

  button.disabled = true;
  button.innerHTML = `<div class="loading"></div> Carregando...`;
  errorMsg.textContent = '';

  // Simula um pequeno atraso (800ms), como se estivesse chamando uma API
  await new Promise(resolve => setTimeout(resolve, 800));

  try {
    const res = await fetch('https://labsuaideia.store/api/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem('username', data.username);
      const expiresIn = 2 * 60 * 60 * 1000; // 2 horas
      const expiryTime = Date.now() + expiresIn;
      localStorage.setItem('expiry', expiryTime.toString());
      window.location.href = '/WMS-Tools/index.html';
    } else {
      throw new Error('Senha incorreta');
    }

  } catch (error) {
    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> Senha incorreta!`;
    button.innerHTML = `<i class="fas fa-sign-in-alt"></i> Tentar novamente`;
    button.disabled = false;

    const container = document.querySelector('.login-container');
    container.style.animation = 'shake 0.5s';
    container.addEventListener('animationend', () => {
      container.style.animation = '';
    });
  }
}

// Aguarda o carregamento completo do DOM antes de adicionar eventos
document.addEventListener('DOMContentLoaded', function() {
  // Seleciona o campo de senha
  const passwordField = document.getElementById('password');
  // Seleciona o botão de login
  passwordField.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') login();
  });

  // Permite login também via clique no botão
  // Garante foco no campo ao carregar a página
  passwordField.focus();
});

// Cria e adiciona dinamicamente a animação de tremor (shake)
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
`;
document.head.appendChild(style);
