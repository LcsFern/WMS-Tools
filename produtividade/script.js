/*****************************************************
 * Função detectDelimiter:
 * - Recebe o texto do CSV.
 * - Se o texto contém tabulação ("\t"), retorna "\t" como delimitador.
 * - Caso contrário, conta quantas vírgulas e ponto-e-vírgulas existem.
 * - Retorna ';' se houver mais ponto-e-vírgulas; caso contrário, retorna ','.
 *****************************************************/
function detectDelimiter(text) {
  if (text.includes("\t")) {
    return "\t";
  }
  const commaCount = (text.match(/,/g) || []).length;
  const semicolonCount = (text.match(/;/g) || []).length;
  return (semicolonCount > commaCount) ? ';' : ',';
}

/*****************************************************
 * Função parseCSV:
 * - Converte o texto do CSV em um array de objetos.
 * - Utiliza a primeira linha como cabeçalho.
 * - Ignora linhas que não possuem o mesmo número de colunas do cabeçalho.
 *****************************************************/
function parseCSV(text) {
  const delimiter = detectDelimiter(text);
  const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
  if (lines.length === 0) {
    console.error("Nenhuma linha encontrada no CSV.");
    return [];
  }
  const headers = lines[0].split(delimiter).map(h => h.trim());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map(item => item.trim());
    if (row.length !== headers.length) {
      console.warn(`Linha ${i+1} ignorada. Número de colunas diferente do cabeçalho.`);
      continue;
    }
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    data.push(obj);
  }
  return data;
}

/*****************************************************
 * Função processData:
 * - Processa os dados do CSV para extrair os campos relevantes.
 * - Espera os campos: "SEPARADOR" (ou "ID SEPARADOR"), "CAIXAS", "POSIÇÃO" e "PERCENTUAL".
 * - Converte os valores para números.
 * - Se o percentual for menor que 100, ajusta as caixas (multiplica pelo percentual/100) e zera as visitas.
 * - Arredonda os valores para inteiros.
 * - Retorna um array de objetos contendo: separador, caixasEfetivas e visitas.
 *****************************************************/
function processData(data) {
  const result = [];
  data.forEach(record => {
    const separador = record["SEPARADOR"] || record["ID SEPARADOR"] || 'Desconhecido';
    const caixasOriginal = parseFloat(record["CAIXAS"] || '0');
    let visitasOriginal = parseFloat(record["POSIÇÃO"] || '0');
    let percentualStr = record["PERCENTUAL"] || "100";
    let percentual = 100;
    
    if (percentualStr.includes('%')) {
      percentual = parseFloat(percentualStr.replace('%', '').trim());
    } else {
      percentual = parseFloat(percentualStr);
    }
    
    // Se o percentual for menor que 100, ajusta as caixas e zera as visitas
    const caixasEfetivas = (percentual < 100) ? Math.round(caixasOriginal * (percentual / 100)) : Math.round(caixasOriginal);
    if (percentual < 100) {
      visitasOriginal = 0;
    } else {
      visitasOriginal = Math.round(visitasOriginal);
    }
    
    result.push({
      separador: separador,
      caixasEfetivas: caixasEfetivas, // Valor usado para o ranking (ordenado por caixas)
      visitas: visitasOriginal        // Visitas só são consideradas se a carga estiver em 100%
    });
  });
  return result;
}

/*****************************************************
 * Função calcularRanking:
 * - Lê os dados dos elementos "historicoInput" e "monitorInput".
 * - Converte os textos para arrays de objetos com parseCSV.
 * - Se nenhum dado for encontrado, exibe um alerta.
 * - Processa os dados com processData para ajustar as caixas e visitas.
 * - Consolida os dados agrupando por separador (somando caixasEfetivas e visitas).
 * - Ordena o ranking em ordem decrescente com base nas caixasEfetivas.
 * - Monta uma tabela HTML com as colunas: Rank, Separador, Visitas e Caixas.
 * - Adiciona um botão "Exportar para Excel" acima da tabela.
 * - Insere a tabela gerada no elemento com id "resultado".
 *****************************************************/
