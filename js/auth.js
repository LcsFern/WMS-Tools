// auth.js

// Tempo de expiração padrão da sessão (2 horas)
const TEMPO_EXPIRACAO_MS = 2 * 60 * 60 * 1000;

// Variável de controle para saber se há dados para sincronizar
let precisaSincronizar = false;

// Função para logar o usuário
function login(username) {
  const expiry = Date.now() + TEMPO_EXPIRACAO_MS;
  localStorage.setItem('username', username);
  localStorage.setItem('expiry', expiry.toString());
}

// Função para verificar se o usuário está logado
function verificarLogin() {
  const username = localStorage.getItem('username');
  const expiry = parseInt(localStorage.getItem('expiry'), 10);

  if (!username || !expiry || Date.now() > expiry) {
    redirectToLogin();
  }
}

// Função para redirecionar para a página de login
function redirectToLogin() {
  window.top.location.href = './login.html'; // Altere conforme seu sistema
}

// Função para logout do usuário
function logout(clearAll = false) {
  async function fazerLogout() {
    if (clearAll) {
      localStorage.clear();
    } else {
      localStorage.removeItem('username');
      localStorage.removeItem('expiry');
    }
    redirectToLogin();
  }

  if (navigator.onLine && typeof salvarLocalStorage === 'function' && precisaSincronizar) {
    salvarLocalStorage();
    setTimeout(fazerLogout, 1500); // Espera 1,5s para garantir o salvamento
  } else {
    fazerLogout();
  }
}

// Função para renovar a sessão com base em atividade do usuário
(function monitorarAtividade() {
  let ultimoEvento = Date.now();

  function renovarSessao() {
    const username = localStorage.getItem('username');
    if (username) {
      const novoExpiry = Date.now() + TEMPO_EXPIRACAO_MS;
      localStorage.setItem('expiry', novoExpiry.toString());
      console.log('🕒 Sessão renovada até:', new Date(novoExpiry).toLocaleTimeString());
    }
  }

  function registrarAtividade() {
    const agora = Date.now();
    if (agora - ultimoEvento > 60000) { // Renova se ficou mais de 1 min sem renovar
      renovarSessao();
    }
    ultimoEvento = agora;
  }

  ['click', 'keydown', 'scroll', 'mousemove'].forEach(evt => {
    document.addEventListener(evt, registrarAtividade, { passive: true });
  });
})();

// Sempre checar login ao carregar a página
document.addEventListener('DOMContentLoaded', verificarLogin);
