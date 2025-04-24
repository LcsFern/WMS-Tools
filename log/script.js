(function() {
      // ** Configuração: mapeamento de chaves para nomes fantasia **
      const keyNames = {
        ondas: 'Ondas Pré-GRADE',
        gradeCompleta: 'GRADE',
        movimentacoesProcessadas: 'Movimentações',
        ondasdin: 'Picking Dinâmico',
      };

      const trackedKeys = Object.keys(keyNames);
      const MAX_LOG_BYTES = 2 * 1024 * 1024; // 2 MB
      let skipLog = false;
      const originalSetItem = localStorage.setItem.bind(localStorage);

      function showToast(msg) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => container.removeChild(toast), 3000);
      }

      function saveLogEntry(key, rawValue) {
        const logRaw = localStorage.getItem('logHistoricoMudancas') || '[]';
        const log = JSON.parse(logRaw);
        const entry = {
          timestamp: new Date().toLocaleString('pt-BR'),
          key,
          valor: rawValue === null ? null : rawValue
        };
        log.push(entry);
        
        // Limita tamanho do log a 2 MB
        let json = JSON.stringify(log);
        let size = new Blob([json]).size;
        while (size > MAX_LOG_BYTES && log.length) {
          log.shift();
          json = JSON.stringify(log);
          size = new Blob([json]).size;
        }
        
        skipLog = true;
        originalSetItem('logHistoricoMudancas', json);
        skipLog = false;
        updateUI();
      }

      // Override localStorage.setItem
      localStorage.setItem = function(key, value) {
        originalSetItem(key, value);
        if (skipLog) return;
        if (trackedKeys.includes(key)) {
          let val;
          try { val = JSON.parse(value); } catch { val = value; }
          saveLogEntry(key, val);
        }
      };

      // Detecta mudanças em outras abas
      window.addEventListener('storage', event => {
        if (skipLog) return;
        if (trackedKeys.includes(event.key)) {
          let val;
          try { val = JSON.parse(event.newValue); } catch { val = event.newValue; }
          saveLogEntry(event.key, val);
        }
      });

      function updateUI() {
        const container = document.getElementById('logContainer');
        const raw = localStorage.getItem('logHistoricoMudancas') || '[]';
        const log = JSON.parse(raw);

        container.innerHTML = '';
        if (!log.length) {
          container.innerHTML = '<div class="no-log">Nenhuma mudança registrada ainda.</div>';
          return;
        }

        log.slice().reverse().forEach(entry => {
          const item = document.createElement('div');
          item.className = 'log-item';

          const details = document.createElement('div');
          details.className = 'log-details';
          const displayName = keyNames[entry.key] || entry.key;
          details.innerHTML = `
            <div class="log-time">${entry.timestamp}</div>
            <div class="log-key">Chave alterada: ${displayName}</div>
          `;
          if (entry.valor === null) {
            details.innerHTML += `<div class="log-deleted">Dados apagados</div>`;
          }

          const btn = document.createElement('button');
          btn.className = 'restore-btn';
          btn.textContent = 'Restaurar';
          btn.addEventListener('click', () => {
            skipLog = true;
            if (entry.valor === null) {
              originalSetItem(entry.key, '');
            } else {
              originalSetItem(entry.key, JSON.stringify(entry.valor));
            }
            skipLog = false;
            showToast(`${displayName} restaurado com sucesso`);
          });

          item.appendChild(details);
          item.appendChild(btn);
          container.appendChild(item);
        });
      }

      document.addEventListener('DOMContentLoaded', updateUI);
    })();