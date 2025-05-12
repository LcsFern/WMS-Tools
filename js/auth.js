////////////////////////////////////////////////////////////////////////////////
// ─── CONFIGURAÇÃO DE SESSÃO E LOGIN ────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////

// Tempo de expiração padrão da sessão (10 minutos)
const TEMPO_EXPIRACAO_MS = 10 * 60 * 1000;

////////////////////////////////////////////////////////////////////////////////
// ─── FUNÇÃO DE LOGIN ───────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
function login(username) {
  const expiry = Date.now() + TEMPO_EXPIRACAO_MS;
  localStorage.setItem('username', username);
  localStorage.setItem('expiry', expiry.toString());

  // Restaurar dados somente se não tiver sido restaurado ainda
  if (!localStorage.getItem('jaRestaurouDados') && navigator.onLine && typeof window.restoreStorage === 'function') {
    localStorage.setItem('jaRestaurouDados', 'true'); // Marca como restaurado
    showPopup('🔄 Restaurando dados do servidor (login)...', 'info');
    window.restoreStorage();
  }
}

////////////////////////////////////////////////////////////////////////////////
// ─── VERIFICAÇÃO DE LOGIN ─────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
function verificarLogin() {
  const username = localStorage.getItem('username');
  const expiry = parseInt(localStorage.getItem('expiry'), 10);

  if (!username || !expiry || Date.now() > expiry) {
    redirectToLogin();
    return;
  }

  // Restaurar dados apenas se não tiver sido feito após o login
  if (!localStorage.getItem('jaRestaurouDados') && navigator.onLine && typeof window.restoreStorage === 'function') {
    localStorage.setItem('jaRestaurouDados', 'true'); // Marca como restaurado
    showPopup('🔄 Restaurando dados do servidor (sessão existente)...', 'info');
    window.restoreStorage();
  }
}

////////////////////////////////////////////////////////////////////////////////
// ─── REDIRECIONA PARA LOGIN ────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
function redirectToLogin() {
  window.top.location.href = '/WMS-Tools/login.html'; // Ajuste conforme seu sistema
}

////////////////////////////////////////////////////////////////////////////////
// ─── FUNÇÃO DE LOGOUT ─────────────────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
function logout(clearAll = false) {
  async function fazerLogout() {
    localStorage.removeItem('jaRestaurouDados'); // Resetando a variável de controle
    if (clearAll) {
      localStorage.clear();
    } else {
      localStorage.removeItem('username');
      localStorage.removeItem('expiry');
    }
    redirectToLogin();
  }

  // Se houver dados pendentes de sincronização, salva antes de sair
  if (navigator.onLine && typeof salvarLocalStorage === 'function' && precisaSincronizar) {
    salvarLocalStorage();
    setTimeout(fazerLogout, 1500); // Aguarda 1,5s para garantir envio
  } else {
    fazerLogout();
  }
}

////////////////////////////////////////////////////////////////////////////////
// ─── MONITORAMENTO DE ATIVIDADE ───────────────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
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
    if (agora - ultimoEvento > 60000) { // Renova se ficou > 1 min sem renovação
      renovarSessao();
    }
    ultimoEvento = agora;
  }

  ['click', 'keydown', 'scroll', 'mousemove'].forEach(evt =>
    document.addEventListener(evt, registrarAtividade, { passive: true })
  );
})();

////////////////////////////////////////////////////////////////////////////////
// ─── CHECA LOGIN NO CARREGAMENTO DA PÁGINA ─────────────────────────────────
////////////////////////////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', verificarLogin);
