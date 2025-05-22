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
  // Tenta carregar dados salvos
  const dataLoaded = loadSavedData();
  
  // Toggle para cargas pendentes
  const toggleEmptyBtn = document.getElementById('toggleEmptyLoads');
  const emptyLoadsTable = document.getElementById('emptyLoadsTable'); // Cache do elemento da tabela
  toggleEmptyBtn.addEventListener('click', function() {
    if (emptyLoadsTable.style.display === 'none' || emptyLoadsTable.style.display === '') {
      emptyLoadsTable.style.display = 'table';
      this.innerHTML = ' <i class="fa-solid fa-eye-slash"></i>';
    } else {
      emptyLoadsTable.style.display = 'none';
      this.innerHTML = '<i class="fa-solid fa-eye"></i>';
    }
  });

  // Toggle para a seção "Separadores Ativos"
  const toggleActiveBtn = document.getElementById('toggleActiveSeparators');
  const activeSeparatorsTable = document.getElementById('activeSeparators'); // Cache do elemento da tabela
  const separatorCountDiv = document.getElementById('separatorCount'); // Cache do elemento div
  toggleActiveBtn.addEventListener('click', function() {
    if (activeSeparatorsTable.style.display === 'none' || activeSeparatorsTable.style.display === '') {
      activeSeparatorsTable.style.display = 'table';
      separatorCountDiv.style.display = 'block';
      this.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
    } else {
      activeSeparatorsTable.style.display = 'none';
      separatorCountDiv.style.display = 'none';
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

// Função auxiliar para parsear o gradeCompleta do localStorage
// Retorna um mapa de OE para dados da grade.
function parseGradeMap() {
    let gradeCompleta = localStorage.getItem('gradeCompleta');
    let map = {};
    if (gradeCompleta) {
        try {
            let gradeData = JSON.parse(gradeCompleta);
            // Lida com os dois formatos possíveis de gradeData (array direto ou objeto com dadosGrade)
            let dados = Array.isArray(gradeData) ? gradeData : (gradeData.dadosGrade || []);
            dados.forEach(item => {
                let mappedItem = {
                    OE: item.OE || item['OE / VIAGEM'] || 'N/A',
                    PLACAS: item.PLACAS || (item['PLACA ROTEIRIZADA'] ? [item['PLACA ROTEIRIZADA']] : []),
                    DESTINO: item.DESTINO || 'N/A'
                };
                map[mappedItem.OE] = mappedItem;
            });
        } catch (e) {
            console.error('Erro ao parsear gradeCompleta em parseGradeMap:', e);
        }
    }
    return map;
}

function processCSVData(csvData) {
  const rows = csvData.split('\n').filter(row => row.trim() !== '');
  if (rows.length === 0) return;

  const delimiter = detectDelimiter(rows[0]);
  const headers = rows[0].split(delimiter).map(h => h.trim());
  const data = [];
  const emptyLoads = [];

  for (let i = 1; i < rows.length; i++) {
      const values = rows[i].split(delimiter);
      if (values.length === headers.length) {
          const rowObject = {};
          headers.forEach((header, index) => {
              rowObject[header] = values[index]?.trim() || '';
          });
          data.push(rowObject);

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

  // Salva os dados no localStorage
  const pickingData = {
      data: data, // Removido csvData para economizar espaço, se não for estritamente necessário
      emptyLoads: emptyLoads
  };
  localStorage.setItem('pickingData', JSON.stringify(pickingData));

  // Define e salva o timestamp do processamento ATUAL
  const now = new Date();
  const formattedDate = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  localStorage.setItem('pickingTimestamp', formattedDate);

  // Parseia o gradeMap uma vez aqui
  const gradeMap = parseGradeMap();

  processData(data, gradeMap); // Passa o gradeMap
  updateEmptyLoads(emptyLoads, gradeMap); // Passa o gradeMap
}

function detectDelimiter(firstRow) {
  if (firstRow.includes('\t')) return '\t';
  if (firstRow.includes(';')) return ';';
  return ',';
}

// Converte string no formato "dd/MM/yyyy HH:mm" para objeto Date
function parseDateFromString(timeStr) {
  const parts = timeStr.split(' ');
  if (parts.length < 2) return new Date(timeStr); // Fallback para formatos inesperados
  const dateParts = parts[0].split('/');
  const timeParts = parts[1].split(':');
  if (dateParts.length !== 3 || timeParts.length < 2) return new Date(timeStr); // Fallback
  
  const day = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // Mês é 0-indexado em JS Date
  const year = parseInt(dateParts[2], 10);
  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  const second = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
  
  return new Date(year, month, day, hour, minute, second);
}

// Processa os dados e calcula totais e separadores ativos
// === processData revisada para aceitar gradeMap ===
function processData(data, gradeMap) { // Adicionado gradeMap como parâmetro
  // === Totais para Resumo Geral ===
  const totals = {
    boxes:     { CONGELADO: 0, RESFRIADO: 0, Total: 0 },
    positions: { CONGELADO: 0, RESFRIADO: 0, Total: 0 },
    loads:     { CONGELADO: 0, RESFRIADO: 0, Total: 0 }
  };

  // Mapa: nomeSeparador → lista de objetos de linha
  const sepRows = new Map();

  data.forEach(row => {
    const caixas    = parseInt(row['CAIXAS'])     || 0;
    const posicao   = parseInt(row['POSIÇÃO'])    || 0;
    const progresso = parseFloat((row['PERCENTUAL']||'0').replace(',', '.')) || 0;
    const temp      = row['TEMPERATURA']          || 'N/A';
    const nome      = (row['SEPARADOR']||'').trim();
    const oe        = (row['OE / VIAGEM']||'').trim() || 'N/A';
    const alocStr   = (row['HORA DA ALOCAÇÃO']||'').trim();
    const fimStr    = (row['FIM']||'').trim();

    // ==== Resumo Geral ====
    const tipoPeso = row['TIPO DO PESO'];
    const usuario  = row['USUÁRIO DE ALOCAÇÃO'];
    if (usuario === '-' && (tipoPeso === 'FIXO' || tipoPeso === 'VARIÁVEL') && caixas > 0 && posicao > 0) {
      if (temp === 'CONGELADO' || temp === 'RESFRIADO') {
        totals.boxes[temp]     += caixas;
        totals.positions[temp] += posicao;
      }
    }
    if (usuario === '-' && tipoPeso === 'FIXO' && caixas > 0 && posicao > 0) {
      if (temp === 'CONGELADO' || temp === 'RESFRIADO') {
        totals.loads[temp] += 1;
      }
    }

    // ==== Agrupa linhas por separador ====
    if (nome) {
      if (!sepRows.has(nome)) sepRows.set(nome, []);
      sepRows.get(nome).push({
        camara:    temp,
        oe,
        caixas,
        posicao,
        progresso,
        alocStr,
        fimStr
      });
    }
  });

  // Atualiza Resumo Geral
  totals.boxes.Total     = totals.boxes.CONGELADO + totals.boxes.RESFRIADO;
  totals.positions.Total = totals.positions.CONGELADO + totals.positions.RESFRIADO;
  totals.loads.Total     = totals.loads.CONGELADO + totals.loads.RESFRIADO;
  updateSummaryTable('summaryBoxes',     totals.boxes);
  updateSummaryTable('summaryPositions', totals.positions);
  updateSummaryTable('summaryLoads',     totals.loads);

  // Separa ativos/inativos
  const ativos   = [];
  const inativos = [];

  sepRows.forEach((rows, nome) => {
    const ativas = rows.filter(r => r.progresso < 100);
    if (ativas.length > 0) {
      // Monta objeto de ativo a partir das linhas incompletas
      const progressoMax = Math.max(...ativas.map(r => r.progresso));
      const caixasTot    = ativas.reduce((s,r) => s + r.caixas, 0);
      const posTot       = ativas.reduce((s,r) => s + r.posicao, 0);
      // pega a última alocação (string) com base em maior valor de data
      const ultimaAloc   = ativas
        .map(r => r.alocStr)
        .filter(s => s)
        .sort((a,b) => parseDateFromString(b) - parseDateFromString(a))[0] || null;

      ativos.push({
        separador:    nome,
        camara:       ativas[0].camara, // Assume a câmara da primeira tarefa ativa
        oe:           ativas[0].oe,     // Assume a OE da primeira tarefa ativa
        caixas:       caixasTot,
        posicao:      posTot,
        progresso:    progressoMax,
        horaAlocacao: ultimaAloc
      });
    } else {
      // Todas as linhas concluídas => inativo
      // pega a última FIM
      const ultimaFim = rows
        .map(r => r.fimStr)
        .filter(s => s)
        .sort((a,b) => parseDateFromString(b) - parseDateFromString(a))[0] || null;

      inativos.push({
        separador: nome,
        oe:         rows[0].oe, // OE da primeira tarefa (todas concluídas)
        camara:     rows[0].camara, // Câmara da primeira tarefa
        ultimoFim:  ultimaFim
      });
    }
  });

  // Exibe
  ativos.sort((a,b) => b.progresso - a.progresso); // Ordena por maior progresso
  updateActiveSeparators(ativos, gradeMap); // Passa o gradeMap
  updateInactiveSeparatorsTable(inativos, gradeMap); // Passa o gradeMap
}


// Atualiza as tabelas de resumo geral
function updateSummaryTable(elementId, data) {
  const table = document.getElementById(elementId);
  if (!table) return; // Adiciona verificação para evitar erros se o elemento não existir
  table.innerHTML = `
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
  if (isNaN(allocationTime.getTime())) return { text: 'N/A', overOne: false }; // Verifica se a data é válida
  const now = new Date();
  const diffMs = now - allocationTime;
  const diffMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return { text: `${hours}h ${minutes}m`, overOne: (hours >= 1) };
}

// Atualiza a tabela de Separadores Ativos e chama o processamento dos separadores inativos
// === updateActiveSeparators revisada para aceitar gradeMap ===
function updateActiveSeparators(separators, gradeMap) { // Adicionado gradeMap como parâmetro
  const tbody = document.getElementById('activeSeparatorsBody');
  if (!tbody) return;

  // Não é mais necessário buscar gradeMap aqui, ele é passado como parâmetro
  
  tbody.innerHTML = separators.length > 0 ?
    separators.map(sep => {
      let placa = gradeMap[sep.oe]?.PLACAS?.[0] || ''; // Usa o gradeMap passado
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
  const separatorCountEl = document.getElementById('separatorCount');
  if (separatorCountEl) {
    separatorCountEl.innerHTML =
      `<p>Separadores - CONGELADO: ${countCongelado}, RESFRIADO: ${countResfriado}</p>`;
  }
  
  filterActiveSeparatorsTable(); // Aplica filtro, se houver seleção definida.
  
  // A função processInactiveSeparators ainda existe e será chamada.
  // Se ela também precisa de gradeMap para sua lógica interna ou para passar adiante,
  // ela precisará ser ajustada para recebê-lo.
  // No código original, processInactiveSeparators chama updateInactiveSeparatorsTable, que já foi ajustada para receber gradeMap.
  // Portanto, passamos gradeMap para processInactiveSeparators também.
  processInactiveSeparators(separators, gradeMap); 
}

// Processa os separadores inativos (aqueles ativos por mais de 1 hora) e atualiza a tabela
// === processInactiveSeparators revisada para aceitar e passar gradeMap ===
function processInactiveSeparators(activeSeparators, gradeMap) { // Adicionado gradeMap como parâmetro
  const inactiveDueToTime = [];
  const now = new Date();

  activeSeparators.forEach(sep => {
    if (!sep.horaAlocacao) return; // Pula se não houver hora de alocação
    const allocationTime = parseDateFromString(sep.horaAlocacao);
    if (isNaN(allocationTime.getTime())) return; // Pula se a data for inválida

    const diffHours = (now - allocationTime) / 3600000; // Calcula diferença em horas
    if (diffHours >= 1) { // Se ativo por 1 hora ou mais
      inactiveDueToTime.push({
        separador: sep.separador,
        oe: sep.oe,
        camara: sep.camara,
        // horaAlocacao: sep.horaAlocacao, // Não parece ser usado na tabela de inativos
        ultimoFim: sep.ultimoFim || 'N/A' // usa ultimoFim se existir, senão N/A (original era null)
      });
    }
  });

  // Esta função ATUALIZA a tabela de inativos com os separadores que estão ativos há muito tempo.
  // Isso pode sobrescrever os inativos "reais" (100% concluídos) se chamada depois.
  // A ordem das chamadas em processData é: updateActiveSeparators (que chama esta), depois updateInactiveSeparatorsTable (com os 100% concluídos).
  // Portanto, o resultado desta chamada será provavelmente sobrescrito.
  // Mantendo a lógica original, mas ciente dessa possível sobreposição.
  if (inactiveDueToTime.length > 0) {
      updateInactiveSeparatorsTable(inactiveDueToTime, gradeMap); // Passa o gradeMap
  }
}


// Atualiza a tabela de Separadores Inativos dentro do container da seção de Separadores Ativos
// === updateInactiveSeparatorsTable revisada para aceitar gradeMap ===
function updateInactiveSeparatorsTable(inactiveSeparators, gradeMap) { // Adicionado gradeMap como parâmetro
  const container = document.getElementById('inactiveSeparatorsContainer');
  if (!container) return;

  if (inactiveSeparators.length === 0) {
    container.style.display = 'none';
    container.innerHTML = ''; // Limpa o conteúdo se não houver inativos
    return;
  }
  container.style.display = 'block';

  // Não é mais necessário buscar gradeMap aqui, ele é passado como parâmetro

  let html = `
    <h3><i class="fas fa-user-slash"></i> Separadores Inativos</h3>
    <table id="inactiveSeparators">
      <thead>
        <tr>
          <th>Separador</th>
          <th>Última OE</th>
          <th>Temperatura</th>
          <th>Última Placa</th>
          <th>Visto pela última vez</th>
        </tr>
      </thead>
      <tbody>
  `;
  html += inactiveSeparators.map(item => {
    const placa    = (gradeMap[item.oe]?.PLACAS?.[0] || ''); // Usa o gradeMap passado
    const lastSeen = item.ultimoFim || 'N/A'; // Mantém consistência com N/A
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
  html += `</tbody></table>`;

  container.innerHTML = html;
}



// Atualiza a tabela da seção "Tipo de Carga Pendente"
// === updateEmptyLoads revisada para aceitar gradeMap ===
function updateEmptyLoads(emptyLoads, gradeMap) { // Adicionado gradeMap como parâmetro
  const tbody = document.querySelector('#emptyLoadsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = ''; // Limpa a tabela antes de adicionar novas linhas

  const emptyLoadsCountEl = document.getElementById('emptyLoadsCount');

  if (emptyLoads.length === 0) {
    if (emptyLoadsCountEl) emptyLoadsCountEl.textContent = `(Total: 0)`;
    tbody.innerHTML = '<tr><td colspan="9">Nenhuma carga vazia encontrada</td></tr>';
    return;
  }

  // Não é mais necessário buscar gradeMap aqui, ele é passado como parâmetro

  const grouped = {};
  emptyLoads.forEach(load => {
    // Chave única para agrupamento
    const key = `${load.oe}|${load.grupo}|${load.tipoOperacao}|${load.temperatura}`;
    if (!grouped[key]) {
      grouped[key] = {
        oe: load.oe,
        grupo: load.grupo,
        tipoOperacao: load.tipoOperacao,
        temperatura: load.temperatura,
        prioridade: load.prioridade, // Mantém a prioridade da primeira ocorrência (ou menor, se ajustado)
        caixas: 0, // Inicia zerado para somar
        posicao: 0 // Inicia zerado para somar
      };
    }
    // Soma caixas e posições
    grouped[key].caixas += load.caixas;
    grouped[key].posicao += load.posicao;
    // Mantém a menor prioridade para o grupo
    grouped[key].prioridade = Math.min(grouped[key].prioridade, load.prioridade);
  });

  let groups = Object.values(grouped);
  groups.sort((a, b) => a.prioridade - b.prioridade); // Ordena por prioridade

  if (emptyLoadsCountEl) emptyLoadsCountEl.textContent = `Total: ${groups.length}`;

  // Cálculos para gradiente de cor
  const totalCaixas = groups.reduce((sum, g) => sum + g.caixas, 0);
  const totalPosicao = groups.reduce((sum, g) => sum + g.posicao, 0);
  const mediaCaixas = groups.length > 0 ? totalCaixas / groups.length : 0;
  const mediaPosicao = groups.length > 0 ? totalPosicao / groups.length : 0;

  // Função para gerar cor entre verde, amarelo e vermelho conforme o valor em relação à média
  function getColorGradient(value, media) {
    if (media === 0) return ''; // Evita divisão por zero se a média for 0
    const diff = value - media;
    const ratio = Math.min(Math.abs(diff) / media, 1); // normaliza entre 0 e 1
    let r = 0, g = 0;

    if (diff < 0) { // Abaixo da média: tende ao verde
      r = Math.round(255 * ratio); 
      g = 255;
    } else { // Acima da média: tende ao vermelho
      r = 255;
      g = Math.round(255 * (1 - ratio)); 
    }
    return `background: rgba(${r},${g},0,0.5)`;
  }

  groups.forEach(group => {
    let caixasStyle = getColorGradient(group.caixas, mediaCaixas);
    let posicaoStyle = getColorGradient(group.posicao, mediaPosicao);
    let prioridadeStyle = group.prioridade < 10 ? 'color: green; font-weight: bold;' : '';

    let placa = gradeMap[group.oe]?.PLACAS?.[0] || ''; // Usa o gradeMap passado
    let destino = gradeMap[group.oe]?.DESTINO || ''; // Usa o gradeMap passado

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

  filterLoadTable(); // Aplica o filtro de temperatura
}


// Função para copiar texto para a área de transferência (sem popup)
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error('Falha ao copiar texto: ', err); // Adiciona um log de erro
  });
}

function addResetButton() {
  const importSection = document.querySelector('.import-section');
  if (!importSection) return; // Sai se a seção de importação não for encontrada

  let resetBtn = document.getElementById('resetBtn');

  if (!resetBtn) {
      resetBtn = document.createElement('button');
      resetBtn.id = 'resetBtn';
      resetBtn.innerHTML = '<i class="fas fa-undo"></i> Resetar';
      resetBtn.addEventListener('click', function() {
          const csvContentArea = document.getElementById('csvContent');
          if (csvContentArea) {
            csvContentArea.value = '';
            csvContentArea.style.display = 'block';
          }
          
          const resultsDiv = document.getElementById('results');
          if (resultsDiv) resultsDiv.style.display = 'none';
          
          resetSummaryTables();
          localStorage.removeItem('pickingData');
          localStorage.removeItem('pickingTimestamp'); 
          
          const timestampEl = document.getElementById('dataTimestamp');
          if (timestampEl) {
              timestampEl.remove(); 
          }
          this.remove(); 
      });
      importSection.appendChild(resetBtn);
  }

  // Lógica do Timestamp: Adiciona ou atualiza o elemento do timestamp
  let timestampEl = document.getElementById('dataTimestamp');
  if (!timestampEl) {
      timestampEl = document.createElement('div');
      timestampEl.id = 'dataTimestamp';
      timestampEl.style.marginTop = '10px';
      timestampEl.style.fontSize = '0.9rem';
      timestampEl.style.color = 'var(--accent)';
      
      if (resetBtn.nextSibling) {
          importSection.insertBefore(timestampEl, resetBtn.nextSibling);
      } else {
          importSection.appendChild(timestampEl);
      }
  }

  const storedTimestamp = localStorage.getItem('pickingTimestamp');
  if (storedTimestamp) {
      timestampEl.innerHTML = `<i class="fas fa-clock"></i> Dados de: ${storedTimestamp}`;
      timestampEl.style.display = 'block'; 
  } else {
      timestampEl.innerHTML = ''; 
      timestampEl.style.display = 'none';
  }
}

function resetSummaryTables() {
  const idsToClear = ['summaryBoxes', 'summaryPositions', 'summaryLoads', 'separatorCount', 'activeSeparatorsBody', 'inactiveSeparatorsContainer'];
  idsToClear.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  
  const emptyLoadsTbody = document.querySelector('#emptyLoadsTable tbody');
  if (emptyLoadsTbody) emptyLoadsTbody.innerHTML = '';
}

// FUNÇÕES DE FILTRO

// Filtra as linhas da tabela de separadores ativos com base na temperatura selecionada
function filterActiveSeparatorsTable() {
  const filterValue = document.getElementById('activeFilterTemp').value;
  const table = document.getElementById('activeSeparators');
  if (!table) return;
  const rows = table.getElementsByTagName('tr');
  
  for (let i = 1; i < rows.length; i++) { // Pula o cabeçalho (índice 0)
    const cells = rows[i].getElementsByTagName('td');
    if (cells.length > 5) { // A coluna de temperatura é a 6ª (índice 5)
      const cellText = cells[5].textContent.trim();
      rows[i].style.display = (filterValue === 'Todos' || cellText === filterValue) ? '' : 'none';
    }
  }
}

// Filtra as linhas da tabela de cargas pendentes com base na temperatura selecionada
function filterLoadTable() {
  const filterValue = document.getElementById('loadFilterTemp').value;
  const table = document.getElementById('emptyLoadsTable');
  if (!table) return;
  const rows = table.getElementsByTagName('tr');

  for (let i = 1; i < rows.length; i++) { // Pula o cabeçalho (índice 0)
    const cells = rows[i].getElementsByTagName('td');
    if (cells.length > 5) { // A coluna de temperatura é a 6ª (índice 5)
      const cellText = cells[5].textContent.trim();
      rows[i].style.display = (filterValue === 'Todos' || cellText === filterValue) ? '' : 'none';
    }
  }
}

function loadSavedData() {
  const savedData = localStorage.getItem('pickingData');
  if (savedData) {
      try {
          const parsedData = JSON.parse(savedData);
          const csvContentArea = document.getElementById('csvContent');
          if (csvContentArea) csvContentArea.style.display = 'none';

          // Parseia o gradeMap uma vez aqui para os dados carregados
          const gradeMap = parseGradeMap();

          processData(parsedData.data, gradeMap); // Passa gradeMap
          updateEmptyLoads(parsedData.emptyLoads, gradeMap); // Passa gradeMap

          const resultsDiv = document.getElementById('results');
          if (resultsDiv) resultsDiv.style.display = 'block';
          
          addResetButton(); 
          return true; 
      } catch (error) {
          console.error('Erro ao carregar os dados salvos:', error);
          // Considerar limpar localStorage em caso de erro persistente
          // localStorage.removeItem('pickingData');
          // localStorage.removeItem('pickingTimestamp');
      }
  }
  return false; 
}