// Carregar dashboard salvo ao iniciar
document.addEventListener('DOMContentLoaded', () => {
  const savedDashboard = localStorage.getItem('dashboardHTML');
  if (savedDashboard) {
    document.getElementById('inputSection').style.display = 'none';
    const dashboard = document.getElementById('dashboard');
    dashboard.style.display = 'block';
    dashboard.querySelector('#resultado').innerHTML = savedDashboard;
    document.getElementById('exportarBtn').addEventListener('click', () => exportarRanking(JSON.parse(localStorage.getItem('rankingArray'))));
    document.getElementById('resetBtnDash').addEventListener('click', resetDados);
  }
});

// Funções auxiliares
function detectDelimiter(text) {
  if (text.includes("\t")) return "\t";
  const commaCount = (text.match(/,/g) || []).length;
  const semicolonCount = (text.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function parseCSV(text) {
  if (!text.trim()) return [];
  const delimiter = detectDelimiter(text);
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  if (!lines.length) return [];
  
  const headers = lines[0].split(delimiter).map(h => h.trim());
  return lines.slice(1).map(line => {
    const row = line.split(delimiter).map(item => item.trim());
    if (row.length !== headers.length) return null;
    return headers.reduce((obj, header, i) => ({ ...obj, [header]: row[i] }), {});
  }).filter(row => row !== null);
}

function processDataOld(data) {
  return data.map(record => {
    const separador = record["SEPARADOR"] || record["ID SEPARADOR"] || 'Desconhecido';
    const percentual = parseFloat((record["PERCENTUAL"] || "100").replace('%',''));
    const posicao = parseFloat(record["POSIÇÃO"] || '0');
    const visitas = Math.round(posicao * (percentual / 100));
    return { separador, visitas };
  });
}

function parseNumberBR(value) {
  if (!value) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

function processDataProduction(data) {
  return data.map(record => {
    let raw = record["SEPARADOR"] || record["ID SEPARADOR"] || 'Desconhecido';
    if (raw.includes("-")) {
      const parts = raw.split("-");
      raw = parts.slice(1).join("-").trim();
    }
    const separador = raw;
    const cargasSeparadas = parseFloat(record["QTD DE CARGAS"] || '0');
    const pesoSeparado = parseNumberBR(record["PESO SEPARADO"]);
    const caixasSeparadas = parseFloat(record["QTD SEP. CX"] || '0');
    return { separador, cargasSeparadas, pesoSeparado, caixasSeparadas, visitas: 0 };
  });
}

function getTextareaContent(id) {
  return document.getElementById(id).value;
}

function formatRank(index) {
  return `${index + 1}º`;
}

function calcularRanking() {
  const historicoText = getTextareaContent('historicoInput');
  const monitorText = getTextareaContent('monitorInput');
  const producaoText = getTextareaContent('producaoInput');

  let historicoData = [], monitorData = [], producaoData = [];
  
  try {
    historicoData = historicoText ? processDataOld(parseCSV(historicoText)) : [];
    monitorData = monitorText ? processDataOld(parseCSV(monitorText)) : [];
    producaoData = producaoText ? processDataProduction(parseCSV(producaoText)) : [];
  } catch (error) {
    alert(`Erro ao processar dados: ${error.message}`);
    return;
  }

  const consolidated = {};
  producaoData.forEach(item => {
    consolidated[item.separador] = {
      separador: item.separador,
      cargasSeparadas: item.cargasSeparadas,
      pesoSeparado: item.pesoSeparado,
      caixasSeparadas: item.caixasSeparadas,
      visitas: item.visitas
    };
  });
  
  [...historicoData, ...monitorData].forEach(item => {
    if (consolidated[item.separador]) {
      consolidated[item.separador].visitas += item.visitas;
    } else {
      consolidated[item.separador] = {
        separador: item.separador,
        cargasSeparadas: 0,
        pesoSeparado: 0,
        caixasSeparadas: 0,
        visitas: item.visitas
      };
    }
  });

  // Criar rankingArray ordenado por caixasSeparadas do maior para o menor
  let rankingArray = Object.values(consolidated).sort((a, b) => b.caixasSeparadas - a.caixasSeparadas);

  // Criar uma cópia para os cálculos dos cards
  const rankingArrayForCards = [...rankingArray];

  // Normalização para pontuação (0-100) para o destaque
  const maxVisitasVal = Math.max(...rankingArrayForCards.map(i => i.visitas), 1);
  const maxCaixasVal = Math.max(...rankingArrayForCards.map(i => i.caixasSeparadas), 1);
  const maxPesoVal = Math.max(...rankingArrayForCards.map(i => i.pesoSeparado), 1);
  const maxCargasVal = Math.max(...rankingArrayForCards.map(i => i.cargasSeparadas), 1);

  const destaqueArray = rankingArrayForCards.map(item => {
    const score = ((item.visitas / maxVisitasVal) * 40) + 
                  ((item.caixasSeparadas / maxCaixasVal) * 35) + 
                  ((item.pesoSeparado / maxPesoVal) * 15) + 
                  ((item.cargasSeparadas / maxCargasVal) * 10);
    return { ...item, score };
  }).sort((a, b) => b.score - a.score);

  const maxVisitas = rankingArrayForCards.reduce((max, curr) => curr.visitas > max.visitas ? curr : max, rankingArrayForCards[0] || {});
  const maxCaixas = rankingArrayForCards.reduce((max, curr) => curr.caixasSeparadas > max.caixasSeparadas ? curr : max, rankingArrayForCards[0] || {});
  const maxPeso = rankingArrayForCards.reduce((max, curr) => curr.pesoSeparado > max.pesoSeparado ? curr : max, rankingArrayForCards[0] || {});
  const destaque = destaqueArray[0];

  let dashboardHTML = `
    <div class="highlights">
      <div class="highlight-card" data-type="destaque">
        <i class="fas fa-star"></i>
        <h3>Separador Destaque</h3>
        <p>${destaque.separador}</p>
        <span>Pontuação: ${destaque.score.toFixed(2)}</span>
        <div class="tooltip">
          ${destaqueArray.slice(1, 5).map((item, idx) => `
            <p>${formatRank(idx + 1)}: ${item.separador} (${item.score.toFixed(2)})</p>
          `).join('')}
        </div>
      </div>
      <div class="highlight-card" data-type="visitas">
        <i class="fas fa-walking"></i>
        <h3>Mais Visitas</h3>
        <p>${maxVisitas.separador}</p>
        <span>${maxVisitas.visitas.toLocaleString('pt-BR')} visitas</span>
        <div class="tooltip">
          ${rankingArrayForCards.sort((a, b) => b.visitas - a.visitas).slice(1, 5).map((item, idx) => `
            <p>${formatRank(idx + 1)}: ${item.separador} (${item.visitas.toLocaleString('pt-BR')})</p>
          `).join('')}
        </div>
      </div>
      <div class="highlight-card" data-type="caixas">
        <i class="fas fa-box"></i>
        <h3>Mais Caixas</h3>
        <p>${maxCaixas.separador}</p>
        <span>${maxCaixas.caixasSeparadas.toLocaleString('pt-BR')} caixas</span>
        <div class="tooltip">
          ${rankingArrayForCards.sort((a, b) => b.caixasSeparadas - a.caixasSeparadas).slice(1, 5).map((item, idx) => `
            <p>${formatRank(idx + 1)}: ${item.separador} (${item.caixasSeparadas.toLocaleString('pt-BR')})</p>
          `).join('')}
        </div>
      </div>
      <div class="highlight-card" data-type="peso">
        <i class="fas fa-weight"></i>
        <h3>Mais Peso</h3>
        <p>${maxPeso.separador}</p>
        <span>${maxPeso.pesoSeparado.toLocaleString('pt-BR')} kg</span>
        <div class="tooltip">
          ${rankingArrayForCards.sort((a, b) => b.pesoSeparado - a.pesoSeparado).slice(1, 5).map((item, idx) => `
            <p>${formatRank(idx + 1)}: ${item.separador} (${item.pesoSeparado.toLocaleString('pt-BR')})</p>
          `).join('')}
        </div>
      </div>
    </div>
    <table class="modern-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Separador</th>
          <th>Cargas Separadas</th>
          <th>Peso Separado</th>
          <th>Visitas Picking</th>
          <th>Caixas Separadas</th>
        </tr>
      </thead>
      <tbody>`;

  // Usar rankingArray original, ordenado por caixasSeparadas
  rankingArray.forEach((item, index) => {
    const pesoMedioPorCaixa = item.caixasSeparadas > 0 ? (item.pesoSeparado / item.caixasSeparadas).toFixed(2) : 0;
    const caixasPorPicking = item.visitas > 0 ? (item.caixasSeparadas / item.visitas).toFixed(2) : 0;
    const caixasPorCarga = item.cargasSeparadas > 0 ? (item.caixasSeparadas / item.cargasSeparadas).toFixed(2) : 0;

    dashboardHTML += `
      <tr>
        <td>${formatRank(index)}</td>
        <td class="separador-cell" data-index="${index}">
          ${item.separador}
          <div class="stats-tooltip">
            <h4>Estatísticas de ${item.separador}</h4>
            <p><span class="stat-label">Peso Médio por Caixa:</span> ${pesoMedioPorCaixa} kg</p>
            <p><span class="stat-label">Caixas por Picking:</span> ${caixasPorPicking}</p>
            <p><span class="stat-label">Caixas por Carga:</span> ${caixasPorCarga}</p>
          </div>
        </td>
        <td>${item.cargasSeparadas.toLocaleString('pt-BR')}</td>
        <td>${item.pesoSeparado.toLocaleString('pt-BR')}</td>
        <td>${item.visitas.toLocaleString('pt-BR')}</td>
        <td>${item.caixasSeparadas.toLocaleString('pt-BR')}</td>
      </tr>`;
  });

  dashboardHTML += `</tbody></table>`;

  document.getElementById('inputSection').style.display = 'none';
  const dashboard = document.getElementById('dashboard');
  dashboard.style.display = 'block';
  dashboard.querySelector('#resultado').innerHTML = dashboardHTML;
  
  localStorage.setItem('dashboardHTML', dashboardHTML);
  localStorage.setItem('rankingArray', JSON.stringify(rankingArray));

  document.getElementById('exportarBtn').addEventListener('click', () => exportarRanking(rankingArray));
  document.getElementById('resetBtnDash').addEventListener('click', resetDados);
}

function exportarRanking(rankingArray) {
  const date = new Date();
  const fileName = `RANKING_PRODUTIVIDADE_${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}.csv`;

  const bom = '\uFEFF';
  let csv = `${bom};;;${new Date().toLocaleString('pt-BR').toUpperCase()}\n;PRODUTIVIDADE;;\n`;
  csv += "RANK;SEPARADOR;CARGAS SEPARADAS;PESO SEPARADO;VISITAS PICKING;CAIXAS SEPARADAS\n";
  csv += rankingArray.map((item, index) => 
    `${formatRank(index)};${item.separador.toUpperCase()};${item.cargasSeparadas};${item.pesoSeparado};${item.visitas};${item.caixasSeparadas}`
  ).join('\n');

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}

function resetDados() {
  ['historicoInput', 'monitorInput', 'producaoInput'].forEach(id => {
    document.getElementById(id).value = "";
  });
  localStorage.removeItem('dashboardHTML');
  localStorage.removeItem('rankingArray');
  document.getElementById('inputSection').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
}

document.getElementById('calcularBtn').addEventListener('click', calcularRanking);