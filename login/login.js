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

  // Simula um pequeno atraso (800ms), como se estivesse chamando uma API
  await new Promise(resolve => setTimeout(resolve, 800));

  // Verifica se a senha digitada existe no objeto 'users'
  if (users[password]) {
    // Salva o nome do usuário correspondente à senha no localStorage
    localStorage.setItem('username', users[password]);

    // Calcula o tempo de expiração em 2 horas (em milissegundos)
    const expiresIn = 2 * 60 * 60 * 1000; // 2 horas
    const expiryTime = Date.now() + expiresIn;

    // Salva o tempo de expiração no localStorage
    localStorage.setItem('expiry', expiryTime.toString());

    // Redireciona para a página principal (index.html)
    window.location.href = '/index.html';
  } else {
    // Se a senha for incorreta, exibe uma mensagem de erro
    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> Senha incorreta!`;
    
    // Altera o botão de volta ao estado inicial
    button.innerHTML = `<i class="fas fa-sign-in-alt"></i> Tentar novamente`;
    button.disabled = false;
    
    // Adiciona uma animação de tremor ao container do login
    const container = document.querySelector('.login-container');
    container.style.animation = 'shake 0.5s';
    
    // Remove a animação após sua execução para evitar repetição desnecessária
    container.addEventListener('animationend', () => {
      container.style.animation = '';
    });
  }
}

// Aguarda o carregamento completo do DOM antes de adicionar eventos
document.addEventListener('DOMContentLoaded', function() {
  // Seleciona o campo de senha
  const passwordField = document.getElementById('password');
  
  // Adiciona um evento para permitir login ao pressionar a tecla "Enter"
  passwordField.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') login();
  });

  // Garante que o campo de senha esteja focado ao carregar a página
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
