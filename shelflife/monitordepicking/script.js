document.getElementById('csvFile').addEventListener('change', uploadLocalFile);
document.getElementById('importContentBtn').addEventListener('click', importCSVFromContent);

function uploadLocalFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    processCSVData(e.target.result);
    document.getElementById('results').style.display = 'block';
  }
  reader.readAsText(file);
}

function importCSVFromContent() {
  const content = document.getElementById('csvContent').value.trim();
  if (!content) return alert("Por favor, cole o conteúdo do CSV.");
  processCSVData(content);
  document.getElementById('results').style.display = 'block';
}

function processCSVData(csvData) {
  const rows = csvData.split('\n').filter(row => row.trim() !== '');
  if (rows.length === 0) return;
  
  const delimiter = detectDelimiter(rows[0]);
  const headers = rows[0].split(delimiter).map(h => h.trim());
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].split(delimiter);
    if (values.length === headers.length) {
      const rowObject = {};
      headers.forEach((header, index) => {
        rowObject[header] = values[index]?.trim() || '';
      });
      data.push(rowObject);
    }
  }

  processData(data);
}

function detectDelimiter(firstRow) {
  if (firstRow.includes('\t')) return '\t';
  if (firstRow.includes(';')) return ';';
  return ',';
}

function processData(data) {
  const totals = {
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

    if (usuarioAlocacao === '-' && (tipoPeso === 'FIXO' || tipoPeso === 'VARIÁVEL') && caixas > 0 && posicao > 0) {
      if (temp === 'CONGELADO' || temp === 'RESFRIADO') {
        totals.boxes[temp] += caixas;
        totals.positions[temp] += posicao;
      }
    }

    if (usuarioAlocacao === '-' && tipoPeso === 'FIXO' && caixas > 0 && posicao > 0) {
      totals.loads[temp === 'CONGELADO' || temp === 'RESFRIADO' ? temp : 'Total']++;
    }

    if (progress < 100 && row['SEPARADOR']?.trim()) {
      const oe = row['OE / VIAGEM']?.trim() || 'N/A';
      const key = `${row['SEPARADOR']}|${temp}|${oe}`;
      
      if (!activeSeparators.has(key)) {
        activeSeparators.set(key, {
          separador: row['SEPARADOR'],
          camara: temp || 'N/A',
          oe: oe,
          caixas: caixas,
          posicao: posicao,
          progresso: progress.toFixed(1),
          caixasFaltando: Math.ceil(caixas * (100 - progress) / 100),
          posicoesFaltando: Math.ceil(posicao * (100 - progress) / 100)
        });
      } else {
        const existing = activeSeparators.get(key);
        existing.caixas += caixas;
        existing.posicao += posicao;
        existing.progresso = Math.max(existing.progresso, progress).toFixed(1);
        existing.caixasFaltando = Math.ceil(existing.caixas * (100 - existing.progresso) / 100);
        existing.posicoesFaltando = Math.ceil(existing.posicao * (100 - existing.progresso) / 100);
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