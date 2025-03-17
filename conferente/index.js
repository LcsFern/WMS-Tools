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

    // Ignora linhas com status "CONFERIDO ou ESPERANDO ERP FATURAR" ou com dados incompletos
    if (status === "CONFERIDO" || !placaCSV || !oeCSV) return;
    if (status === "ESPERANDO ERP FATURAR" || !placaCSV || !oeCSV) return;

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
    const destaque = oe.PORCENTAGEM >= 97 ? 'destacado' : '';
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
  document.getElementById('tabelaContainer').innerHTML = html;
  document.getElementById('tabelaContainer').classList.remove('hidden');
}


/**
 * Exporta os dados da grade para um arquivo PDF.
 * Utiliza a biblioteca jsPDF para gerar o PDF com layout, bordas e numeração de páginas.
 */
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  // Cria o documento em orientação "portrait" (vertical)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // ~210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // ~297 mm
  const margin = 10;
  const availableWidth = pageWidth - 2 * margin; // 190 mm disponível
  const startX = margin;
  const startY = margin + 12; // Espaço para o título

  // Definindo larguras para 8 colunas, totalizando 190 mm
  const colWidths = [23, 42, 37, 14, 14, 28, 19, 13];
  const headerHeight = 10;
  const cellPadding = 2;
  const lineHeight = 7;

  // Título do relatório
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  const title = `RELATÓRIO DE SEPARAÇÃO - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  doc.text(title, startX, margin + 5);

// Cabeçalhos da tabela
const headers = ["OE", "PLACAS", "DESTINO", "ENT", "CX", "PESO KG", "%", "PEGO"];
doc.setFontSize(10);
let currentX = startX;
for (let i = 0; i < headers.length; i++) {
  // Reconfigura o fundo para cada célula de cabeçalho
  doc.setFillColor(200, 200, 200); // Cinza médio
  doc.rect(currentX, startY, colWidths[i], headerHeight, 'F');
  // Garante que o texto será renderizado em preto
  doc.setTextColor(0, 0, 0);
  // Texto centralizado na célula
  doc.text(headers[i], currentX + colWidths[i] / 2, startY + headerHeight / 2 + 3, { align: 'center' });
  currentX += colWidths[i];
}


  let y = startY + headerHeight;
  doc.setFontSize(9);

  dadosGrade.forEach((oe) => {
    // Conteúdo de cada coluna
    const content = [
      oe.OE,
      Array.from(oe.PLACAS).join(', '),
      oe.DESTINO,
      oe.QUANT_ENTREGAS,
      oe.QTDE_CAIXAS,
      oe.PESO_PREVISTO.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
      oe.PORCENTAGEM.toFixed(1) + "%",
      " " // Espaço para a checkbox
    ];

    // Calcula a altura da linha baseada no maior número de linhas necessárias
    let maxLines = 1;
    for (let i = 0; i < content.length; i++) {
      const textLines = doc.splitTextToSize(content[i].toString(), colWidths[i] - 2 * cellPadding);
      maxLines = Math.max(maxLines, textLines.length);
    }
    const rowHeight = maxLines * lineHeight + 2 * cellPadding;

    // Se a linha ultrapassar a altura disponível, adiciona nova página com cabeçalho
    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      currentX = startX;
      doc.setFillColor(200, 200, 200);
      for (let i = 0; i < headers.length; i++) {
        doc.rect(currentX, y, colWidths[i], headerHeight, 'F');
        doc.setTextColor(0, 0, 0);
        doc.text(headers[i], currentX + colWidths[i] / 2, y + headerHeight / 2 + 3, { align: 'center' });
        currentX += colWidths[i];
      }
      y += headerHeight;
    }
    currentX = startX;
    // Fundo branco para a linha
    doc.setFillColor(255, 255, 255);
    doc.rect(currentX, y, availableWidth, rowHeight, 'F');

    // Desenha cada célula
    for (let i = 0; i < content.length; i++) {
      // Para as colunas destacadas (OE, PLACAS e %), aplica fundo cinza claro
      if (i === 0 || i === 1 || i === 6) {
        doc.setFillColor(240, 240, 240);
        doc.rect(currentX, y, colWidths[i], rowHeight, 'F');
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      // Desenha a borda da célula
      doc.rect(currentX, y, colWidths[i], rowHeight);
      // Força o texto a ser renderizado em preto
      doc.setTextColor(0, 0, 0);
      // Divide o conteúdo em linhas para caber na célula
      let textLines = doc.splitTextToSize(content[i].toString(), colWidths[i] - 2 * cellPadding);
      for (let j = 0; j < textLines.length; j++) {
        let textY = y + cellPadding + (j + 1) * lineHeight - (lineHeight / 2);
        // Se for coluna destacada, centraliza; caso contrário, alinha à esquerda
        if (i === 0 || i === 1 || i === 6) {
          doc.text(textLines[j], currentX + colWidths[i] / 2, textY, { align: 'center' });
        } else {
          doc.text(textLines[j], currentX + cellPadding, textY);
        }
      }
      // Na última coluna, desenha uma caixa para checkbox
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

  // Numeração de páginas no rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount}`, margin, pageHeight - 5);
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
