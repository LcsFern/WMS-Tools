// Processa automaticamente ao colar
document.getElementById('csvContent').addEventListener('paste', function(e) {
  setTimeout(() => {
    const content = this.value.trim();
    if (!content) {
      alert("Por favor, cole o conteúdo do CSV.");
      return;
    }
    processCSVData(content);
    document.getElementById('results').style.display = 'block';
    this.style.display = 'none';
    addResetButton();
  }, 100);
});

// Toggle para a seção "TIPO DE CARGA" – alterna apenas a tabela, não o título com o botão
document.addEventListener('DOMContentLoaded', function() {
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

  // Toggle para a seção "Separadores Ativos" – alterna apenas a tabela e a div de contagem
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
      
      // Se for carga do tipo FIXO ou VARIÁVEL, com progresso < 100, PRIORIDADE definida (<= 50)
      if (
        (rowObject['TIPO DO PESO'] === 'FIXO' || rowObject['TIPO DO PESO'] === 'VARIÁVEL') &&
        rowObject['PERCENTUAL'] &&
        parseFloat(rowObject['PERCENTUAL'].replace(',', '.')) < 100 &&
        rowObject['PRIORIDADE'] &&
        parseInt(rowObject['PRIORIDADE']) <= 50
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

function processData(data) {
  // Totais do coletor (usuário = '-') para FIXO e VARIÁVEL
  const collectorTotals = {
    boxes: { "CONGELADO": 0, "RESFRIADO": 0, Total: 0 },
    positions: { "CONGELADO": 0, "RESFRIADO": 0, Total: 0 },
    loads: { "CONGELADO": 0, "RESFRIADO": 0, Total: 0 }
  };

  // Faltantes calculados apenas para os separadores ativos (vazios)
  const missingSeparators = {
    boxes: { "CONGELADO": 0, "RESFRIADO": 0, Total: 0 },
    positions: { "CONGELADO": 0, "RESFRIADO": 0, Total: 0 },
    loads: { "CONGELADO": 0, "RESFRIADO": 0, Total: 0 }
  };

  const activeSeparators = new Map();

  data.forEach(row => {
    const temp = row['TEMPERATURA'];
    const tipoPeso = row['TIPO DO PESO'];
    const caixas = parseInt(row['CAIXAS']) || 0;
    const posicao = parseInt(row['POSIÇÃO']) || 0;
    const usuarioAlocacao = row['USUÁRIO DE ALOCAÇÃO'];
    const progress = parseFloat((row['PERCENTUAL'] || '0').replace(',', '.')) || 0;

    // Acumula totais do coletor (usuário = '-') para FIXO e VARIÁVEL
    if (usuarioAlocacao === '-' && (tipoPeso === 'FIXO' || tipoPeso === 'VARIÁVEL') && caixas > 0 && posicao > 0) {
      if (temp === 'CONGELADO' || temp === 'RESFRIADO') {
        collectorTotals.boxes[temp] += caixas;
        collectorTotals.positions[temp] += posicao;
      }
    }
    if (usuarioAlocacao === '-' && tipoPeso === 'FIXO' && caixas > 0 && posicao > 0) {
      collectorTotals.loads[temp === 'CONGELADO' || temp === 'RESFRIADO' ? temp : 'Total']++;
    }

    // Processa separadores ativos (com progresso < 100 e nome definido)
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
          caixasFaltando: Math.ceil(caixas * (100 - progress) / 100),
          posicoesFaltando: Math.ceil(posicao * (100 - progress) / 100),
          loads: (tipoPeso === 'FIXO' ? 1 : 0)
        });
        activeSeparators.get(key).loadsFaltando = Math.ceil(activeSeparators.get(key).loads * (100 - progress) / 100);
      } else {
        const existing = activeSeparators.get(key);
        existing.caixas += caixas;
        existing.posicao += posicao;
        existing.progresso = Math.max(existing.progresso, progress);
        existing.caixasFaltando = Math.ceil(existing.caixas * (100 - existing.progresso) / 100);
        existing.posicoesFaltando = Math.ceil(existing.posicao * (100 - existing.progresso) / 100);
        if (tipoPeso === 'FIXO') {
          existing.loads += 1;
        }
        existing.loadsFaltando = Math.ceil(existing.loads * (100 - existing.progresso) / 100);
      }
    }
  });

  // Soma dos faltantes dos separadores ativos
  activeSeparators.forEach(separator => {
    const temp = separator.camara;
    if (temp === 'CONGELADO' || temp === 'RESFRIADO') {
      missingSeparators.boxes[temp] += separator.caixasFaltando;
      missingSeparators.positions[temp] += separator.posicoesFaltando;
      missingSeparators.loads[temp] += separator.loadsFaltando;
    }
  });
  missingSeparators.boxes.Total = missingSeparators.boxes.CONGELADO + missingSeparators.boxes.RESFRIADO;
  missingSeparators.positions.Total = missingSeparators.positions.CONGELADO + missingSeparators.positions.RESFRIADO;
  missingSeparators.loads.Total = missingSeparators.loads.CONGELADO + missingSeparators.loads.RESFRIADO;

  // Totais do coletor
  collectorTotals.boxes.Total = collectorTotals.boxes.CONGELADO + collectorTotals.boxes.RESFRIADO;
  collectorTotals.positions.Total = collectorTotals.positions.CONGELADO + collectorTotals.positions.RESFRIADO;
  collectorTotals.loads.Total = collectorTotals.loads.CONGELADO + collectorTotals.loads.RESFRIADO;

  // Versão "incluindo coletor": para caixas e posições somamos os totais do coletor (sem desconto de progresso)
  const totalsIncludingCollector = {
    boxes: {
      CONGELADO: missingSeparators.boxes.CONGELADO + collectorTotals.boxes.CONGELADO,
      RESFRIADO: missingSeparators.boxes.RESFRIADO + collectorTotals.boxes.RESFRIADO
    },
    positions: {
      CONGELADO: missingSeparators.positions.CONGELADO + collectorTotals.positions.CONGELADO,
      RESFRIADO: missingSeparators.positions.RESFRIADO + collectorTotals.positions.RESFRIADO
    },
    loads: {
      CONGELADO: missingSeparators.loads.CONGELADO + collectorTotals.loads.CONGELADO,
      RESFRIADO: missingSeparators.loads.RESFRIADO + collectorTotals.loads.RESFRIADO
    }
  };
  totalsIncludingCollector.boxes.Total = totalsIncludingCollector.boxes.CONGELADO + totalsIncludingCollector.boxes.RESFRIADO;
  totalsIncludingCollector.positions.Total = totalsIncludingCollector.positions.CONGELADO + totalsIncludingCollector.positions.RESFRIADO;
  totalsIncludingCollector.loads.Total = totalsIncludingCollector.loads.CONGELADO + totalsIncludingCollector.loads.RESFRIADO;

  // Atualiza as tabelas de resumo:
  updateSummaryTable('summaryBoxes', missingSeparators.boxes);
  updateSummaryTable('summaryPositions', missingSeparators.positions);
  updateSummaryTable('summaryLoads', missingSeparators.loads);
  updateSummaryTable('summaryBoxesCollector', totalsIncludingCollector.boxes);
  updateSummaryTable('summaryPositionsCollector', totalsIncludingCollector.positions);
  updateSummaryTable('summaryLoadsCollector', totalsIncludingCollector.loads);

  const sortedSeparators = Array.from(activeSeparators.values()).sort((a, b) => b.progresso - a.progresso);
  updateActiveSeparators(sortedSeparators);
}

