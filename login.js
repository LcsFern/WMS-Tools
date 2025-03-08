async function login() {
  const password = document.getElementById('password').value;
  const button = document.querySelector('button');
  const errorMsg = document.getElementById('errorMsg');

  // Reset states
  button.disabled = true;
  button.innerHTML = `<div class="loading"></div> Carregando...`;
  errorMsg.textContent = '';

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 800));

  if (users[password]) {
    localStorage.setItem('username', users[password]);
    window.location.href = 'index.html';
  } else {
    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> Senha incorreta!`;
    button.innerHTML = `<i class="fas fa-sign-in-alt"></i> Tentar novamente`;
    button.disabled = false;
    
    // Add error animation
    const container = document.querySelector('.login-container');
    container.style.animation = 'shake 0.5s';
    container.addEventListener('animationend', () => {
      container.style.animation = '';
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const passwordField = document.getElementById('password');
  
  passwordField.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') login();
  });

  passwordField.focus();
});

// Add shake animation
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
`;
document.head.appendChild(style);