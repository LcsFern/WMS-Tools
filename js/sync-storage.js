const ENDPOINT = "https://tight-field-106d.tjslucasvl.workers.dev/";
const USER_ID = "lucas";
const TEMPO_SINCRONIZACAO_MS = 30000;
let sincronizacaoAgendada = null;
let sincronizandoAgora = false;

// Função para mostrar notificação na tela
function mostrarNotificacao(mensagem, tipo = "info") {
  const cor = tipo === "erro" ? "#ff5555" : (tipo === "sucesso" ? "#50fa7b" : "#8be9fd");
  const div = document.createElement("div");
  div.textContent = mensagem;
  Object.assign(div.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    backgroundColor: cor,
    color: "#282a36",
    padding: "10px 20px",
    borderRadius: "10px",
    boxShadow: "0 0 10px rgba(0,0,0,0.3)",
    zIndex: 10000,
    fontSize: "14px",
    fontFamily: "sans-serif",
    transition: "opacity 0.5s ease",
    opacity: "1"
  });
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 500);
  }, 3000);
}

// Função para verificar se o servidor está online (para restauração de dados)
async function verificarServidor() {
  try {
    const response = await fetch(`${ENDPOINT}?userId=${USER_ID}`, {
      method: "GET",
      mode: "cors"
    });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return true;
  } catch (error) {
    console.error("🛑 Servidor inacessível:", error);
    mostrarNotificacao("Servidor offline, tentativa adiada.", "erro");
    return false;
  }
}

// Função para salvar dados no servidor (usa no-cors para evitar bloqueio CORS)
async function salvarLocalStorage() {
  if (sincronizandoAgora) return;
  sincronizandoAgora = true;
  try {
    const dadosParaSalvar = {
      ondas: JSON.parse(localStorage.getItem("ondas") || "{}"),
      logHistoricoMudancas: JSON.parse(localStorage.getItem("logHistoricoMudancas") || "[]")
    };
    const payload = { userId: USER_ID, dados: JSON.stringify(dadosParaSalvar) };
    console.log("➡️ Salvando payload:", payload);
    await fetch(ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    mostrarNotificacao("✅ Dados enviados ao servidor!", "sucesso");
  } catch (error) {
    console.error("❌ Erro no envio:", error);
    mostrarNotificacao("Erro ao sincronizar dados.", "erro");
  } finally {
    sincronizandoAgora = false;
    agendarSincronizacao();
  }
}

// Função para restaurar dados do servidor para o localStorage
async function restaurarLocalStorage() {
  try {
    const servidorDisponivel = await verificarServidor();
    if (!servidorDisponivel) return;
    const resposta = await fetch(`${ENDPOINT}?userId=${USER_ID}`, {
      method: "GET",
      mode: "cors"
    });
    const json = await resposta.json();
    const dados = JSON.parse(json.dados);
    localStorage.setItem("ondas", JSON.stringify(dados.ondas));
    localStorage.setItem("logHistoricoMudancas", JSON.stringify(dados.logHistoricoMudancas));
    mostrarNotificacao("✅ Dados restaurados com sucesso!", "sucesso");
  } catch (error) {
    console.error("❌ Erro ao restaurar:", error);
    mostrarNotificacao("Erro ao restaurar dados.", "erro");
  }
}

// Agendar próxima sincronização automática
function agendarSincronizacao() {
  if (sincronizacaoAgendada) clearTimeout(sincronizacaoAgendada);
  sincronizacaoAgendada = setTimeout(salvarLocalStorage, TEMPO_SINCRONIZACAO_MS);
}

// Iniciar sincronização: restauração + agendamento
function iniciarSincronizacao() {
  console.log("🔄 Iniciando sincronização automática...");
  restaurarLocalStorage();
  agendarSincronizacao();
}

// Salvar imediatamente
function salvarAgora() {
  salvarLocalStorage();
}

window.SyncStorage = { iniciarSincronizacao, salvarAgora };

document.addEventListener("DOMContentLoaded", iniciarSincronizacao);
