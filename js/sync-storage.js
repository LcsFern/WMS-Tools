(function () {
  const userId = localStorage.getItem('username')?.toLowerCase();
  if (!userId) return;

  const chavesParaSincronizar = [
    'ondasdin', 'gradeCompleta', 'movimentacoesProcessadas',
    'ondas', 'result_state_monitor', 'checkbox_state_monitor',
    'dashboardHTML', 'rankingArray', 'logHistoricoMudancas',
  ];
  const LAST_MODIFIED_KEY = 'syncLastModified';

  let hasRestored = false;
  let skipSync = false;
  let sincronizandoAtualmente = false;
  let lastModifiedMap = {};
  try {
    lastModifiedMap = JSON.parse(localStorage.getItem(LAST_MODIFIED_KEY)) || {};
  } catch { /* ignora JSON inválido */ }

  // Função para criar e mostrar popup
  function mostrarPopup(mensagem, tipo = 'success') {
    // Cria o elemento de popup se não existir
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

    // Configura o estilo baseado no tipo
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
    
    // Mostra o popup com animação
    setTimeout(() => {
      popup.style.transform = 'translateY(0)';
      popup.style.opacity = '1';
    }, 10);

    // Remove o popup após 3 segundos
    setTimeout(() => {
      popup.style.transform = 'translateY(100px)';
      popup.style.opacity = '0';
      
      setTimeout(() => {
        if (popup && popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
      }, 300); // Espera a animação terminar
    }, 3000);
  }

  const originalSetItem = localStorage.setItem.bind(localStorage);

  // Intercepta setItem para marcar timestamp e disparar sync
  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (skipSync) return;
    if (chavesParaSincronizar.includes(key)) {
      lastModifiedMap[key] = Date.now();
      skipSync = true;
      originalSetItem(LAST_MODIFIED_KEY, JSON.stringify(lastModifiedMap));
      skipSync = false;
      salvarLocalStorage();
    }
  };

  // Envia ao servidor somente após restauração e se houver algo para enviar
  function salvarLocalStorage() {
    if (!hasRestored) {
      console.log('🛑 Aguardando restauração completa antes de sincronizar');
      return;
    }

    if (sincronizandoAtualmente) {
      console.log('🛑 Sincronização já em andamento');
      return;
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
      return;
    }

    sincronizandoAtualmente = true;

    fetch('https://tight-field-106d.tjslucasvl.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, dados: JSON.stringify(payload) }),
      signal: AbortSignal.timeout(10000) // 10 segundos de timeout
    })
    .then(() => {
      console.log('💾 Dados sincronizados ao servidor');
    })
    .catch(err => {
      console.error('❌ Erro ao sincronizar:', err);
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        console.log('Possível problema de conexão ou CORS. Tentando novamente mais tarde.');
      } else {
        mostrarPopup('Falha ao sincronizar dados. Verifique sua conexão.', 'error');
      }
    })
    .finally(() => {
      sincronizandoAtualmente = false;
    });
  }

  // Recupera do servidor e atualiza localStorage se o servidor estiver mais novo
  function restaurarLocalStorage() {
    if (sincronizandoAtualmente) {
      console.log('🛑 Operação de sincronização já em andamento');
      return Promise.resolve();
    }

    sincronizandoAtualmente = true;

    return fetch(`https://tight-field-106d.tjslucasvl.workers.dev/?userId=${userId}`, {
      signal: AbortSignal.timeout(10000) // 10 segundos de timeout
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Erro HTTP: ${res.status}`);
        }
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
        if (!(err.name === 'TypeError' && err.message.includes('Failed to fetch'))) {
          mostrarPopup('Falha ao restaurar dados do servidor', 'error');
        }
      })
      .finally(() => {
        hasRestored = true;
        sincronizandoAtualmente = false;
      });
  }

  // Verifica conexão antes de iniciar sincronização
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
    restaurarLocalStorage().then(() => salvarLocalStorage());
  });

  window.addEventListener('offline', () => {
    console.log('🛑 Conexão perdida');
  });

  window.addEventListener('beforeunload', () => {
    if (verificarConexao()) {
      salvarLocalStorage();
    }
  });

  let syncInterval = setInterval(() => {
    if (verificarConexao() && !sincronizandoAtualmente) {
      salvarLocalStorage();
    }
  }, 10000);

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
        });
    } else {
      mostrarPopup('Sem conexão com a internet', 'error');
    }
  };
})();
