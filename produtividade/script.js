 // Função para detectar o delimitador (vírgula, ponto-e-vírgula ou tab)
 function detectDelimiter(text) {
  if (text.includes("\t")) return "\t";
  const commaCount = (text.match(/,/g) || []).length;
  const semicolonCount = (text.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

// Função para converter CSV em array de objetos
function parseCSV(text) {
  const delimiter = detectDelimiter(text);
  const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
  if (lines.length === 0) return [];
  const headers = lines[0].split(delimiter).map(h => h.trim());
  return lines.slice(1).reduce((acc, line) => {
    const row = line.split(delimiter).map(item => item.trim());
    if (row.length !== headers.length) return acc;
    acc.push(headers.reduce((obj, header, i) => ({ ...obj, [header]: row[i] }), {}));
    return acc;
  }, []);
}

// Processa dados dos arquivos Histórico e Monitor (apenas para visitas)
function processDataOld(data) {
  return data.map(record => {
    const separador = record["SEPARADOR"] || record["ID SEPARADOR"] || 'Desconhecido';
    const percentual = parseFloat((record["PERCENTUAL"] || "100").replace('%',''));
    const posicao = parseFloat(record["POSIÇÃO"] || '0');
    const visitas = Math.round(posicao * (percentual / 100));
    return { separador, visitas };
  });
}

// Converte número no formato BR (ponto milhar, vírgula decimal)
function parseNumberBR(value) {
  if (!value) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

// Processa os dados do arquivo de Produção, removendo o ID numérico do separador
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
    return {
      separador,
      cargasSeparadas,
      pesoSeparado,
      caixasSeparadas,
      visitas: 0
    };
  });
}

// Ao perder o foco, se houver conteúdo, guarda-o e substitui a exibição
function handleBlurTextarea(e) {
  if (e.target.value.trim() !== "") {
    e.target.dataset.original = e.target.value;
    e.target.value = "Conteúdo carregado";
    e.target.readOnly = true;
  }
}

// Antes de processar, recupera o conteúdo real armazenado
function getTextareaContent(id) {
  const textarea = document.getElementById(id);
  return textarea.dataset.original || textarea.value;
}

// Configura os eventos para cada textarea
document.getElementById('historicoInput').addEventListener('blur', handleBlurTextarea);
document.getElementById('monitorInput').addEventListener('blur', handleBlurTextarea);
document.getElementById('producaoInput').addEventListener('blur', handleBlurTextarea);

// Função principal para calcular o ranking combinando os 3 arquivos
function calcularRanking() {
  // Recupera o conteúdo real dos textareas
  const historicoText = getTextareaContent('historicoInput');
  const monitorText = getTextareaContent('monitorInput');
  const producaoText = getTextareaContent('producaoInput');
  
  let historicoData = [], monitorData = [], producaoData = [];
  
  try {
    if (historicoText.trim()) {
      historicoData = processDataOld(parseCSV(historicoText));
    }
    if (monitorText.trim()) {
      monitorData = processDataOld(parseCSV(monitorText));
    }
    if (producaoText.trim()) {
      producaoData = processDataProduction(parseCSV(producaoText));
    }
  } catch (error) {
    alert(`Erro ao processar dados: ${error.message}`);
    return;
  }
  
  // Consolida os dados: usa os dados de produção como base e soma as visitas dos arquivos antigos
  const consolidated = {};
  
  producaoData.forEach(item => {
    consolidated[item.separador] = { ...item };
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
  
  // Ordena o ranking priorizando "caixasSeparadas" (descendente)
  const rankingArray = Object.values(consolidated).sort((a, b) => {
    if (b.caixasSeparadas !== a.caixasSeparadas) {
      return b.caixasSeparadas - a.caixasSeparadas;
    }
    if (b.cargasSeparadas !== a.cargasSeparadas) {
      return b.cargasSeparadas - a.cargasSeparadas;
    }
    if (b.pesoSeparado !== a.pesoSeparado) {
      return b.pesoSeparado - a.pesoSeparado;
    }
    return b.visitas - a.visitas;
  });
  
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
          <th>Cargas Separadas</th>
          <th>Peso Separado</th>
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
        <td>${item.cargasSeparadas.toLocaleString('pt-BR')}</td>
        <td>${item.pesoSeparado.toLocaleString('pt-BR')}</td>
        <td>${item.visitas.toLocaleString('pt-BR')}</td>
        <td>${item.caixasSeparadas.toLocaleString('pt-BR')}</td>
      </tr>`;
  });
  
  html += `</tbody></table>`;
  
  document.getElementById('resultado').innerHTML = html;
  document.getElementById('exportarBtn').addEventListener('click', exportarRanking);
}

function exportarRanking() {
  const tabela = document.querySelector("#resultado table");
  if (!tabela) {
    alert("Calcule o ranking primeiro!");
    return;
  }
  
  const date = new Date();
  const fileName = `Ranking_Produtividade_${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}.csv`;
  
  let csv = `;;;${new Date().toLocaleString('pt-BR')}\n;PRODUTIVIDADE;;\n`;
  csv += Array.from(tabela.rows).map(row => 
    Array.from(row.cells).map(cell => cell.innerText).join(';')
  ).join('\n').toUpperCase();
  
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}

document.getElementById('calcularBtn').addEventListener('click', calcularRanking);