// Variáveis globais para armazenar os dados e mapeamentos da grade
let dadosGrade = [];              // Array que armazena os dados processados da grade
let placaToOE = new Map();          // Mapeia cada placa à sua OE correspondente
let placaAntigaMap = new Map();     // Mapeia a placa original para a placa modificada (caso haja atualização)
let gradeOriginal = [];             // Armazena uma cópia da grade original processada para possibilitar reset

/**
 * Converte um valor de peso em string para float.
 * Remove pontos de milhar e substitui a vírgula decimal por ponto.
 *
 * @param {any} valor - O valor a ser convertido.
 * @returns {number} Peso convertido para float.
 */
function parsePeso(valor) {
  return parseFloat(
    valor.toString().replace(/[\.]/g, '').replace(/[,]/g, '.')
  );
}

/**
 * Salva o estado atual da grade no localStorage.
 * Os Sets são convertidos para Arrays para garantir a serialização correta.
 */
function salvarEstado() {
  localStorage.setItem(
    'gradeExpedicao',
    JSON.stringify({
      dadosGrade: dadosGrade.map(oe => ({ ...oe, PLACAS: [...oe.PLACAS] })),
      placaMap: [...placaToOE],
      placaAntigaMap: [...placaAntigaMap],
      gradeOriginal: gradeOriginal.map(oe => ({ ...oe, PLACAS: [...oe.PLACAS] }))
    })
  );
}

/**
 * Carrega a grade salva no localStorage e atualiza os elementos do DOM.
 * Converte arrays salvos de volta para Sets e Maps.
 * Caso ocorra algum erro na leitura do cache, executa resetTudo().
 */
function carregarGradeCache() {
  const cache = localStorage.getItem('gradeExpedicao');
  if (cache) {
    try {
      const { dadosGrade: dg, placaMap, placaAntigaMap: pam, gradeOriginal: go } = JSON.parse(cache);
      // Converte arrays de placas de volta para Set
      dadosGrade = dg.map(oe => ({
        ...oe,
        PLACAS: new Set(oe.PLACAS)
      }));
      gradeOriginal = go.map(oe => ({
        ...oe,
        PLACAS: new Set(oe.PLACAS)
      }));
      placaToOE = new Map(placaMap);
      placaAntigaMap = new Map(pam);

      // Atualiza a visibilidade dos elementos da interface
      document.getElementById('gradeSection').classList.add('hidden');
      document.getElementById('csvSection').classList.remove('hidden');
      document.getElementById('resetBtn').classList.remove('hidden');
      document.getElementById('resetCsvBtn').classList.remove('hidden');

      if (dadosGrade.length > 0) {
        document.getElementById('exportBtn').classList.remove('hidden');
        atualizarTabela();
      }
    } catch (e) {
      console.error('Erro ao carregar cache:', e);
      resetTudo();
    }
  }
}

/**
 * Reseta todos os dados e a interface para o estado inicial.
 * Limpa o localStorage e redefine as variáveis e elementos DOM.
 */
function resetTudo() {
  localStorage.clear();
  dadosGrade = [];
  gradeOriginal = [];
  placaToOE = new Map();
  placaAntigaMap = new Map();

  // Ajusta a visibilidade dos elementos na interface
  document.getElementById('gradeSection').classList.remove('hidden');
  document.getElementById('csvSection').classList.add('hidden');
  document.getElementById('resetBtn').classList.add('hidden');
  document.getElementById('resetCsvBtn').classList.add('hidden');
  document.getElementById('exportBtn').classList.add('hidden');
  document.getElementById('tabelaContainer').classList.add('hidden');

  // Limpa os campos de entrada
  document.getElementById('excelData').value = '';
  document.getElementById('csvData').value = '';
}

/**
 * Restaura a grade original (reset do CSV).
 * Recarrega os dados originais e atualiza a interface.
 */
