// Quando o DOM estiver pronto, configura a interface
document.addEventListener('DOMContentLoaded', function () {
  // Substitui a seção de importação para usar o botão "Atualizar Dados" em vez do textarea
  const importSection = document.querySelector('.import-section');
  if (importSection) {
    importSection.innerHTML = `<button id="updateDataBtn">🔄 Atualizar Dados</button>`;
    document.getElementById('updateDataBtn').addEventListener('click', fetchCSVData);
  }

  // Configura os botões de toggle para as seções
  const toggleEmptyBtn = document.getElementById('toggleEmptyLoads');
  toggleEmptyBtn.addEventListener('click', function() {
    const table = document.getElementById('emptyLoadsTable');
    if (table.style.display === 'none' || table.style.display === '') {
      table.style.display = 'table';
      this.textContent = 'Ocultar Seção';
    } else {
      table.style.display = 'none';
      this.textContent = 'Mostrar Seção';
    }
  });

  const toggleActiveBtn = document.getElementById('toggleActiveSeparators');
  toggleActiveBtn.addEventListener('click', function() {
    const table = document.getElementById('activeSeparators');
    const countDiv = document.getElementById('separatorCount');
    if (table.style.display === 'none' || table.style.display === '') {
      table.style.display = 'table';
      countDiv.style.display = 'block';
      this.textContent = 'Ocultar Seção';
    } else {
      table.style.display = 'none';
      countDiv.style.display = 'none';
      this.textContent = 'Mostrar Seção';
    }
  });
});

// Função que busca os dados do CSV via fetch e chama o processamento
function fetchCSVData() {
  fetch('http://stvapl/export/csv?page=DLG0404017W', { credentials: 'include' })
    .then(response => response.text())
    .then(csvData => {
      processCSVData(csvData);
      document.getElementById('results').style.display = 'block';
    })
    .catch(error => console.error('Erro ao buscar CSV:', error));
}

// Função para processar os dados do CSV
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
      
      // Se for carga do tipo FIXO ou VARIÁVEL, com progresso < 100, prioridade definida (<= 50)
      // e sem separador associado, inclui na lista de cargas pendentes.
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

// Função para detectar o delimitador
function detectDelimiter(firstRow) {
  if (firstRow.includes('\t')) return '\t';
  if (firstRow.includes(';')) return ';';
  return ',';
}

// Função atualizada para processar os dados, calculando os totais para "Resumo Geral"
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
          progresso: progress
        });
      } else {
        const existing = activeSeparators.get(key);
        existing.caixas += caixas;
        existing.posicao += posicao;
        existing.progresso = Math.max(existing.progresso, progress);
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

// Atualiza a tabela de Separadores Ativos
function updateActiveSeparators(separators) {
  const tbody = document.getElementById('activeSeparatorsBody');
  let gradeCompleta = localStorage.getItem('gradeCompleta');
  let gradeMap = {};
  if (gradeCompleta) {
    try {
      let gradeData = JSON.parse(gradeCompleta);
      let dados;
      if (Array.isArray(gradeData)) {
        dados = gradeData;
      } else if (gradeData && gradeData.dadosGrade) {
        dados = gradeData.dadosGrade;
      } else {
        console.error('Estrutura inesperada em gradeCompleta');
        return;
      }
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
      return `
      <tr>
        <td>${sep.separador}</td>
        <td>${sep.caixas}</td>
        <td>${Math.ceil(sep.caixas * (100 - sep.progresso) / 100)}</td>
        <td>${sep.posicao}</td>
        <td>${sep.oe}</td>
        <td>${sep.progresso}%</td>
        <td>${sep.camara}</td>
        <td>${placa}</td>
      </tr>
    `;
    }).join('') :
    `<tr><td colspan="8">Nenhum separador ativo no momento</td></tr>`;
  const countCongelado = separators.filter(sep => sep.camara === 'CONGELADO').length;
  const countResfriado = separators.filter(sep => sep.camara === 'RESFRIADO').length;
  document.getElementById('separatorCount').innerHTML =
    `<p>Separadores - CONGELADO: ${countCongelado}, RESFRIADO: ${countResfriado}</p>`;
}

// Atualiza a tabela da seção "Tipo de Carga Pendente"
function updateEmptyLoads(emptyLoads) {
  const tbody = document.querySelector('#emptyLoadsTable tbody');
  tbody.innerHTML = '';

  if (emptyLoads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">Nenhuma carga vazia encontrada</td></tr>';
    return;
  }
  let gradeCompleta = localStorage.getItem('gradeCompleta');
  let gradeMap = {};
  if (gradeCompleta) {
    try {
      let gradeData = JSON.parse(gradeCompleta);
      let dados;
      if (Array.isArray(gradeData)) {
        dados = gradeData;
      } else if (gradeData && gradeData.dadosGrade) {
        dados = gradeData.dadosGrade;
      } else {
        console.error('Estrutura inesperada em gradeCompleta');
        return;
      }
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
        <td style="${prioridadeStyle}">${group.prioridade}</td>
        <td>${group.tipoOperacao}</td>
        <td>${group.temperatura}</td>
        <td style="${caixasStyle}">${group.caixas}</td>
        <td style="${posicaoStyle}">${group.posicao}</td>
        <td>${destino}</td>
      </tr>
    `;
  });
}

// Função para copiar texto para a área de transferência
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

// Função para adicionar o botão de reset, se necessário
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
}