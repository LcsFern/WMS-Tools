/**
 * Converte um valor de peso em string para float.
 * Remove pontos de milhar e substitui a vírgula decimal por ponto.
 */
function parsePeso(valor) {
  return parseFloat(
    valor.toString().replace(/[\.]/g, '').replace(/[,]/g, '.')
  );
}

/**
 * Normaliza um cabeçalho removendo quebras de linha e espaços extras.
 */
function normalizeHeader(header) {
  return header.replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Processa os dados da grade colada no textarea.
 *
 * 1. Normaliza os cabeçalhos para identificar corretamente as colunas.
 * 2. Calcula os totais:
 *    - TOTAL DE VEÍCULOS: contagem única baseada na "PLACA ROTEIRIZADA".
 *    - PESO TOTAL GERAL: soma dos valores da coluna identificada (priorizando "PESO TOTAL", 
 *      se não encontrado, utiliza "PESO RE-ENTREGA", e se ainda não, "PESO ENTREGAS").
 *    - TOTAL DE CAIXAS: soma dos valores da coluna "QTDE CXS".
 * 3. Conta o tipo de carro a partir da coluna "QTD PALLETS" (usando o primeiro token).
 * 4. Salva toda a grade no localStorage para uso futuro.
 * 5. Atualiza a interface, ocultando a área de colagem e mostrando os resultados com o botão de reset.
 */
function processarGrade() {
  const rawData = document.getElementById('excelData').value.trim();
  if (!rawData) return;

  const linhas = rawData.split('\n');
  if (linhas.length < 2) return; // Verifica se há dados além do cabeçalho

  // Extrai e normaliza os cabeçalhos
  const headersOriginais = linhas[0].split('\t');
  const headers = headersOriginais.map(h => h.replace(/\s+/g, ' ').trim());
  const headersNorm = headers.map(normalizeHeader);

  // Determina o índice para a coluna de PESO
  let indexPeso = headersNorm.findIndex(h => h === "PESO TOTAL");
  if (indexPeso === -1) {
    indexPeso = headersNorm.findIndex(h => h.includes("PESO RE-ENTREGA"));
  }
  if (indexPeso === -1) {
    indexPeso = headersNorm.findIndex(h => h.includes("PESO ENTREGAS"));
  }
  if (indexPeso === -1) indexPeso = null;

  // Índice para "PLACA ROTEIRIZADA", "QTDE CXS" e "QTD PALLETS"
  const indexPlaca = headersNorm.findIndex(h => h === "PLACA ROTEIRIZADA");
  const indexQtdeCxs = headersNorm.findIndex(h => h === "QTDE CXS");
  const indexQtdPallets = headersNorm.findIndex(h => h === "QTD PALLETS");

  // Variáveis para os totais e contagens
  const veiculosUnicos = new Set();
  let totalCaixas = 0;
  let pesoTotal = 0;
  let batidos = 0, paletizados = 0, graduados = 0;

  // Array para armazenar todos os registros
  const gradeCompleta = [];

  // Processa cada linha de dados
  for (let i = 1; i < linhas.length; i++) {
    const partes = linhas[i].split('\t');
    if (partes.length < headers.length) continue; // ignora linhas incompletas

    // Cria objeto registro mapeando cada coluna
    const registro = {};
    headers.forEach((chave, index) => {
      registro[chave] = partes[index]?.trim() || "";
    });
    gradeCompleta.push(registro);

    // Processa apenas veículos únicos, baseando-se na "PLACA ROTEIRIZADA"
    const placa = registro[headers[indexPlaca]];
    if (placa && !veiculosUnicos.has(placa)) {
      veiculosUnicos.add(placa);
      
      totalCaixas += parseInt(registro[headers[indexQtdeCxs]]) || 0;
      if (indexPeso !== null) {
        pesoTotal += parsePeso(registro[headers[indexPeso]] || '0');
      }

      // Processa a coluna "QTD PALLETS" para identificar o tipo de carro
      const qtdPallets = registro[headers[indexQtdPallets]];
      if (qtdPallets && qtdPallets !== "0") {
        // Divide a string por "/" e pega o primeiro token
        const primeiroToken = qtdPallets.split('/')[0].trim();
        let tipo = primeiroToken;
        if (primeiroToken.includes('-')) {
          tipo = primeiroToken.split('-')[0].trim();
        }
        tipo = tipo.toUpperCase();
        if (tipo === "B") {
          batidos++;
        } else if (tipo === "P") {
          paletizados++;
        } else if (tipo === "G") {
          graduados++;
        }
      }
    }
  }

  // Salva todos os dados da grade no localStorage para uso futuro
  localStorage.setItem("gradeCompleta", JSON.stringify(gradeCompleta));

  // Atualiza os totais na interface
  document.getElementById('totalVeiculos').textContent = veiculosUnicos.size;
  document.getElementById('pesoTotal').textContent = pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  document.getElementById('totalCaixas').textContent = totalCaixas;
  document.getElementById('batidos').textContent = batidos;
  document.getElementById('paletizados').textContent = paletizados;
  document.getElementById('graduados').textContent = graduados;

  // Exibe a seção de resultados e o botão de reset; oculta a área de colagem
  document.getElementById('gradeSection').classList.add('hidden');
  document.getElementById('gradeInfo').classList.remove('hidden');
  document.getElementById('resetBtn').classList.remove('hidden');
}

/**
 * Carrega a grade salva no localStorage (se houver) e atualiza a interface.
 * Essa função é chamada no onload para que a grade não seja resetada automaticamente.
 */
function loadGradeFromCache() {
  const gradeRaw = localStorage.getItem("gradeCompleta");
  if (!gradeRaw) return;
  
  const gradeCompleta = JSON.parse(gradeRaw);
  
  // Variáveis para recalcular os totais
  const veiculosUnicos = new Set();
  let totalCaixas = 0;
  let pesoTotal = 0;
  let batidos = 0, paletizados = 0, graduados = 0;
  
  // Recalcula os totais a partir dos dados salvos
  gradeCompleta.forEach(registro => {
    const placa = registro["PLACA ROTEIRIZADA"];
    if (placa && !veiculosUnicos.has(placa)) {
      veiculosUnicos.add(placa);
      
      totalCaixas += parseInt(registro["QTDE CXS"]) || 0;
      
      // Tenta usar "PESO TOTAL", se não, "PESO RE-ENTREGA", se não, "PESO ENTREGAS"
      let pesoStr = registro["PESO TOTAL"] || registro["PESO RE-ENTREGA"] || registro["PESO ENTREGAS"] || '0';
      pesoTotal += parsePeso(pesoStr);
      
      const qtdPallets = registro["QTD PALLETS"];
      if (qtdPallets && qtdPallets !== "0") {
        const primeiroToken = qtdPallets.split('/')[0].trim();
        let tipo = primeiroToken;
        if (primeiroToken.includes('-')) {
          tipo = primeiroToken.split('-')[0].trim();
        }
        tipo = tipo.toUpperCase();
        if (tipo === "B") {
          batidos++;
        } else if (tipo === "P") {
          paletizados++;
        } else if (tipo === "G") {
          graduados++;
        }
      }
    }
  });
  
  // Atualiza a interface com os totais calculados
  document.getElementById('totalVeiculos').textContent = veiculosUnicos.size;
  document.getElementById('pesoTotal').textContent = pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  document.getElementById('totalCaixas').textContent = totalCaixas;
  document.getElementById('batidos').textContent = batidos;
  document.getElementById('paletizados').textContent = paletizados;
  document.getElementById('graduados').textContent = graduados;
  
  // Exibe a interface dos resultados
  document.getElementById('gradeSection').classList.add('hidden');
  document.getElementById('gradeInfo').classList.remove('hidden');
  document.getElementById('resetBtn').classList.remove('hidden');
}

/**
 * Reseta a grade, limpando os dados salvos e restaurando a interface.
 */
function resetGrade() {
  localStorage.removeItem("gradeCompleta");
  document.getElementById('excelData').value = '';
  document.getElementById('gradeSection').classList.remove('hidden');
  document.getElementById('gradeInfo').classList.add('hidden');
  document.getElementById('resetBtn').classList.add('hidden');
}

// Processa a grade automaticamente quando os dados são colados no textarea
document.getElementById('excelData').addEventListener('paste', (e) => {
  setTimeout(() => {
    processarGrade();
    // Se preferir manter o conteúdo no textarea, descomente a linha abaixo:
    // document.getElementById('excelData').value = '';
  }, 100);
});

// Carrega a grade do cache ao iniciar a página (se existir)
window.onload = loadGradeFromCache;
