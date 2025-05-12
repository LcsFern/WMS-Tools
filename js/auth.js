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
  window.top.location.href = '/WMS-Tools/login.html'; // Altere conforme seu sistema
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
// Monitor de inatividade baseado em modificações (não em eventos do usuário)
(function monitorarInatividade() {
  const TEMPO_INATIVIDADE_MS = 30 * 60 * 1000; // 30 minutos
  let timer;

  // Função global que poderá ser chamada por outros scripts para reiniciar o tempo
  window.reiniciarTempoSessao = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('⏳ Nenhuma modificação nas chaves por 30 minutos. Fazendo logout...');
      logout(); // Faz logout normal
    }, TEMPO_INATIVIDADE_MS);
  };

  // Inicia o contador no carregamento
  window.reiniciarTempoSessao();
})();

// Sempre checar login ao carregar a página
document.addEventListener('DOMContentLoaded', verificarLogin);
