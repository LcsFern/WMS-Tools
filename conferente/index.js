// Variáveis globais para armazenar os dados e mapeamentos da grade  
let dadosGrade = [];              // Dados processados (formato gradeExpedicao)
let placaToOE = new Map();          // Mapeia cada placa à sua OE correspondente
let placaAntigaMap = new Map();     // Mapeia a placa original para a placa modificada (caso haja atualização)
let gradeOriginal = [];             // Cópia da grade original para possibilitar reset (reset CSV)

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
 * Salva o estado atual da grade no localStorage (na chave "gradeExpedicao").
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
 * Converte a grade salva em "gradeCompleta" para o formato utilizado pelo sistema (gradeExpedicao).
 * 
 * A conversão agrupa os registros por OE, criando para cada grupo um objeto contendo:
 *   - OE
 *   - PLACAS: conjunto (Set) com as placas únicas (usando "PLACA ROTEIRIZADA")
 *   - DESTINO, QUANT. ENTREGAS e QTDE CXS: do primeiro registro do grupo
 *   - PESO PREVISTO: obtido a partir da coluna "PESO ENTREGAS"
 *   - PESO_ATUAL: 0 e PORCENTAGEM: 0 (ainda não processados)
 * 
 * Durante a conversão, o mapa placaToOE é atualizado.
 */
function converterGradeCompletaParaExpedicao(gradeCompleta) {
  const agrupados = {};
  gradeCompleta.forEach(registro => {
    const oe = registro["OE"]?.trim();
    const placa = registro["PLACA ROTEIRIZADA"]?.trim();
    if (!oe || !placa) return;
    if (!agrupados[oe]) {
      agrupados[oe] = {
        OE: oe,
        PLACAS: new Set(),
        DESTINO: registro["DESTINO"]?.trim() || "",
        QUANT_ENTREGAS: registro["QUANT. ENTREGAS"]?.trim() || "",
        QTDE_CAIXAS: registro["QTDE CXS"]?.trim() || "",
        PESO_PREVISTO: parsePeso(registro["PESO ENTREGAS"] || '0'),
        PESO_ATUAL: 0,
        PORCENTAGEM: 0
      };
    }
    agrupados[oe].PLACAS.add(placa);
    placaToOE.set(placa, oe);
  });
  return Object.values(agrupados);
}

/**
 * Carrega os dados salvos em "gradeCompleta", converte-os para "gradeExpedicao" e atualiza a interface.
 * Esta função NÃO modifica o conteúdo de "gradeCompleta", apenas cria uma cópia no formato necessário.
 */
function loadExpedicaoFromCompleta() {
  const gradeRaw = localStorage.getItem("gradeCompleta");
  if (!gradeRaw) {
    // Se não houver dados, exibe uma mensagem moderna
    document.getElementById('gradeSection').innerHTML = `
      <div class="home-container">
        <h2><i class="fas fa-exclamation-circle"></i> Nenhuma GRADE Encontrada</h2>
        <p>Para visualizar os veículos e acompanhar o progresso, carregue a GRADE principal da operação.</p>
      </div>
    `;
    // Esconde os botões de ação, pois não há grade carregada
    document.getElementById('resetCsvBtn').classList.add('hidden');
    document.getElementById('csvSection').classList.add('hidden');
    document.getElementById('exportBtn').classList.add('hidden');
    document.getElementById('tabelaContainer').classList.add('hidden');
    return;
  }

  let gradeCompleta;
  try {
    gradeCompleta = JSON.parse(gradeRaw);
  } catch (e) {
    console.error("Erro ao ler gradeCompleta:", e);
    return;
  }

  dadosGrade = converterGradeCompletaParaExpedicao(gradeCompleta);
  gradeOriginal = dadosGrade.map(oe => ({ ...oe, PLACAS: new Set(oe.PLACAS) }));
  placaAntigaMap = new Map();

  salvarEstado();

  // Esconde a mensagem e exibe a seção da grade carregada
  document.getElementById('gradeSection').classList.add('hidden');
  document.getElementById('csvSection').classList.remove('hidden');
  document.getElementById('resetCsvBtn').classList.remove('hidden');

  if (dadosGrade.length > 0) {
    document.getElementById('exportBtn').classList.remove('hidden');
    atualizarTabela();
  }
}