function resetCSV() {
  // Restaura os dados da grade original convertendo os Sets novamente
  dadosGrade = gradeOriginal.map(oe => ({
    ...oe,
    PLACAS: new Set(oe.PLACAS)
  }));

  // Atualiza a interface para mostrar a seção CSV e esconder a tabela
  document.getElementById('csvSection').classList.remove('hidden');
  document.getElementById('csvData').value = '';
  document.getElementById('tabelaContainer').classList.add('hidden');
  document.getElementById('exportBtn').classList.add('hidden');

  salvarEstado();
  atualizarTabela();
}

/**
 * Processa os dados da grade a partir do conteúdo colado no campo 'excelData'.
 * Agrupa as informações por OE e calcula o peso previsto.
 */
function processarGrade() {
  const data = document.getElementById('excelData').value.trim();
  if (!data) return;

  // Ignora a primeira linha (cabeçalho) e processa cada linha do arquivo colado
  const oesAgrupados = data.split('\n').slice(1).reduce((acc, linha) => {
    const partes = linha.split('\t');
    const oe = partes[2]?.trim();
    const placa = partes[6]?.trim();

    if (!oe || !placa) return acc;

    // Mapeia a placa para a OE
    placaToOE.set(placa, oe);

    // Se a OE ainda não foi adicionada, inicializa o objeto
    if (!acc[oe]) {
      acc[oe] = {
        OE: oe,
        PLACAS: new Set(),
        DESTINO: partes[15]?.trim(),
        QUANT_ENTREGAS: partes[16]?.trim(),
        QTDE_CAIXAS: partes[18]?.trim(),
        PESO_PREVISTO: 0,
        PESO_ATUAL: 0,
        PORCENTAGEM: 0
      };
    }
    // Adiciona a placa ao conjunto e acumula o peso previsto
    acc[oe].PLACAS.add(placa);
    acc[oe].PESO_PREVISTO += parsePeso(partes[20] || '0');

    return acc;
  }, {});

  dadosGrade = Object.values(oesAgrupados);
  // Salva uma cópia da grade para possibilitar reset
  gradeOriginal = dadosGrade.map(oe => ({
    ...oe,
    PLACAS: new Set(oe.PLACAS)
  }));

  salvarEstado();

  // Atualiza a interface para passar da seção de grade para CSV
  document.getElementById('gradeSection').classList.add('hidden');
  document.getElementById('csvSection').classList.remove('hidden');
  document.getElementById('resetBtn').classList.remove('hidden');
  document.getElementById('resetCsvBtn').classList.remove('hidden');
}

/**
 * Processa os dados do CSV a partir do conteúdo colado no campo 'csvData'.
 * Atualiza o peso atual e o percentual de progresso com base no peso informado.
 */
function processarCSV() {
  const data = document.getElementById('csvData').value.trim();
  if (!data) return;

  // Reinicia os valores de peso atual e porcentagem para cada OE
  dadosGrade.forEach(oe => {
    oe.PESO_ATUAL = 0;
    oe.PORCENTAGEM = 0;
  });

  // Processa cada linha ignorando o cabeçalho
  data.split('\n').slice(1).forEach(linha => {
    const partes = linha.split('\t');
    const status = partes[0]?.trim().toUpperCase();
    const placaCSV = partes[4]?.trim();
    const oeCSV = partes[3]?.trim();
    const pesoBruto = parsePeso(partes[9] || '0');

    // Ignora linhas com status "CONFERIDO" ou com dados incompletos
    if (status === "CONFERIDO" || !placaCSV || !oeCSV) return;

    // Verifica se há uma placa antiga registrada, caso contrário usa a placa atual
    const placaAntiga = placaAntigaMap.get(placaCSV) || placaCSV;
    if (!placaToOE.has(placaCSV)) {
      placaToOE.set(placaCSV, oeCSV);
      placaAntigaMap.set(placaCSV, placaAntiga);
    }

    // Define a OE correta baseada no mapeamento
    const oeKey = placaToOE.get(placaCSV) || oeCSV;
    const oe = dadosGrade.find(e => e.OE === oeKey);
    if (oe) {
      // Atualiza o peso atual e calcula a porcentagem (limitado a 100%)
      oe.PESO_ATUAL += pesoBruto;
      oe.PORCENTAGEM = Math.min((oe.PESO_ATUAL / oe.PESO_PREVISTO * 100), 100);

      // Adiciona as placas (atual e antiga) ao conjunto
      oe.PLACAS.add(placaCSV);
      oe.PLACAS.add(placaAntiga);
    }
  });

  // Filtra as OEs com progresso de 10% ou mais e ordena por porcentagem decrescente
  dadosGrade = dadosGrade.filter(oe => oe.PORCENTAGEM >= 10)
                         .sort((a, b) => b.PORCENTAGEM - a.PORCENTAGEM);

  // Atualiza a interface, salvando o estado e escondendo a seção CSV
  document.getElementById('exportBtn').classList.remove('hidden');
  atualizarTabela();
  salvarEstado();
  document.getElementById('csvSection').classList.add('hidden');
}

