// login.js

// Função assíncrona para realizar o login
async function login() {
  // Obtém o valor digitado no campo de senha
  const password = document.getElementById('password').value;
  
  // Seleciona o botão de login
  const button = document.querySelector('button');

  // Seleciona a mensagem de erro
  const errorMsg = document.getElementById('errorMsg');

  // Reseta os estados: desativa o botão e exibe a animação de carregamento
  button.disabled = true;
  button.innerHTML = `<div class="loading"></div> Carregando...`;
  errorMsg.textContent = '';

  try {
    // Chama o PHP via fetch
    const res = await fetch('https://labsuaideia.store/api/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.success) {
      // Se sucesso, salva o nome retornado pelo PHP no localStorage
      localStorage.setItem('username', data.username);

      // Calcula o tempo de expiração em 2 horas (em milissegundos)
      const expiresIn = 2 * 60 * 60 * 1000; // 2 horas
      const expiryTime = Date.now() + expiresIn;
      localStorage.setItem('expiry', expiryTime.toString());

      // Redireciona para a página principal
      window.location.href = '/WMS-Tools/index.html';
    } else {
      // Se a senha for incorreta, lança erro
      throw new Error('Senha incorreta!');
    }

  } catch (err) {
    // Em caso de erro, exibe mensagem, restaura botão e anima shake
    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${err.message}`;
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
  const loginButton  = document.querySelector('button');
  
  // Permite login ao pressionar Enter
  passwordField.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') login();
  });

  // Permite login também via clique no botão
  loginButton.addEventListener('click', login);

  // Garante foco no campo ao carregar a página
  passwordField.focus();
});

// Cria e adiciona dinamicamente as animações (shake + loading spinner)
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
  .loading {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 14px;
    height: 14px;
    animation: spin 1s linear infinite;
    display: inline-block;
    vertical-align: middle;
    margin-right: 6px;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