/**
 * Reseta os dados de "gradeExpedicao" (usado no site) e a interface.
 * NOTA: Esta função NÃO remove os dados originais em "gradeCompleta".
 */
function resetTudo() {
  // Aqui não removemos gradeCompleta; apenas removemos os dados da grade utilizada no site.
  localStorage.removeItem('gradeExpedicao');
  dadosGrade = [];
  gradeOriginal = [];
  placaToOE = new Map();
  placaAntigaMap = new Map();

  // Atualiza a interface para indicar que a grade não foi carregada
  document.getElementById('gradeSection').classList.remove('hidden');
  document.getElementById('csvSection').classList.add('hidden');
  document.getElementById('resetBtn').classList.add('hidden');
  document.getElementById('resetCsvBtn').classList.add('hidden');
  document.getElementById('exportBtn').classList.add('hidden');
  document.getElementById('tabelaContainer').classList.add('hidden');

  document.getElementById('excelData').value = "";
  document.getElementById('csvData').value = "";
  // Exibe a mensagem para importar a grade novamente
  document.getElementById('gradeSection').innerHTML = "<h2>GRADE NÃO CARREGADA, FAVOR CARREGAR A GRADE</h2>";
}

/**
 * Restaura a grade original (reset do CSV).
 */
function resetCSV() {
  dadosGrade = gradeOriginal.map(oe => ({ ...oe, PLACAS: new Set(oe.PLACAS) }));

  document.getElementById('csvSection').classList.remove('hidden');
  document.getElementById('csvData').value = '';
  document.getElementById('tabelaContainer').classList.add('hidden');
  document.getElementById('exportBtn').classList.add('hidden');

  salvarEstado();
  atualizarTabela();
}

/**
 * Processa os dados da grade a partir do conteúdo colado no campo 'excelData'.
 * Essa função é usada para importar uma nova grade.
 */
function processarGrade() {
  const data = document.getElementById('excelData').value.trim();
  if (!data) return;

  const oesAgrupados = data.split('\n').slice(1).reduce((acc, linha) => {
    const partes = linha.split('\t');
    const oe = partes[2]?.trim();
    const placa = partes[6]?.trim();

    if (!oe || !placa) return acc;

    placaToOE.set(placa, oe);

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
    acc[oe].PLACAS.add(placa);
    acc[oe].PESO_PREVISTO += parsePeso(partes[20] || '0');

    return acc;
  }, {});

  dadosGrade = Object.values(oesAgrupados);
  gradeOriginal = dadosGrade.map(oe => ({ ...oe, PLACAS: new Set(oe.PLACAS) }));

  salvarEstado();

  document.getElementById('gradeSection').classList.add('hidden');
  document.getElementById('csvSection').classList.remove('hidden');
  // Exibe somente o botão Resetar CSV
  document.getElementById('resetBtn').classList.add('hidden');
  document.getElementById('resetCsvBtn').classList.remove('hidden');

  if (dadosGrade.length > 0) {
    document.getElementById('exportBtn').classList.remove('hidden');
    atualizarTabela();
  }
}

/**
 * Processa os dados do CSV a partir do conteúdo colado no campo 'csvData'.
 * Atualiza o peso atual e a porcentagem de cada OE com base no CSV.
 */
function processarCSV() {
  const data = document.getElementById('csvData').value.trim();
  if (!data) return;

  dadosGrade.forEach(oe => {
    oe.PESO_ATUAL = 0;
    oe.PORCENTAGEM = 0;
  });

  data.split('\n').slice(1).forEach(linha => {
    const partes = linha.split('\t');
    const status = partes[0]?.trim().toUpperCase();
    const placaCSV = partes[4]?.trim();
    const oeCSV = partes[3]?.trim();
    const pesoBruto = parsePeso(partes[9] || '0');

    if (status === "CONFERIDO" || !placaCSV || !oeCSV) return;
    if (status === "ESPERANDO ERP FATURAR" || !placaCSV || !oeCSV) return;
    if (status === "FINALIZADO" || !placaCSV || !oeCSV) return;

    const placaAntiga = placaAntigaMap.get(placaCSV) || placaCSV;
    if (!placaToOE.has(placaCSV)) {
      placaToOE.set(placaCSV, oeCSV);
      placaAntigaMap.set(placaCSV, placaAntiga);
    }

    const oeKey = placaToOE.get(placaCSV) || oeCSV;
    const oe = dadosGrade.find(e => e.OE === oeKey);
    if (oe) {
      oe.PESO_ATUAL += pesoBruto;
      oe.PORCENTAGEM = Math.min((oe.PESO_ATUAL / oe.PESO_PREVISTO * 100), 100);
      oe.PLACAS.add(placaCSV);
      oe.PLACAS.add(placaAntiga);
    }
  });

  dadosGrade = dadosGrade.filter(oe => oe.PORCENTAGEM >= 10)
                         .sort((a, b) => b.PORCENTAGEM - a.PORCENTAGEM);

  document.getElementById('exportBtn').classList.remove('hidden');
  atualizarTabela();
  salvarEstado();
  document.getElementById('csvSection').classList.add('hidden');
}

