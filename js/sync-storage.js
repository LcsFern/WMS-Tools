const STORAGE_KEYS = ['ondas', 'logHistoricoMudancas'];
const SYNC_SERVER_URL = 'https://tight-field-106d.tjslucasvl.workers.dev/';
const USER_ID = 'lucas'; // seu userId
const SYNC_DEBOUNCE_DELAY = 2000; // 2 segundos

let isSyncInProgress = false;
let syncTimeoutId = null;

async function salvarLocalStorage(userId, payload) {
  console.log("➡️ [DEBUG] userId:", userId);
  console.log("➡️ [DEBUG] payload:", payload);

  if (isSyncInProgress) {
    console.warn("🛑 Operação de sincronização já em andamento");
    return;
  }

  isSyncInProgress = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos de timeout

    const response = await fetch(SYNC_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dados: JSON.stringify(payload) }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const resultado = await response.json();
    console.log("✅ Dados salvos com sucesso:", resultado);
  } catch (erro) {
    console.error("❌ Erro na sincronização:", erro);
  } finally {
    isSyncInProgress = false;
  }
}

async function restaurarLocalStorage(userId) {
  console.log("➡️ [DEBUG] Restaurando dados do servidor para o userId:", userId);

  try {
    const response = await fetch(`${SYNC_SERVER_URL}?userId=${encodeURIComponent(userId)}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const resultado = await response.json();

    if (resultado?.dados) {
      const dados = JSON.parse(resultado.dados);
      for (const chave of STORAGE_KEYS) {
        if (dados.hasOwnProperty(chave)) {
          localStorage.setItem(chave, JSON.stringify(dados[chave]));
          console.log(`✅ Dado restaurado para a chave: ${chave}`);
        }
      }
    } else {
      console.warn("⚠️ Nenhum dado encontrado para restaurar.");
    }
  } catch (erro) {
    console.error("❌ Erro ao restaurar dados:", erro);
  }
}

function prepararPayload() {
  const payload = {};

  for (const chave of STORAGE_KEYS) {
    const valor = localStorage.getItem(chave);
    if (valor !== null) {
      try {
        payload[chave] = JSON.parse(valor);
      } catch {
        console.warn(`⚠️ Valor inválido para a chave ${chave}, ignorando.`);
      }
    }
  }

  return payload;
}

function agendarSincronizacao() {
  if (syncTimeoutId !== null) {
    clearTimeout(syncTimeoutId);
  }

  syncTimeoutId = setTimeout(() => {
    const payload = prepararPayload();
    salvarLocalStorage(USER_ID, payload);
    syncTimeoutId = null;
  }, SYNC_DEBOUNCE_DELAY);
}

// Exemplo de uso: chamar essas funções onde precisar
// restaurarLocalStorage(USER_ID);
// agendarSincronizacao();

// Se quiser sincronizar sempre que mudar o localStorage, use algo assim:
window.addEventListener('storage', (event) => {
  if (STORAGE_KEYS.includes(event.key)) {
    console.log(`🔄 Mudança detectada na chave: ${event.key}`);
    agendarSincronizacao();
  }
});

// Para usar manualmente:
// loadPage() {
//   restaurarLocalStorage(USER_ID);
// }
// salvarManual() {
//   agendarSincronizacao();
// }