/**
 * Atualiza a tabela exibida na interface com o status atual da separação.
 * Cria o HTML da tabela com informações de cada OE e suas respectivas placas.
 */
function atualizarTabela() {
  let html = `<h2><i class="fa-solid fa-table-list"></i> Status da Separação (${new Date().toLocaleTimeString()})</h2>
              <table>
                <tr>
                  <th>OE</th>
                  <th>Placa(s)</th>
                  <th>Destino</th>
                  <th>Entregas</th>
                  <th>Caixas</th>
                  <th>Peso Previsto</th>
                  <th>Progresso</th>
                </tr>`;
  // Para cada OE, cria uma linha na tabela com os dados correspondentes
  dadosGrade.forEach(oe => {
    const destaque = oe.PORCENTAGEM === 100 ? 'destacado' : '';
    const placas = Array.from(oe.PLACAS).map(placa => {
      const placaAntiga = placaAntigaMap.get(placa);
      return placaAntiga ? `${placa} (Nova: ${placaAntiga})` : placa;
    }).join(', ');
    html += `<tr class="${destaque}">
                <td style="white-space: nowrap;">
                  ${oe.OE} <button class="btn-icon" onclick="copiarOE('${oe.OE}')"><i class="fa-regular fa-copy"></i></button>
                </td>
                <td>${placas}</td>
                <td>${oe.DESTINO}</td>
                <td>${oe.QUANT_ENTREGAS}</td>
                <td>${oe.QTDE_CAIXAS}</td>
                <td>${oe.PESO_PREVISTO.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg</td>
                <td>
                  <div style="background: #ddd; border-radius: 4px; overflow: hidden;">
                    <div style="background: #4CAF50; width: ${oe.PORCENTAGEM}%; padding: 2px; text-align: center; color: #000; font-size: 0.8rem;">
                      ${oe.PORCENTAGEM.toFixed(1)}%
                    </div>
                  </div>
                </td>
              </tr>`;
  });
  html += `</table>`;
  // Atualiza o conteúdo da div 'tabelaContainer' e a torna visível
  document.getElementById('tabelaContainer').innerHTML = html;
  document.getElementById('tabelaContainer').classList.remove('hidden');
}

