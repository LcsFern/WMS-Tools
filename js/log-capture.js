(function () {
    const trackedKeys = ['ondas', 'gradeCompleta', 'movimentacoesProcessadas', 'ondasdin' , 'reaba'];
    const MAX_LOG_BYTES = 2 * 1024 * 1024;
    let skipLog = false;
    const originalSetItem = localStorage.setItem.bind(localStorage);
  
    function saveLogEntryAsync(key, rawValue) {
      setTimeout(() => {
        try {
          const logRaw = localStorage.getItem('logHistoricoMudancas') || '[]';
          const log = JSON.parse(logRaw);
          const entry = {
            timestamp: new Date().toLocaleString('pt-BR'),
            key,
            valor: rawValue === null ? null : rawValue
          };
          log.push(entry);
  
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
        } catch (err) {
          console.error('Erro ao salvar log:', err);
        }
      }, 0);
    }
  
    // Substitui localStorage.setItem
    localStorage.setItem = function (key, value) {
      originalSetItem(key, value);
      if (skipLog) return;
      if (trackedKeys.includes(key)) {
        let val;
        try { val = JSON.parse(value); } catch { val = value; }
        saveLogEntryAsync(key, val);
      }
    };
  
    // Detecta mudanças feitas em outras abas
    window.addEventListener('storage', event => {
      if (skipLog) return;
      if (trackedKeys.includes(event.key)) {
        let val;
        try { val = JSON.parse(event.newValue); } catch { val = event.newValue; }
        saveLogEntryAsync(event.key, val);
      }
    });
  })();
  