// Atualiza as tabelas de resumo gerais
function updateSummaryTable(elementId, data) {
  document.getElementById(elementId).innerHTML = `
    <tr><th>Temperatura</th><th>Quantidade</th></tr>
    <tr><td>CONGELADO</td><td>${data.CONGELADO}</td></tr>
    <tr><td>RESFRIADO</td><td>${data.RESFRIADO}</td></tr>
    <tr><td><strong>Total</strong></td><td><strong>${data.Total}</strong></td></tr>
  `;
}

function updateActiveSeparators(separators) {
  const tbody = document.getElementById('activeSeparatorsBody');
  tbody.innerHTML = separators.length > 0 ? 
    separators.map(sep => `
      <tr>
        <td>${sep.separador}</td>
        <td>${sep.caixas}</td>
        <td>${sep.caixasFaltando}</td>
        <td>${sep.posicao}</td>
        <td>${sep.oe}</td>
        <td>${sep.progresso}%</td>
        <td>${sep.camara}</td>
      </tr>
    `).join('') : 
    `<tr><td colspan="7">Nenhum separador ativo no momento</td></tr>`;

  const countCongelado = separators.filter(sep => sep.camara === 'CONGELADO').length;
  const countResfriado = separators.filter(sep => sep.camara === 'RESFRIADO').length;
  document.getElementById('separatorCount').innerHTML = 
    `<p>Separadores - CONGELADO: ${countCongelado}, RESFRIADO: ${countResfriado}</p>`;
}