/**
 * Exporta os dados da grade para um arquivo PDF.
 * Utiliza a biblioteca jsPDF para gerar o PDF com layout, bordas e numeração de páginas.
 */
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const margin = 10;
  const startX = margin;
  const startY = 20;
  const colWidths = [20, 40, 40, 20, 20, 30, 20, 20];
  const lineHeight = 7;
  const cellPadding = 2;
  
  // Define o título do relatório
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const title = `RELATÓRIO DE SEPARAÇÃO - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  doc.text(title, startX, startY - 5);
  
  // Cria os cabeçalhos da tabela no PDF
  const headers = ["OE", "PLACAS", "DESTINO", "ENT", "CX", "PESO KG", "%", "PEGO"];
  doc.setFontSize(10);
  let currentX = startX;
  const headerHeight = 10;
  for (let i = 0; i < headers.length; i++) {
    doc.rect(currentX, startY, colWidths[i], headerHeight);
    doc.text(headers[i], currentX + cellPadding, startY + headerHeight / 2 + 3);
    currentX += colWidths[i];
  }
  
  // Adiciona as linhas de conteúdo para cada OE
  let y = startY + headerHeight;
  doc.setFontSize(9);
  dadosGrade.forEach((oe) => {
    const content = [
      oe.OE,
      Array.from(oe.PLACAS).join(', '),
      oe.DESTINO,
      oe.QUANT_ENTREGAS,
      oe.QTDE_CAIXAS,
      oe.PESO_PREVISTO.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
      oe.PORCENTAGEM.toFixed(1) + "%",
      " " // Espaço reservado para um checkbox
    ];
    let maxLines = 1;
    // Determina a altura da linha com base na quantidade máxima de linhas necessárias para o texto
    for (let i = 0; i < content.length; i++) {
      const textLines = doc.splitTextToSize(content[i].toString(), colWidths[i] - 2 * cellPadding);
      maxLines = Math.max(maxLines, textLines.length);
    }
    const rowHeight = maxLines * lineHeight + 2 * cellPadding;
    // Adiciona nova página se a altura atual ultrapassar o limite
    if (y + rowHeight > 200) {
      doc.addPage();
      y = startY;
      currentX = startX;
      for (let i = 0; i < headers.length; i++) {
        doc.rect(currentX, y, colWidths[i], headerHeight);
        doc.text(headers[i], currentX + cellPadding, y + headerHeight / 2 + 3);
        currentX += colWidths[i];
      }
      y += headerHeight;
    }
    currentX = startX;
    // Desenha cada célula com seu conteúdo
    for (let i = 0; i < content.length; i++) {
      doc.rect(currentX, y, colWidths[i], rowHeight);
      let textLines = doc.splitTextToSize(content[i].toString(), colWidths[i] - 2 * cellPadding);
      for (let j = 0; j < textLines.length; j++) {
        let textY = y + cellPadding + (j + 1) * lineHeight - (lineHeight / 2);
        doc.text(textLines[j], currentX + cellPadding, textY);
      }
      // Adiciona uma caixa de seleção na última coluna
      if (i === content.length - 1) {
        let boxSize = 6;
        let boxX = currentX + (colWidths[i] - boxSize) / 2;
        let boxY = y + (rowHeight - boxSize) / 2;
        doc.rect(boxX, boxY, boxSize, boxSize);
      }
      currentX += colWidths[i];
    }
    y += rowHeight;
  });
  
  // Adiciona numeração de páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount}`, margin, 205);
  }
  
  // Salva o PDF com um nome baseado na data/hora atual
  doc.save(`Separacao_${new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '')}.pdf`);
}

/**
 * Copia o valor da OE para a área de transferência.
 *
 * @param {string} texto - Texto a ser copiado.
 */
function copiarOE(texto) {
  navigator.clipboard.writeText(texto);
}

// Configura o evento de paste para o campo 'excelData'
// Quando dados são colados, processa a grade e limpa o campo
document.getElementById('excelData').addEventListener('paste', (e) => {
  setTimeout(() => {
    processarGrade();
    e.target.value = '';
  }, 100);
});

// Configura o evento de paste para o campo 'csvData'
// Quando dados são colados, processa o CSV e limpa o campo
document.getElementById('csvData').addEventListener('paste', (e) => {
  setTimeout(() => {
    processarCSV();
    e.target.value = '';
  }, 100);
});

// Ao carregar a página, tenta carregar os dados salvos da grade
window.onload = carregarGradeCache;
