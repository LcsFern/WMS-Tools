/*****************************************************
 * script.js - Versão Completa Atualizada
 *****************************************************/

// Função detectDelimiter mantida original
function detectDelimiter(text) {
  if (text.includes("\t")) return "\t";
  const commaCount = (text.match(/,/g) || []).length;
  const semicolonCount = (text.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

// Função parseCSV mantida original
function parseCSV(text) {
  const delimiter = detectDelimiter(text);
  const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
  if (lines.length === 0) return [];
  const headers = lines[0].split(delimiter).map(h => h.trim());
  return lines.slice(1).reduce((acc, line, index) => {
    const row = line.split(delimiter).map(item => item.trim());
    if (row.length !== headers.length) return acc;
    acc.push(headers.reduce((obj, header, i) => ({...obj, [header]: row[i]}), {}));
    return acc;
  }, []);
}

// Função processData mantida original
function processData(data) {
  return data.map(record => {
    const separador = record["SEPARADOR"] || record["ID SEPARADOR"] || 'Desconhecido';
    const caixasOriginal = parseFloat(record["CAIXAS"] || '0');
    const percentual = parseFloat((record["PERCENTUAL"] || "100").replace('%',''));
    const caixasEfetivas = percentual < 100 
      ? Math.round(caixasOriginal * (percentual / 100)) 
      : Math.round(caixasOriginal);
    return {
      separador,
      caixasEfetivas,
      visitas: percentual < 100 ? 0 : Math.round(parseFloat(record["POSIÇÃO"] || '0'))
    };
  });
}

// Função calcularRanking com melhorias visuais
function calcularRanking() {
  const historicoText = document.getElementById('historicoInput').value;
  const monitorText = document.getElementById('monitorInput').value;
  
  let historicoData = [], monitorData = [];
  
  try {
    if (historicoText.trim()) historicoData = processData(parseCSV(historicoText));
    if (monitorText.trim()) monitorData = processData(parseCSV(monitorText));
  } catch (error) {
    alert(`Erro ao processar dados: ${error.message}`);
    return;
  }

  const consolidated = [...historicoData, ...monitorData].reduce((acc, item) => {
    acc[item.separador] = acc[item.separador] || {separador: item.separador, caixasEfetivas: 0, visitas: 0};
    acc[item.separador].caixasEfetivas += item.caixasEfetivas;
    acc[item.separador].visitas += item.visitas;
    return acc;
  }, {});

  const rankingArray = Object.values(consolidated).sort((a, b) => b.caixasEfetivas - a.caixasEfetivas);

  // ========== MELHORIAS VISUAIS AQUI ==========
  let html = `
    <div style="text-align: right;">
      <button id="exportarBtn" class="export-btn">
        📊 Exportar para Excel
      </button>
    </div>
    <table class="modern-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Separador</th>
          <th>Visitas Picking</th>
          <th>Caixas Separadas</th>
        </tr>
      </thead>
      <tbody>`;

  rankingArray.forEach((item, index) => {
    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${item.separador}</td>
        <td>${item.visitas.toLocaleString('pt-BR')}</td>
        <td>${item.caixasEfetivas.toLocaleString('pt-BR')}</td>
      </tr>`;
  });

  html += `</tbody></table>`;
  
  document.getElementById('resultado').innerHTML = html;
  
  // Configurar evento de exportação
  document.getElementById('exportarBtn').addEventListener('click', exportarRanking);
}

// Função exportarRanking atualizada
function exportarRanking() {
  const tabela = document.querySelector("#resultado table");
  if (!tabela) {
    alert("Calcule o ranking primeiro!");
    return;
  }

  // Gerar nome do arquivo com data
  const date = new Date();
  const fileName = `Ranking_Produtividade_${
    date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${
    date.getDate().toString().padStart(2,'0')}.csv`;

  // Gerar conteúdo CSV
  let csv = `;;;${new Date().toLocaleString('pt-BR')}\n;PRODUTIVIDADE;;\n`;
  csv += Array.from(tabela.rows).map(row => 
    Array.from(row.cells).map(cell => cell.innerText).join(';')
  ).join('\n').toUpperCase();

  // Criar e disparar download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}

// Event listener original mantido
document.getElementById('calcularBtn').addEventListener('click', calcularRanking);