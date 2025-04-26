const ENDPOINT = "https://tight-field-106d.tjslucasvl.workers.dev/";
const USER_ID = "lucas"; // seu userId fixo
const TEMPO_SINCRONIZACAO_MS = 30000; // tempo para auto-sincronizar (30 segundos)
let sincronizacaoAgendada = null;
let sincronizandoAgora = false;

// Função para mostrar notificação na tela
function mostrarNotificacao(mensagem, tipo = "info") {
  const cor = tipo === "erro" ? "#ff5555" : (tipo === "sucesso" ? "#50fa7b" : "#8be9fd");
  
  const div = document.createElement("div");
  div.textContent = mensagem;
  div.style.position = "fixed";
  div.style.bottom = "20px";
  div.style.right = "20px";
  div.style.backgroundColor = cor;
  div.style.color = "#282a36";
  div.style.padding = "10px 20px";
  div.style.borderRadius = "10px";
  div.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
  div.style.zIndex = 10000;
  div.style.fontSize = "14px";
  div.style.fontFamily = "sans-serif";
  div.style.transition = "opacity 0.5s ease";
  div.style.opacity = "1";

  document.body.appendChild(div);

  setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 500);
  }, 3000);
}

// Função para verificar se o servidor está online
async function verificarServidor() {
  try {
    const response = await fetch(`${ENDPOINT}?userId=${USER_ID}`, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Servidor respondeu com status ${response.status}`);
    }
    console.log("🛰️ Servidor online");
    return true;
  } catch (error) {
    console.error("🛑 Servidor offline ou inacessível:", error);
    mostrarNotificacao("Servidor offline, tentativa adiada.", "erro");
    return false;
  }
}

// Função para salvar dados no servidor
async function salvarLocalStorage() {
  if (sincronizandoAgora) {
    console.warn("⏳ Operação de sincronização já em andamento");
    return;
  }
  
  sincronizandoAgora = true;
  
  try {
    const servidorDisponivel = await verificarServidor();
    if (!servidorDisponivel) {
      sincronizandoAgora = false;
      agendarSincronizacao();
      return;
    }

    const dadosParaSalvar = {
      ondas: JSON.parse(localStorage.getItem("ondas") || "{}"),
      logHistoricoMudancas: JSON.parse(localStorage.getItem("logHistoricoMudancas") || "[]")
    };

    const payload = {
      userId: USER_ID,
      dados: JSON.stringify(dadosParaSalvar)
    };

    console.log("➡️ [DEBUG] Salvando payload:", payload);

    const resposta = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!resposta.ok) {
      throw new Error(`Erro na resposta do servidor: ${resposta.status}`);
    }

    const json = await resposta.json();
    if (json.status !== "ok") {
      throw new Error("Servidor retornou erro: " + (json.mensagem || "Desconhecido"));
    }

    mostrarNotificacao("✅ Dados sincronizados com sucesso!", "sucesso");
  } catch (error) {
    console.error("❌ Erro na sincronização:", error);
    mostrarNotificacao("Erro ao sincronizar dados.", "erro");
  } finally {
    sincronizandoAgora = false;
  }
}

// Função para agendar próxima sincronização
function agendarSincronizacao() {
  if (sincronizacaoAgendada !== null) {
    clearTimeout(sincronizacaoAgendada);
  }

  sincronizacaoAgendada = setTimeout(() => {
    salvarLocalStorage();
  }, TEMPO_SINCRONIZACAO_MS);
}

// Inicializa a sincronização
function iniciarSincronizacao() {
  console.log("🔄 Inicializando sistema de sincronização automática...");
  agendarSincronizacao();
}

// Para salvar imediatamente quando quiser
function salvarAgora() {
  salvarLocalStorage();
}

// Exportando para uso externo se precisar
window.SyncStorage = {
  iniciarSincronizacao,
  salvarAgora
};

// Iniciar automaticamente ao carregar o script
iniciarSincronizacao();
