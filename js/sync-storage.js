(function () {
  const userId = localStorage.getItem('username')?.toLowerCase();
  const username = localStorage.getItem('username');
  const expiry = localStorage.getItem('expiry');
  const LAST_MODIFIED_KEY = 'syncLastModified';
  const DEBOUNCE_DELAY = 5000; // 5 segundos após última alteração

  const chavesParaSincronizar = [
    'ondasdin', 'gradeCompleta', 'movimentacoesProcessadas',
    'ondas', 'result_state_monitor', 'checkbox_state_monitor',
    'dashboardHTML', 'rankingArray', 'logHistoricoMudancas', 'reaba',
  ];

  let hasRestored = false;
  let skipSync = false;
  let sincronizandoAtualmente = false;
  let lastModifiedMap = {};
  let precisaSincronizar = false;
  let debounceTimer = null;

  try {
    lastModifiedMap = JSON.parse(localStorage.getItem(LAST_MODIFIED_KEY)) || {};
  } catch { /* ignora JSON inválido */ }

  function mostrarLoading() {
    const loading = document.createElement('div');
    loading.id = 'loading-overlay';
    loading.style.position = 'fixed';
    loading.style.top = '0';
    loading.style.left = '0';
    loading.style.width = '100%';
    loading.style.height = '100%';
    loading.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    loading.style.display = 'flex';
    loading.style.alignItems = 'center';
    loading.style.justifyContent = 'center';
    loading.style.fontFamily = 'Arial, sans-serif';
    loading.style.fontSize = '24px';
    loading.style.color = 'white';
    loading.style.zIndex = '9999';
    loading.innerHTML = '<div>Restaurando dados...</div>';
    document.body.appendChild(loading);
  }

  function esconderLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
      loading.remove();
    }
  }

  function mostrarPopup(mensagem, tipo = 'success') {
    let popup = document.getElementById('sync-notification-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'sync-notification-popup';
      popup.style.position = 'fixed';
      popup.style.right = '20px';
      popup.style.bottom = '20px';
      popup.style.padding = '15px 20px';
      popup.style.borderRadius = '6px';
      popup.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      popup.style.zIndex = '10000';
      popup.style.fontFamily = 'Arial, sans-serif';
      popup.style.fontSize = '14px';
      popup.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      popup.style.transform = 'translateY(100px)';
      popup.style.opacity = '0';
      document.body.appendChild(popup);
    }

    if (tipo === 'success') {
      popup.style.backgroundColor = '#4CAF50';
      popup.style.color = 'white';
    } else if (tipo === 'error') {
      popup.style.backgroundColor = '#F44336';
      popup.style.color = 'white';
    } else if (tipo === 'info') {
      popup.style.backgroundColor = '#2196F3';
      popup.style.color = 'white';
    }

    popup.textContent = mensagem;

    setTimeout(() => {
      popup.style.transform = 'translateY(0)';
      popup.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      popup.style.transform = 'translateY(100px)';
      popup.style.opacity = '0';
      setTimeout(() => {
        if (popup && popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
      }, 300);
    }, 3000);
  }

  const originalSetItem = localStorage.setItem.bind(localStorage);

  localStorage.setItem = function (key, value) {
    const oldValue = localStorage.getItem(key);
    originalSetItem(key, value);
    if (skipSync) return;
    if (chavesParaSincronizar.includes(key)) {
      if (oldValue !== value) {
        lastModifiedMap[key] = Date.now();
        skipSync = true;
        originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
        skipSync = false;
        marcarParaSincronizar();
      }
    }
  };

  function marcarParaSincronizar() {
    precisaSincronizar = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (precisaSincronizar) {
        salvarLocalStorage();
      }
    }, DEBOUNCE_DELAY);
  }

  function salvarLocalStorage() {
    if (!hasRestored) {
      console.log('🛑 Aguardando restauração completa antes de sincronizar');
      return Promise.resolve();
    }
    if (sincronizandoAtualmente) {
      console.log('🛑 Sincronização já em andamento');
      return Promise.resolve();
    }

    const payload = {};
    chavesParaSincronizar.forEach(key => {
      const v = localStorage.getItem(key);
      if (v !== null) {
        payload[key] = { value: v, timestamp: lastModifiedMap[key] || Date.now() };
      }
    });

    if (Object.keys(payload).length === 0) {
      console.log('🛑 Nenhum dado para sincronizar');
      precisaSincronizar = false;
      return Promise.resolve();
    }

    sincronizandoAtualmente = true;
    precisaSincronizar = false;

    // AbortController manual para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Retorna a promise do fetch para quem chamar poder encadear
    return fetch('https://tight-field-106d.tjslucasvl.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dados: JSON.stringify(payload) }),
      signal: controller.signal
    })
    .then(res => {
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log('💾 Dados sincronizados ao servidor');
    })
    .catch(err => {
      console.error('❌ Erro ao sincronizar:', err);
      mostrarPopup('Falha ao sincronizar dados. Verifique sua conexão.', 'error');
      // marca para tentar de novo depois
      precisaSincronizar = true;
      throw err;
    })
    .finally(() => {
      sincronizandoAtualmente = false;
    });
  }

  function restaurarLocalStorage() {
    if (sincronizandoAtualmente) {
      console.log('🛑 Operação de sincronização já em andamento');
      return Promise.resolve();
    }

    sincronizandoAtualmente = true;
    mostrarLoading();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    return fetch(`https://tight-field-106d.tjslucasvl.workers.dev/?userId=${userId}`, {
      signal: controller.signal
    })
    .then(res => {
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!data?.dados) {
        hasRestored = true;
        return;
      }
      const serverData = JSON.parse(data.dados);
      let updated = false;
      let dadosAtualizados = 0;

      Object.keys(serverData).forEach(key => {
        if (!chavesParaSincronizar.includes(key)) return;
        const { value, timestamp } = serverData[key];
        const localTime = lastModifiedMap[key] || 0;
        if (timestamp > localTime) {
          skipSync = true;
          originalSetItem(key, value);
          skipSync = false;
          lastModifiedMap[key] = timestamp;
          updated = true;
          dadosAtualizados++;
        }
      });

      if (updated) {
        skipSync = true;
        originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
        skipSync = false;
        console.log(`✅ ${dadosAtualizados} dados restaurados do servidor`);
        mostrarPopup(`${dadosAtualizados} itens restaurados do servidor`, 'success');
      }
    })
    .catch(err => {
      console.error('❌ Erro ao restaurar:', err);
      mostrarPopup('Falha ao restaurar dados do servidor', 'error');
    })
    .finally(() => {
      hasRestored = true;
      sincronizandoAtualmente = false;
      esconderLoading();
    });
  }

  function verificarConexao() {
    return navigator.onLine;
  }

  if (verificarConexao()) {
    restaurarLocalStorage();
  } else {
    hasRestored = true;
    console.log('🛑 Sem conexão para sincronizar');
  }

  window.addEventListener('online', () => {
    console.log('✅ Conexão restabelecida, sincronizando...');
    restaurarLocalStorage()
      .then(() => salvarLocalStorage())
      .catch(() => {});
  });

  window.addEventListener('offline', () => {
    console.log('🛑 Conexão perdida');
  });

  window.addEventListener('beforeunload', () => {
    if (verificarConexao() && precisaSincronizar) {
      salvarLocalStorage();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (verificarConexao()) {
      restaurarLocalStorage();
    }
    document.querySelectorAll('iframe').forEach(frm =>
      frm.addEventListener('load', () => {
        if (verificarConexao()) {
          restaurarLocalStorage();
        }
      })
    );
  });

  window.sincronizarAgora = function() {
    if (verificarConexao()) {
      mostrarPopup('Sincronizando dados...', 'info');
      restaurarLocalStorage()
        .then(() => salvarLocalStorage())
        .then(() => {
          mostrarPopup('Sincronização concluída', 'success');
        })
        .catch(() => {
          /* já tratado em salvar/restaurar */
        });
    } else {
      mostrarPopup('Sem conexão com a internet', 'error');
    }
  };
})();