function calcularRanking() {
  const historicoText = document.getElementById('historicoInput').value;
  const monitorText = document.getElementById('monitorInput').value;
  
  let historicoData = [];
  let monitorData = [];
  
  if (historicoText.trim() !== '') {
    historicoData = parseCSV(historicoText);
    if (historicoData.length === 0) {
      alert("Não foi possível ler dados do arquivo Histórico MP. Verifique o formato do CSV.");
      return;
    }
  }
  if (monitorText.trim() !== '') {
    monitorData = parseCSV(monitorText);
    if (monitorData.length === 0) {
      alert("Não foi possível ler dados do arquivo Monitor Picking. Verifique o formato do CSV.");
      return;
    }
  }
  if (historicoData.length === 0 && monitorData.length === 0) {
    alert("Por favor, insira os dados em pelo menos um dos campos.");
    return;
  }
  
  const processedHistorico = processData(historicoData);
  const processedMonitor = processData(monitorData);
  
  // Consolida os dados agrupando por separador (soma das caixasEfetivas e visitas)
  const rankingMap = {};
  [...processedHistorico, ...processedMonitor].forEach(item => {
    const key = item.separador;
    if (!rankingMap[key]) {
      rankingMap[key] = { separador: key, caixasEfetivas: 0, visitas: 0 };
    }
    rankingMap[key].caixasEfetivas += item.caixasEfetivas;
    rankingMap[key].visitas += item.visitas;
  });
  
  // Converte o objeto para array e ordena pelo número de caixasEfetivas (ranking por caixas)
  const rankingArray = Object.values(rankingMap);
  rankingArray.sort((a, b) => b.caixasEfetivas - a.caixasEfetivas);
  
  if (rankingArray.length === 0) {
    document.getElementById('resultado').innerHTML = "<p class='alert'>Nenhum dado disponível para exibir o ranking.</p>";
    return;
  }
  
  // Monta a tabela HTML com as colunas: Rank, Separador, Visitas e Caixas
  let html = '<table>';
  html += '<thead><tr><th>Rank</th><th>Separador</th><th>Visitas</th><th>Caixas Separadas</th></tr></thead><tbody>';
  rankingArray.forEach((item, index) => {
    html += '<tr>';
    html += `<td>${index + 1}</td>`;
    html += `<td>${item.separador}</td>`;
    html += `<td>${item.visitas}</td>`;
    html += `<td>${item.caixasEfetivas}</td>`;
    html += '</tr>';
  });
  html += '</tbody></table>';
  
  // Adiciona o botão de exportar acima da tabela
  html = '<button id="exportarBtn">Organizar no Excel</button>' + html;
  document.getElementById('resultado').innerHTML = html;
  
  // Associa o evento de clique ao botão de exportar
  document.getElementById('exportarBtn').addEventListener('click', exportarRanking);
}

/*****************************************************
 * Função exportarRanking:
 * - Seleciona a tabela gerada na página.
 * - Cria duas linhas adicionais no início do CSV:
 *     * A primeira linha possui o DATA e HORA ATUAL no canto direito.
 *     * A segunda linha possui o título "PRODUTIVIDADE" (simulado como centralizado).
 * - Converte a tabela para um texto CSV usando ponto-e-vírgula (;) como delimitador.
 * - Converte todo o conteúdo CSV para letras maiúsculas.
 * - Cria um blob e gera um link para download do arquivo CSV.
 *****************************************************/
function exportarRanking() {
  const tabela = document.querySelector("#resultado table");
  if (!tabela) {
    alert("Não há dados para exportar. Calcule o ranking primeiro.");
    return;
  }
  
  // Obtém a data e hora atual e formata como DD/MM/AAAA HH:MM:SS
  const now = new Date();
  const dia = String(now.getDate()).padStart(2, '0');
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const ano = now.getFullYear();
  const horas = String(now.getHours()).padStart(2, '0');
  const minutos = String(now.getMinutes()).padStart(2, '0');
  const segundos = String(now.getSeconds()).padStart(2, '0');
  const dataHora = `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
  
  let csv = "";
  
  // Linha 1: Data e Hora atual no canto direito (para 4 colunas, as três primeiras vazias)
  csv += ";;;" + dataHora + "\n";
  // Linha 2: Título PRODUTIVIDADE centralizado (deixando a primeira coluna vazia, o título na segunda, as demais vazias)
  csv += ";PRODUTIVIDADE;;\n";
  // Linha 3: Cabeçalho da tabela
  const headers = Array.from(tabela.querySelectorAll("thead th")).map(th => th.innerText);
  csv += headers.join(";") + "\n";
  // Linha 4 em diante: Conteúdo das linhas da tabela
  const rows = tabela.querySelectorAll("tbody tr");
  rows.forEach(row => {
    const cols = Array.from(row.querySelectorAll("td")).map(td => td.innerText);
    csv += cols.join(";") + "\n";
  });
  
  // Converte todo o CSV para letras maiúsculas
  csv = csv.toUpperCase();
  
  // Cria um blob e gera um link para download do arquivo CSV
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "RANKING_PRODUTIVIDADE.CSV";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Associa o evento de clique do botão "Calcular Ranking" à função calcularRanking
document.getElementById('calcularBtn').addEventListener('click', calcularRanking);