// Atualiza a tabela da seção "TIPO DE CARGA"
// Agrupa por OE, GRUPO, TIPO DE OPERAÇÃO e TEMPERATURA,
// ordena por prioridade (ascendente) e aplica os destaques com base na diferença percentual da média.
function updateEmptyLoads(emptyLoads) {
  const tbody = document.querySelector('#emptyLoadsTable tbody');
  tbody.innerHTML = '';

  if(emptyLoads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhuma carga vazia encontrada</td></tr>';
    return;
  }

  // Agrupa cargas por OE, GRUPO, TIPO DE OPERAÇÃO e TEMPERATURA
  const grouped = {};
  emptyLoads.forEach(load => {
    const key = `${load.oe}|${load.grupo}|${load.tipoOperacao}|${load.temperatura}`;
    if(!grouped[key]) {
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
      // Mantém a menor prioridade do grupo
      grouped[key].prioridade = Math.min(grouped[key].prioridade, load.prioridade);
    }
  });
  
  let groups = Object.values(grouped);
  
  // Ordena os grupos por prioridade (ascendente)
  groups.sort((a, b) => a.prioridade - b.prioridade);
  
  // Calcula as médias de CAIXAS e POSIÇÃO entre os grupos
  const totalCaixas = groups.reduce((sum, g) => sum + g.caixas, 0);
  const totalPosicao = groups.reduce((sum, g) => sum + g.posicao, 0);
  const mediaCaixas = totalCaixas / groups.length;
  const mediaPosicao = totalPosicao / groups.length;
  
  groups.forEach(group => {
    // Para "Caixas": 
    // - se acima da média (muitas caixas) -> vermelho proporcional à % acima;
    // - se abaixo da média (poucas caixas) -> verde proporcional à % abaixo;
    // - se próximo, sem cor.
    let caixasStyle = '';
    if (group.caixas > mediaCaixas) {
      let diffPercent = (group.caixas - mediaCaixas) / mediaCaixas;      
      caixasStyle = `background: rgba(255,0,0,${Math.min(diffPercent, 1)})`;
    } else if (group.caixas < mediaCaixas) {
      let diffPercent = (mediaCaixas - group.caixas) / mediaCaixas;      
      caixasStyle = `background: rgba(0,255,0,${Math.min(diffPercent, 1)})`;
    }
    
    // Para "Posição": 
    // - se abaixo da média (poucas posições) -> verde proporcional à % abaixo;
    // - se acima da média (muitas posições) -> vermelho proporcional à % acima;
    // - se próximo, sem cor.
    let posicaoStyle = '';
    if (group.posicao < mediaPosicao) {
      let diffPercent = (mediaPosicao - group.posicao) / mediaPosicao;
      posicaoStyle = `background: rgba(0,255,0,${Math.min(diffPercent, 1)})`;
    } else if (group.posicao > mediaPosicao) {
      let diffPercent = (group.posicao - mediaPosicao) / mediaPosicao;
      posicaoStyle = `background: rgba(255,0,0,${Math.min(diffPercent, 1)})`;
    }
    
    // Prioridade: se menor que 10, destacar em verde
    let prioridadeStyle = '';
    if (group.prioridade < 10) {
      prioridadeStyle = 'color: green; font-weight: bold;';
    }
    
    tbody.innerHTML += `
      <tr>
        <td>
          ${group.oe} 
          <button onclick="copyToClipboard('${group.oe}')" title="Copiar OE" style="font-size:0.6rem; padding:0.2rem;">
            <i class="fas fa-copy"></i>
          </button>
        </td>
        <td style="${prioridadeStyle}">${group.prioridade}</td>
        <td>${group.tipoOperacao}</td>
        <td>${group.temperatura}</td>
        <td style="${caixasStyle}">${group.caixas}</td>
        <td style="${posicaoStyle}">${group.posicao}</td>
      </tr>
    `;
  });
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
  document.getElementById('summaryBoxesCollector').innerHTML = '';
  document.getElementById('summaryPositions').innerHTML = '';
  document.getElementById('summaryPositionsCollector').innerHTML = '';
  document.getElementById('summaryLoads').innerHTML = '';
  document.getElementById('summaryLoadsCollector').innerHTML = '';
  document.getElementById('separatorCount').innerHTML = '';
  document.getElementById('activeSeparatorsBody').innerHTML = '';
  document.querySelector('#emptyLoadsTable tbody').innerHTML = '';
}
