// Processa automaticamente ao colar
    document.getElementById('csvContent').addEventListener('paste', function(e) {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text');
      this.value = pasteData; // garante que o textarea seja atualizado
      if (!pasteData.trim()) {
        alert("Por favor, cole o conteúdo do CSV.");
        return;
      }
      processCSVData(pasteData.trim());
      document.getElementById('results').style.display = 'block';
      this.style.display = 'none';
      addResetButton();
    });

    // Toggle para a seção "TIPO DE CARGA PENDENTE" – alterna apenas a tabela, não o título com o botão
    document.addEventListener('DOMContentLoaded', function() {
      // Toggle para cargas pendentes
      const toggleEmptyBtn = document.getElementById('toggleEmptyLoads');
      toggleEmptyBtn.addEventListener('click', function() {
        const table = document.getElementById('emptyLoadsTable');
        if (table.style.display === 'none' || table.style.display === '') {
          table.style.display = 'table';
            this.innerHTML = ' <i class="fa-solid fa-eye-slash"></i>';
        } else {
          table.style.display = 'none';
            this.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
      });

      // Toggle para a seção "Separadores Ativos" – alterna tabela e contagem
      const toggleActiveBtn = document.getElementById('toggleActiveSeparators');
      toggleActiveBtn.addEventListener('click', function() {
        const table = document.getElementById('activeSeparators');
        const countDiv = document.getElementById('separatorCount');
        if (table.style.display === 'none' || table.style.display === '') {
          table.style.display = 'table';
          countDiv.style.display = 'block';
            this.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
        } else {
          table.style.display = 'none';
          countDiv.style.display = 'none';
          this.innerHTML = '<i class="fa-solid fa-eye"></i>';
        }
      });

      // Eventos dos filtros de temperatura
      document.getElementById('activeFilterTemp').addEventListener('change', filterActiveSeparatorsTable);
      document.getElementById('loadFilterTemp').addEventListener('change', filterLoadTable);
    });

    // Função para upload via arquivo local (caso seja necessário)
    function uploadLocalFile(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(e) {
        processCSVData(e.target.result);
        document.getElementById('results').style.display = 'block';
      };
      reader.readAsText(file);
    }

    function processCSVData(csvData) {
      const rows = csvData.split('\n').filter(row => row.trim() !== '');
      if (rows.length === 0) return;
      
      const delimiter = detectDelimiter(rows[0]);
      const headers = rows[0].split(delimiter).map(h => h.trim());
      const data = [];
      // Array para armazenar as cargas vazias (TIPO DE CARGA)
      const emptyLoads = [];
      
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(delimiter);
        if (values.length === headers.length) {
          const rowObject = {}; 
          headers.forEach((header, index) => {
            rowObject[header] = values[index]?.trim() || '';
          });
          data.push(rowObject);
          
          // Cargas pendentes: FIXO ou VARIÁVEL, progresso < 100, prioridade definida (<= 50) e sem separador
          if (
            (rowObject['TIPO DO PESO'] === 'FIXO' || rowObject['TIPO DO PESO'] === 'VARIÁVEL') &&
            rowObject['PERCENTUAL'] &&
            parseFloat(rowObject['PERCENTUAL'].replace(',', '.')) < 100 &&
            rowObject['PRIORIDADE'] &&
            parseInt(rowObject['PRIORIDADE']) <= 50 &&
            (!rowObject['SEPARADOR'] || rowObject['SEPARADOR'].trim() === '')
          ) {
            emptyLoads.push({
              oe: rowObject['OE / VIAGEM'] || 'N/A',
              grupo: rowObject['GRUPO'] || 'N/A',
              tipoOperacao: rowObject['TIPO DE OPERAÇÃO'] || 'N/A',
              prioridade: parseInt(rowObject['PRIORIDADE']),
              temperatura: rowObject['TEMPERATURA'] || 'N/A',
              caixas: parseInt(rowObject['CAIXAS']) || 0,
              posicao: parseInt(rowObject['POSIÇÃO']) || 0
            });
          }
        }
      }

      processData(data);
      updateEmptyLoads(emptyLoads);
    }

    function detectDelimiter(firstRow) {
      if (firstRow.includes('\t')) return '\t';
      if (firstRow.includes(';')) return ';';
      return ',';
    }

    // Converte string no formato "dd/MM/yyyy HH:mm" para objeto Date
    function parseDateFromString(timeStr) {
      const parts = timeStr.split(' ');
      if (parts.length < 2) return new Date(timeStr);
      const dateParts = parts[0].split('/');
      const timeParts = parts[1].split(':');
      if (dateParts.length !== 3 || timeParts.length < 2) return new Date(timeStr);
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);
      const hour = parseInt(timeParts[0], 10);
      const minute = parseInt(timeParts[1], 10);
      const second = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
      return new Date(year, month, day, hour, minute, second);
    }

    // Processa os dados e calcula totais e separadores ativos
    function processData(data) {
      let totals = {
        boxes: { CONGELADO: 0, RESFRIADO: 0, Total: 0 },
        positions: { CONGELADO: 0, RESFRIADO: 0, Total: 0 },
        loads: { CONGELADO: 0, RESFRIADO: 0, Total: 0 }
      };

      const activeSeparators = new Map();

      data.forEach(row => {
        const temp = row['TEMPERATURA'];
        const tipoPeso = row['TIPO DO PESO'];
        const caixas = parseInt(row['CAIXAS']) || 0;
        const posicao = parseInt(row['POSIÇÃO']) || 0;
        const usuarioAlocacao = row['USUÁRIO DE ALOCAÇÃO'];
        const progress = parseFloat((row['PERCENTUAL'] || '0').replace(',', '.')) || 0;

        // Totais para Resumo Geral (usuário '-' somente)
        if (usuarioAlocacao === '-' && (tipoPeso === 'FIXO' || tipoPeso === 'VARIÁVEL') && caixas > 0 && posicao > 0) {
          if (temp === 'CONGELADO' || temp === 'RESFRIADO') {
            totals.boxes[temp] += caixas;
            totals.positions[temp] += posicao;
          }
        }
        if (usuarioAlocacao === '-' && tipoPeso === 'FIXO' && caixas > 0 && posicao > 0) {
          if (temp === 'CONGELADO' || temp === 'RESFRIADO') {
            totals.loads[temp] += 1;
          }
        }

        // Processa separadores ativos (progresso < 100 e separador definido)
        if (progress < 100 && row['SEPARADOR'] && row['SEPARADOR'].trim()) {
          const oe = (row['OE / VIAGEM'] && row['OE / VIAGEM'].trim()) || 'N/A';
          const key = `${row['SEPARADOR']}|${temp}|${oe}`;
          
          if (!activeSeparators.has(key)) {
            activeSeparators.set(key, {
              separador: row['SEPARADOR'],
              camara: temp || 'N/A',
              oe: oe,
              caixas: caixas,
              posicao: posicao,
              progresso: progress,
              horaAlocacao: row['HORA DA ALOCAÇÃO'] || null
            });
          } else {
            const existing = activeSeparators.get(key);
            existing.caixas += caixas;
            existing.posicao += posicao;
            existing.progresso = Math.max(existing.progresso, progress);
            if (!existing.horaAlocacao && row['HORA DA ALOCAÇÃO']) {
              existing.horaAlocacao = row['HORA DA ALOCAÇÃO'];
            }
          }
        }
      });

      totals.boxes.Total = totals.boxes.CONGELADO + totals.boxes.RESFRIADO;
      totals.positions.Total = totals.positions.CONGELADO + totals.positions.RESFRIADO;
      totals.loads.Total = totals.loads.CONGELADO + totals.loads.RESFRIADO;

      updateSummaryTable('summaryBoxes', totals.boxes);
      updateSummaryTable('summaryPositions', totals.positions);
      updateSummaryTable('summaryLoads', totals.loads);

      const sortedSeparators = Array.from(activeSeparators.values()).sort((a, b) => b.progresso - a.progresso);
      updateActiveSeparators(sortedSeparators);
    }

    // Atualiza as tabelas de resumo geral
    function updateSummaryTable(elementId, data) {
      document.getElementById(elementId).innerHTML = `
        <tr><th>Temperatura</th><th>Quantidade</th></tr>
        <tr><td>CONGELADO</td><td>${data.CONGELADO}</td></tr>
        <tr><td>RESFRIADO</td><td>${data.RESFRIADO}</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>${data.Total}</strong></td></tr>
      `;
    }

    // Calcula o tempo no veículo com base na "HORA DA ALOCAÇÃO" (no formato "dd/MM/yyyy HH:mm")
    function computeTimeDifference(timeStr) {
      if (!timeStr || timeStr.trim() === "-") return { text: 'N/A', overOne: false };
      let allocationTime = parseDateFromString(timeStr);
      if (isNaN(allocationTime.getTime())) return { text: 'N/A', overOne: false };
      const now = new Date();
      const diffMs = now - allocationTime;
      const diffMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return { text: `${hours}h ${minutes}m`, overOne: (hours >= 1) };
    }

    // Atualiza a tabela de Separadores Ativos e chama o processamento dos separadores inativos
    function updateActiveSeparators(separators) {
      const tbody = document.getElementById('activeSeparatorsBody');
      
      let gradeCompleta = localStorage.getItem('gradeCompleta');
      let gradeMap = {};
      if (gradeCompleta) {
        try {
          let gradeData = JSON.parse(gradeCompleta);
          let dados = Array.isArray(gradeData) ? gradeData : (gradeData.dadosGrade || []);
          dados.forEach(item => {
            let mappedItem = {
              OE: item.OE || item['OE / VIAGEM'] || 'N/A',
              PLACAS: item.PLACAS || (item['PLACA ROTEIRIZADA'] ? [item['PLACA ROTEIRIZADA']] : []),
              DESTINO: item.DESTINO || 'N/A'
            };
            gradeMap[mappedItem.OE] = mappedItem;
          });
        } catch (e) {
          console.error('Erro ao parsear gradeCompleta', e);
        }
      }
      
      tbody.innerHTML = separators.length > 0 ?
        separators.map(sep => {
          let placa = gradeMap[sep.oe]?.PLACAS?.[0] || '';
          let timeData = computeTimeDifference(sep.horaAlocacao);
          let tempoVeiculo = timeData.overOne ? `<span style="color:red;">${timeData.text}</span>` : timeData.text;
          return `
              <tr>
                <td>${sep.separador}</td>
                <td>${sep.caixas}</td>
                <td>${sep.posicao}</td>
                <td>${sep.oe}</td>
                <td>
                  <div class="progress-container">
                    <div class="progress-bar" style="width: ${sep.progresso}%;"></div>
                    <span class="progress-text">${sep.progresso}%</span>
                  </div>
                </td>
                <td>${sep.camara}</td>
                <td>${placa}</td>
                <td>${tempoVeiculo}</td>
              </tr>
          `;
        }).join('') :
        `<tr><td colspan="8">Nenhum separador ativo no momento</td></tr>`;

      const countCongelado = separators.filter(sep => sep.camara === 'CONGELADO').length;
      const countResfriado = separators.filter(sep => sep.camara === 'RESFRIADO').length;
      document.getElementById('separatorCount').innerHTML =
        `<p>Separadores - CONGELADO: ${countCongelado}, RESFRIADO: ${countResfriado}</p>`;

      // Aplica filtro, se houver seleção definida.
      filterActiveSeparatorsTable();
      
      processInactiveSeparators(separators);
    }

    // Processa os separadores inativos persistindo-os e atualizando a tabela na área mesclada
    function processInactiveSeparators(separators) {
      const inactiveSeparators = [];
      const now = new Date();

      separators.forEach(sep => {
      const allocationTime = parseDateFromString(sep.horaAlocacao);
      if (isNaN(allocationTime.getTime())) return;

      const diffHours = (now - allocationTime) / 3600000;
      if (diffHours >= 1) {
        inactiveSeparators.push({
        separador: sep.separador,
        oe: sep.oe,
        camara: sep.camara,
        horaAlocacao: sep.horaAlocacao,
        ultimoFim: sep.ultimoFim || null
        });
      }
      });

      updateInactiveSeparatorsTable(inactiveSeparators);
    }
    
    

    // Atualiza a tabela de Separadores Inativos dentro do container da seção de Separadores Ativos
    function updateInactiveSeparatorsTable(inactiveSeparators) {
      const container = document.getElementById('inactiveSeparatorsContainer');
      if (inactiveSeparators.length === 0) {
        container.style.display = 'none';
        return;
      }
      container.style.display = 'block';
      let gradeCompleta = localStorage.getItem('gradeCompleta');
      let gradeMap = {};
      if (gradeCompleta) {
        try {
          let gradeData = JSON.parse(gradeCompleta);
          let dados = Array.isArray(gradeData) ? gradeData : (gradeData.dadosGrade || []);
          dados.forEach(item => {
            let mappedItem = {
              OE: item.OE || item['OE / VIAGEM'] || 'N/A',
              PLACAS: item.PLACAS || (item['PLACA ROTEIRIZADA'] ? [item['PLACA ROTEIRIZADA']] : []),
              DESTINO: item.DESTINO || 'N/A'
            };
            gradeMap[mappedItem.OE] = mappedItem;
          });
        } catch (e) {
          console.error('Erro ao parsear gradeCompleta', e);
        }
      }
      
      let html = `
        <h3><i class="fas fa-user-slash"></i> Separadores Inativos</h3>
        <table id="inactiveSeparators">
          <thead>
            <tr>
              <th><i class="fas fa-user"></i> Separador</th>
              <th><i class="fas fa-barcode"></i> Última OE</th>
              <th><i class="fas fa-thermometer-half"></i> Temperatura</th>
              <th><i class="fa-solid fa-truck-clock"></i> Última Placa</th>
              <th><i class="fas fa-clock"></i> Visto pela última vez</th>
            </tr>
          </thead>
          <tbody id="inactiveSeparatorsBody">
      `;
      html += inactiveSeparators.map(item => {
        let placa = gradeMap[item.oe]?.PLACAS?.[0] || '';
        let lastSeen = 'N/A';
        
        // Usar preferencialmente o ultimoFim se disponível, caso contrário usar horaAlocacao
        if (item.ultimoFim) {
          lastSeen = item.ultimoFim;
        } else if (item.horaAlocacao) {
          const d = new Date(item.horaAlocacao);
          lastSeen = isNaN(d.getTime()) ? item.horaAlocacao : d.toLocaleTimeString();
        }
        
        return `
           <tr>
             <td>${item.separador}</td>
             <td>${item.oe}</td>
             <td>${item.camara}</td>
             <td>${placa}</td>
             <td>${lastSeen}</td>
           </tr>
        `;
      }).join('');
      html += `
         
      `;
      container.innerHTML = html;
    }

    // Atualiza a tabela da seção "Tipo de Carga Pendente"
    function updateEmptyLoads(emptyLoads) {
      const tbody = document.querySelector('#emptyLoadsTable tbody');
      tbody.innerHTML = '';

      if (emptyLoads.length === 0) {
        document.getElementById('emptyLoadsCount').textContent = `(Total: 0)`;
        tbody.innerHTML = '<tr><td colspan="9">Nenhuma carga vazia encontrada</td></tr>';
        return;
      }

      let gradeCompleta = localStorage.getItem('gradeCompleta');
      let gradeMap = {};
      if (gradeCompleta) {
        try {
          let gradeData = JSON.parse(gradeCompleta);
          let dados = Array.isArray(gradeData) ? gradeData : (gradeData.dadosGrade || []);
          dados.forEach(item => {
            let mappedItem = {
              OE: item.OE || item['OE / VIAGEM'] || 'N/A',
              PLACAS: item.PLACAS || (item['PLACA ROTEIRIZADA'] ? [item['PLACA ROTEIRIZADA']] : []),
              DESTINO: item.DESTINO || 'N/A'
            };
            gradeMap[mappedItem.OE] = mappedItem;
          });
        } catch (e) {
          console.error('Erro ao parsear gradeCompleta', e);
        }
      }

      const grouped = {};
      emptyLoads.forEach(load => {
        const key = `${load.oe}|${load.grupo}|${load.tipoOperacao}|${load.temperatura}`;
        if (!grouped[key]) {
          grouped[key] = {
            oe: load.oe,
            grupo: load.grupo,
            tipoOperacao: load.tipoOperacao,
            temperatura: load.temperatura,
            prioridade: load.prioridade,
            caixas: load.caixas,
            posicao: load.posicao
          };
        } else {
          grouped[key].caixas += load.caixas;
          grouped[key].posicao += load.posicao;
          grouped[key].prioridade = Math.min(grouped[key].prioridade, load.prioridade);
        }
      });

      let groups = Object.values(grouped);
      groups.sort((a, b) => a.prioridade - b.prioridade);

      document.getElementById('emptyLoadsCount').textContent = `Total: ${groups.length}`;

      const totalCaixas = groups.reduce((sum, g) => sum + g.caixas, 0);
      const totalPosicao = groups.reduce((sum, g) => sum + g.posicao, 0);
      const mediaCaixas = groups.length > 0 ? totalCaixas / groups.length : 0;
      const mediaPosicao = groups.length > 0 ? totalPosicao / groups.length : 0;

      groups.forEach(group => {
        let caixasStyle = group.caixas > mediaCaixas ? 
          `background: rgba(255,0,0,${Math.min((group.caixas - mediaCaixas) / mediaCaixas, 1)})` : 
          group.caixas < mediaCaixas ? 
          `background: rgba(0,255,0,${Math.min((mediaCaixas - group.caixas) / mediaCaixas, 1)})` : '';
        
        let posicaoStyle = group.posicao < mediaPosicao ? 
          `background: rgba(0,255,0,${Math.min((mediaPosicao - group.posicao) / mediaPosicao, 1)})` : 
          group.posicao > mediaPosicao ? 
          `background: rgba(255,0,0,${Math.min((group.posicao - mediaPosicao) / mediaPosicao, 1)})` : '';

        let prioridadeStyle = group.prioridade < 10 ? 'color: green; font-weight: bold;' : '';

        let placa = gradeMap[group.oe]?.PLACAS?.[0] || '';
        let destino = gradeMap[group.oe]?.DESTINO || '';

        tbody.innerHTML += `
          <tr>
            <td>${placa}</td>
            <td>${group.oe} <button onclick="copyToClipboard('${group.oe}')" title="Copiar OE" style="font-size:0.6rem; padding:0.2rem;"><i class="fas fa-copy"></i></button></td>
            <td>${group.grupo}</td>
            <td style="${prioridadeStyle}">${group.prioridade}</td>
            <td>${group.tipoOperacao}</td>
            <td>${group.temperatura}</td>
            <td style="${caixasStyle}">${group.caixas}</td>
            <td style="${posicaoStyle}">${group.posicao}</td>
            <td>${destino}</td>
          </tr>
        `;
      });
      // Aplica o filtro de temperatura para as cargas, se definido
      filterLoadTable();
    }

    // Função para copiar texto para a área de transferência (sem popup)
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text);
    }

    function addResetButton() {
      const importSection = document.querySelector('.import-section');
      let resetBtn = document.getElementById('resetBtn');
      if (!resetBtn) {
        resetBtn = document.createElement('button');
        resetBtn.id = 'resetBtn';
        resetBtn.innerHTML = '<i class="fas fa-undo"></i> Resetar';
        resetBtn.addEventListener('click', function() {
          document.getElementById('csvContent').value = '';
          document.getElementById('csvContent').style.display = 'block';
          document.getElementById('results').style.display = 'none';
          resetSummaryTables();
          this.remove();
        });
        importSection.appendChild(resetBtn);
      }
    }

    function resetSummaryTables() {
      document.getElementById('summaryBoxes').innerHTML = '';
      document.getElementById('summaryPositions').innerHTML = '';
      document.getElementById('summaryLoads').innerHTML = '';
      document.getElementById('separatorCount').innerHTML = '';
      document.getElementById('activeSeparatorsBody').innerHTML = '';
      document.querySelector('#emptyLoadsTable tbody').innerHTML = '';
      document.getElementById('inactiveSeparatorsContainer').innerHTML = '';
    }

    // FUNÇÕES DE FILTRO

    // Filtra as linhas da tabela de separadores ativos com base na temperatura selecionada
    function filterActiveSeparatorsTable() {
      const filterValue = document.getElementById('activeFilterTemp').value;
      const table = document.getElementById('activeSeparators');
      const rows = table.getElementsByTagName('tr');
      // Pula o cabeçalho (índice 0)
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        // A coluna de temperatura é a 6ª (índice 5)
        if (cells.length > 5) {
          const cellText = cells[5].textContent.trim();
          if (filterValue === 'Todos' || cellText === filterValue) {
            rows[i].style.display = '';
          } else {
            rows[i].style.display = 'none';
          }
        }
      }
    }

    // Filtra as linhas da tabela de cargas pendentes com base na temperatura selecionada
    function filterLoadTable() {
      const filterValue = document.getElementById('loadFilterTemp').value;
      const table = document.getElementById('emptyLoadsTable');
      const rows = table.getElementsByTagName('tr');
      // Pula o cabeçalho (índice 0)
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        // A coluna de temperatura é a 6ª (índice 5)
        if (cells.length > 5) {
          const cellText = cells[5].textContent.trim();
          if (filterValue === 'Todos' || cellText === filterValue) {
            rows[i].style.display = '';
          } else {
            rows[i].style.display = 'none';
          }
        }
      }
    }