/**
 * Atualiza a tabela exibida na interface com o status atual.
 */
function atualizarTabela() {
  let html = `<h2>Status da Separação (${new Date().toLocaleTimeString()})</h2>
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
  dadosGrade.forEach(oe => {
    const placas = Array.from(oe.PLACAS).join(', ');
    html += `<tr>
                <td>${oe.OE} <button class="btn-icon" onclick="copiarOE('${oe.OE}')"><i class="fa-regular fa-copy"></i></button></td>
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
 * Exporta os dados da grade para PDF.
 */
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const availableWidth = pageWidth - 2 * margin;
  const startX = margin;
  const startY = margin + 12;

  const colWidths = [23, 42, 37, 14, 14, 28, 19, 13];
  const headerHeight = 10;
  const cellPadding = 2;
  const lineHeight = 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  const title = `RELATÓRIO DE SEPARAÇÃO - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  doc.text(title, startX, margin + 5);

  const headers = ["OE", "PLACAS", "DESTINO", "ENT", "CX", "PESO KG", "%", "PEGO"];
  doc.setFontSize(10);
  let currentX = startX;
  for (let i = 0; i < headers.length; i++) {
    doc.setFillColor(200, 200, 200);
    doc.rect(currentX, startY, colWidths[i], headerHeight, 'F');
    doc.setTextColor(0, 0, 0);
    doc.text(headers[i], currentX + colWidths[i] / 2, startY + headerHeight / 2 + 3, { align: 'center' });
    currentX += colWidths[i];
  }

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
      " "
    ];

    let maxLines = 1;
    for (let i = 0; i < content.length; i++) {
      const textLines = doc.splitTextToSize(content[i].toString(), colWidths[i] - 2 * cellPadding);
      maxLines = Math.max(maxLines, textLines.length);
    }
    const rowHeight = maxLines * lineHeight + 2 * cellPadding;

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
    doc.setFillColor(255, 255, 255);
    doc.rect(currentX, y, availableWidth, rowHeight, 'F');

    for (let i = 0; i < content.length; i++) {
      if (i === 0 || i === 1 || i === 6) {
        doc.setFillColor(240, 240, 240);
        doc.rect(currentX, y, colWidths[i], rowHeight, 'F');
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      doc.rect(currentX, y, colWidths[i], rowHeight);
      doc.setTextColor(0, 0, 0);
      let textLines = doc.splitTextToSize(content[i].toString(), colWidths[i] - 2 * cellPadding);
      for (let j = 0; j < textLines.length; j++) {
        let textY = y + cellPadding + (j + 1) * lineHeight - (lineHeight / 2);
        if (i === 0 || i === 1 || i === 6) {
          doc.text(textLines[j], currentX + colWidths[i] / 2, textY, { align: 'center' });
        } else {
          doc.text(textLines[j], currentX + cellPadding, textY);
        }
      }
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

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount}`, margin, pageHeight - 5);
  }

  doc.save(`Separacao_${new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '')}.pdf`);
}

/**
 * Copia o valor da OE para a área de transferência.
 */
function copiarOE(texto) {
  navigator.clipboard.writeText(texto);
}

// Eventos de paste para processar a grade e o CSV
document.getElementById('excelData').addEventListener('paste', (e) => {
  setTimeout(() => {
    processarGrade();
    e.target.value = '';
  }, 100);
});

document.getElementById('csvData').addEventListener('paste', (e) => {
  setTimeout(() => {
    processarCSV();
    e.target.value = '';
  }, 100);
});

// Ao carregar a página, carrega a grade a partir de "gradeCompleta" convertida para "gradeExpedicao"
window.onload = loadExpedicaoFromCompleta;
