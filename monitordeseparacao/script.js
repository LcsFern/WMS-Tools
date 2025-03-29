const STORAGE_KEY = "checkbox_state_monitor";
const RESULT_STORAGE_KEY = "result_state_monitor";
let registrosCombinados = [];
let resetCriado = false;
let separadoresPorOE = new Map();

function lerGradeCompleta() {
  return localStorage.getItem("gradeCompleta");
}

function exibirMensagemAlerta() {
  document.getElementById("mainContent").innerHTML =
    `<div class="error-container">
        <h2><i class="fa-solid fa-triangle-exclamation"></i> GRADE NÃO ENCONTRADA</h2>
        <p>Por favor, carregue a grade completa na pagina GRADE.</p>
    </div>`;
}

function exibirAreaCSV() {
  let savedResults = localStorage.getItem(RESULT_STORAGE_KEY);
  if (savedResults) {
    // Se houver resultados salvos, não exibe a área de importação
    document.getElementById("mainContent").innerHTML = "";
    carregarResultadosSalvos();
  } else {
    let btnReset = document.getElementById("btnReset");
    if (btnReset) { btnReset.remove(); resetCriado = false; }
    document.getElementById("mainContent").innerHTML = `
      <div class="import-section">
        <h2><i class="fa-solid fa-file-csv"></i> Cole o CSV do Monitor de Picking</h2>
        <textarea id="csvInput" placeholder="Cole o CSV aqui..."></textarea>
      </div>
    `;
    document.getElementById("csvInput").value = "";
    document.getElementById("result").innerHTML = "";
    document.getElementById("pdfExportArea").innerHTML = "";
    document.getElementById("csvInput").addEventListener("input", function() {
      if (this.value.trim() !== "") {
        processarCSV(this.value);
        document.querySelector(".import-section").style.display = "none";
        if (!resetCriado) {
          exibirBotaoReset();
          resetCriado = true;
        }
      }
    });
    carregarResultadosSalvos();
  }
}

function exibirBotaoReset() {
  let btn = document.createElement("button");
  btn.id = "btnReset";
  btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> RESET';
  btn.style.display = 'block';
  btn.style.margin = '1rem auto';
  btn.addEventListener("click", () => {
    document.getElementById("result").innerHTML = "";
    localStorage.removeItem(RESULT_STORAGE_KEY);
    registrosCombinados = [];
    separadoresPorOE.clear();
    exibirAreaCSV();
  });
  document.getElementById("mainContent").appendChild(btn);
}

function processarCSV(csvText) {
  const resultDiv = document.getElementById("result");
  if (!csvText.trim()) { resultDiv.innerHTML = ""; return; }

  const delimitador = csvText.indexOf("\t") > -1 ? "\t" : ",";
  const linhas = csvText.trim().split("\n");
  if (linhas.length < 2) return;

  const cabecalho = linhas[0].split(delimitador).map(h => h.trim().toLowerCase());

  let idxOE = cabecalho.findIndex(col => col === "oe");
  if (idxOE === -1) { idxOE = cabecalho.findIndex(col => col.includes("oe /")); }
  const idxTemperatura = cabecalho.findIndex(col => col.includes("temperatura"));
  const idxSeparador = cabecalho.findIndex(col => col === "separador");
  const idxPercentual = cabecalho.findIndex(col => col.includes("percentual"));
  const idxCaixas = cabecalho.findIndex(col => col === "caixas");
  const idxPosicao = cabecalho.findIndex(col => col === "posição");

  let csvPorOE = {};
  separadoresPorOE.clear();

  linhas.slice(1).forEach(linha => {
    let cols = linha.split(delimitador);
    let oe = cols[idxOE] ? cols[idxOE].trim().toLowerCase() : "";
    if (!oe) return;
    let temperatura = cols[idxTemperatura] ? cols[idxTemperatura].trim().toUpperCase() : "";
    let separador = cols[idxSeparador] ? cols[idxSeparador].trim() : "";
    let percentual = cols[idxPercentual] ? parseFloat(cols[idxPercentual].replace(",", ".")) : 0;
    let caixas = cols[idxCaixas] ? parseFloat(cols[idxCaixas].replace(",", ".")) : 0;
    let posicao = cols[idxPosicao] ? parseFloat(cols[idxPosicao].replace(",", ".")) : 0;
    let peso = caixas * posicao;
    let entregue = peso * (percentual / 100);

    if (!csvPorOE[oe]) {
      csvPorOE[oe] = {
        congelado: { separadores: [], totalPeso: 0, totalEntregue: 0, totalCaixas: 0, separadoresDados: {}, pendentes: 0 },
        resfriado: { separadores: [], totalPeso: 0, totalEntregue: 0, totalCaixas: 0, separadoresDados: {}, pendentes: 0 }
      };
    }

    let grupo = temperatura === "CONGELADO" ? csvPorOE[oe].congelado : csvPorOE[oe].resfriado;
    if (temperatura === "CONGELADO" || temperatura === "RESFRIADO") {
      if (separador && !grupo.separadores.includes(separador)) {
        grupo.separadores.push(separador);
        if (separadoresPorOE.has(separador) && separadoresPorOE.get(separador).percentual < 100 && separadoresPorOE.get(separador).oe !== oe) {
          console.warn(`Separador ${separador} duplicado em OE ${oe} e ${separadoresPorOE.get(separador).oe}`);
        }
      } else if (!separador) {
        grupo.pendentes += 1;
      }
      grupo.totalPeso += peso;
      grupo.totalEntregue += entregue;
      grupo.totalCaixas += caixas;

      if (separador) {
        if (!grupo.separadoresDados[separador]) {
          grupo.separadoresDados[separador] = [];
        }
        grupo.separadoresDados[separador].push({ peso, entregue, caixas, percentual });
        separadoresPorOE.set(separador, { oe, percentual });
      }
    }
  });

  for (let oe in csvPorOE) {
    let grupo = csvPorOE[oe];
    let totalPeso = grupo.congelado.totalPeso + grupo.resfriado.totalPeso;
    let totalEntregue = grupo.congelado.totalEntregue + grupo.resfriado.totalEntregue;
    grupo.totalCaixas = grupo.congelado.totalCaixas + grupo.resfriado.totalCaixas;

    grupo.finalPercentual = totalPeso > 0 ? Math.round((totalEntregue / totalPeso) * 100 * 100) / 100 : 0;
  }

  let gradeDataStr = lerGradeCompleta();
  if (!gradeDataStr) return;
  let gradeData;
  try { gradeData = JSON.parse(gradeDataStr); }
  catch (e) {
    resultDiv.innerHTML = "<p class='alert'><i class='fa-solid fa-exclamation-triangle'></i> Erro ao processar gradeCompleta.</p>";
    return;
  }

  let novosRegistros = gradeData.map(reg => {
    let oeGrade = reg.OE ? reg.OE.trim().toLowerCase() : "";
    if (!csvPorOE[oeGrade]) return null;
    let grupo = csvPorOE[oeGrade];
    if (!grupo.congelado.separadores.length && !grupo.resfriado.separadores.length) return null;
    let placa = (reg["TROCAR PLACA"] && reg["TROCAR PLACA"].trim() !== "")
                  ? reg["TROCAR PLACA"].trim()
                  : (reg["PLACA ROTEIRIZADA"] ? reg["PLACA ROTEIRIZADA"].trim() : "");
    let destino = reg.DESTINO ? reg.DESTINO.trim() : "";
    let fullCongelado = grupo.congelado.separadores.length ? [...new Set(grupo.congelado.separadores)] : [];
    let fullResfriado = grupo.resfriado.separadores.length ? [...new Set(grupo.resfriado.separadores)] : [];
    let displayCongelado = fullCongelado.map(nome => nome.split(" ")[0]).join(", ");
    let displayResfriado = fullResfriado.map(nome => nome.split(" ")[0]).join(", ");
    let percentual = grupo.finalPercentual;
    let totalCaixas = grupo.totalCaixas;
    let qtdeCxs = reg["QTDE CXS"] ? reg["QTDE CXS"].trim() : "0";
    let pesoTotal = reg["PESO ENTREGAS"] ? reg["PESO ENTREGAS"].trim() : "0";

    let congeladoPercentuais = {};
    for (let sep in grupo.congelado.separadoresDados) {
      const percentuais = grupo.congelado.separadoresDados[sep].map(d => d.percentual);
      congeladoPercentuais[sep] = Math.min(...percentuais);
    }
    let resfriadoPercentuais = {};
    for (let sep in grupo.resfriado.separadoresDados) {
      const percentuais = grupo.resfriado.separadoresDados[sep].map(d => d.percentual);
      resfriadoPercentuais[sep] = Math.min(...percentuais);
    }

    return {
      placa,
      oe: reg.OE ? reg.OE.trim() : "",
      destino,
      sepCongeladoFull: fullCongelado.join(", "),
      sepResfriadoFull: fullResfriado.join(", "),
      sepCongeladoDisplay: displayCongelado,
      sepResfriadoDisplay: displayResfriado,
      caixasSeparacao: totalCaixas,
      qtdeCxs,
      pesoTotal,
      percentual,
      emConferencia: getCheckboxState(reg.OE ? reg.OE.trim() : ""),
      congeladoPercentuais,
      resfriadoPercentuais,
      pendentesCongelado: grupo.congelado.pendentes,
      pendentesResfriado: grupo.resfriado.pendentes
    };
  }).filter(item => item !== null);

  novosRegistros.forEach(novo => {
    let existente = registrosCombinados.find(r => r.oe === novo.oe);
    if (existente) { novo.emConferencia = existente.emConferencia; }
  });
  registrosCombinados = novosRegistros;
  salvarResultados();
  renderizarTabela();
}

function salvarResultados() {
  localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(registrosCombinados));
}

function carregarResultadosSalvos() {
  const savedResults = localStorage.getItem(RESULT_STORAGE_KEY);
  if (savedResults) {
    registrosCombinados = JSON.parse(savedResults);
    renderizarTabela();
    if (!resetCriado) {
      exibirBotaoReset();
      resetCriado = true;
    }
  }
}

function setCheckboxState(oe, state) {
  let obj = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  obj[oe] = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

function getCheckboxState(oe) {
  let obj = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  return obj[oe] || false;
}

function renderizarTabela() {
  const resultDiv = document.getElementById("result");

  // Insere o sistema de busca (apenas quando CSV já foi carregado)
  let searchHTML = '<div id="searchSystem" class="search-container">' +
    '<div class="search-bar">' +
    '<i class="fa-solid fa-search"></i>' +
    '<input type="text" id="searchInput" placeholder="Pesquisar OE, Placa, Separador, Destino..."/>' +
    '</div>' +
    '</div>';

  let naoConferencia = registrosCombinados.filter(r => !r.emConferencia);
  naoConferencia.sort((a, b) => b.percentual - a.percentual);
  let emConferencia = registrosCombinados.filter(r => r.emConferencia);
  let registrosOrdenados = naoConferencia.concat(emConferencia);

  let html = searchHTML;
  html += '<table><thead><tr>' +
             '<th><i class="fa-solid fa-car"></i> Placa</th>' +
             '<th><i class="fa-solid fa-hashtag"></i> OE</th>' +
             '<th><i class="fa-solid fa-location-dot"></i> Destino</th>' +
             '<th><i class="fa-solid fa-snowflake"></i> Separador Congelado</th>' +
             '<th><i class="fa-solid fa-temperature-low"></i> Separador Resfriado</th>' +
             '<th><i class="fa-solid fa-box"></i> CXS Separação</th>' +
             '<th><i class="fa-solid fa-boxes"></i> QTDE CXS</th>' +
             '<th><i class="fa-solid fa-weight"></i> Peso Total</th>' +
             '<th><i class="fa-solid fa-percent"></i> %</th>' +
             '<th><i class="fa-solid fa-check"></i> EM CONFERÊNCIA</th>' +
             '</tr></thead><tbody>';

  registrosOrdenados.forEach(item => {
    let congeladoHTML = "";
    if (item.sepCongeladoDisplay && Object.keys(item.congeladoPercentuais).length > 0) {
      let separadores = item.sepCongeladoFull.split(", ");
      let displaySeparadores = item.sepCongeladoDisplay.split(", ");
      congeladoHTML = separadores.map((sep, index) => {
        let percentual = item.congeladoPercentuais[sep] || 0;
        let percentualExibicao = Math.round(percentual);
        let progresso = `<div class="progress-container small-progress">
                           <div class="progress-bar" style="width: ${percentualExibicao}%; --progress-width: ${percentualExibicao}%;" data-percent="${percentualExibicao}%"></div>
                         </div>`;
        return `<span title="${sep} (${percentualExibicao}%)">${displaySeparadores[index]} ${progresso}</span>`;
      }).join(", ");
    }

    let resfriadoHTML = "";
    if (item.sepResfriadoDisplay && Object.keys(item.resfriadoPercentuais).length > 0) {
      let separadores = item.sepResfriadoFull.split(", ");
      let displaySeparadores = item.sepResfriadoDisplay.split(", ");
      resfriadoHTML = separadores.map((sep, index) => {
        let percentual = item.resfriadoPercentuais[sep] || 0;
        let percentualExibicao = Math.round(percentual);
        let progresso = `<div class="progress-container small-progress">
                           <div class="progress-bar" style="width: ${percentualExibicao}%; --progress-width: ${percentualExibicao}%;" data-percent="${percentualExibicao}%"></div>
                         </div>`;
        return `<span title="${sep} (${percentualExibicao}%)">${displaySeparadores[index]} ${progresso}</span>`;
      }).join(", ");
    }

    let percentualOE = item.percentual;
    let percentualOEExibicao = percentualOE === 100 ? 100 : Math.floor(percentualOE);
    let progresso = `<div class="progress-container main-progress">
      <div class="progress-bar" style="width: ${percentualOEExibicao}%; --progress-width: ${percentualOEExibicao}%;" data-percent="${percentualOEExibicao}%"></div>
    </div>`;

    let linhaStyle = percentualOE === 100 ? ' class="completo"' : "";

    let pendentesTotal = item.pendentesCongelado + item.pendentesResfriado;
    let pendentesHTML = "";
    if (pendentesTotal > 0) {
      let tooltip = `CARGAS PENDENTES: ${item.pendentesCongelado > 0 ? `${item.pendentesCongelado} CONGELADO${item.pendentesCongelado > 1 ? 'S' : ''}` : ''}${item.pendentesCongelado > 0 && item.pendentesResfriado > 0 ? ' E ' : ''}${item.pendentesResfriado > 0 ? `${item.pendentesResfriado} RESFRIADO${item.pendentesResfriado > 1 ? 'S' : ''}` : ''}`;
      pendentesHTML = `<span class="pendentes-column"><span class="pendentes-indicator" title="${tooltip}">P${pendentesTotal}</span></span>`;
    }

    html += `<tr${linhaStyle}>
              <td>${item.placa}</td>
              <td class="oe-cell">
                <span class="oe-text">${item.oe}</span>
                <button class="copy-button" data-oe="${item.oe}"><i class="fa-solid fa-copy"></i></button>
              </td>
              <td>${item.destino}</td>
              <td class="separador-cell">${congeladoHTML}${pendentesHTML}</td>
              <td>${resfriadoHTML}</td>
              <td>${item.caixasSeparacao}</td>
              <td>${item.qtdeCxs}</td>
              <td>${item.pesoTotal}</td>
              <td>${progresso}</td>
              <td>
                <label>
                  <input type="checkbox" data-oe="${item.oe}" ${item.emConferencia ? "checked" : ""}>
                  <span class="conferencia-label">${item.emConferencia ? "SIM" : ""}</span>
                </label>
              </td>
             </tr>`;
  });
  html += '</tbody></table>';
  resultDiv.innerHTML = html;

  // Ativa o filtro de busca (buscando nas linhas da tabela)
  let searchInputField = document.getElementById("searchInput");
  if (searchInputField) {
    searchInputField.addEventListener("input", function() {
      let filter = this.value.toLowerCase();
      let rows = document.querySelectorAll("#result table tbody tr");
      rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(filter) ? "" : "none";
      });
    });
  }

  const checkboxes = resultDiv.querySelectorAll("input[type='checkbox']");
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener("change", function() {
      let oe = this.getAttribute("data-oe");
      registrosCombinados.forEach(reg => {
        if (reg.oe === oe) {
          reg.emConferencia = this.checked;
          setCheckboxState(oe, this.checked);
        }
      });
      salvarResultados();
      renderizarTabela();
    });
  });
  exibirBotaoPDF();
}

function exibirBotaoPDF() {
  let btnPDF = document.getElementById("btnPDF");
  if (!btnPDF) {
    btnPDF = document.createElement("button");
    btnPDF.id = "btnPDF";
    btnPDF.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Exportar PDF';
    btnPDF.addEventListener("click", exportarPDF);
    document.getElementById("pdfExportArea").appendChild(btnPDF);
  }
}

function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const availableWidth = pageWidth - 2 * margin;
  const startX = margin;
  const startY = margin + 12;

  const colWidths = [20, 20, 25, 30, 30, 15, 20, 20];
  const headers = ["Placa", "OE", "Destino", "Sep Congelado", "Sep Resfriado", "CXS", "Peso Total", "%"];
  const headerHeight = 10;
  const cellPadding = 2;
  const lineHeight = 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  const title = `RELATÓRIO DE PICKING - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  doc.text(title, startX, margin + 5);

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

  const dadosPDF = registrosCombinados
                    .filter(reg => !reg.emConferencia)
                    .sort((a, b) => b.percentual - a.percentual);

  dadosPDF.forEach((reg) => {
    const sepCongeladoPDF = reg.sepCongeladoFull && Object.keys(reg.congeladoPercentuais).length > 0 ? reg.sepCongeladoFull.split(", ").map(sep => {
      let percentual = reg.congeladoPercentuais[sep] || 0;
      let percentualExibicao = Math.round(percentual);
      return `${sep.split(" ")[0]} (${percentualExibicao}%)`;
    }).join(", ") : "";

    const sepResfriadoPDF = reg.sepResfriadoFull && Object.keys(reg.resfriadoPercentuais).length > 0 ? reg.sepResfriadoFull.split(", ").map(sep => {
      let percentual = reg.resfriadoPercentuais[sep] || 0;
      let percentualExibicao = Math.round(percentual);
      return `${sep.split(" ")[0]} (${percentualExibicao}%)`;
    }).join(", ") : "";

    let percentualOE = reg.percentual;
    let percentualOEExibicao = percentualOE === 100 ? 100 : Math.floor(percentualOE);

    const content = [
      reg.placa,
      reg.oe,
      reg.destino,
      sepCongeladoPDF,
      sepResfriadoPDF,
      reg.qtdeCxs,
      reg.pesoTotal,
      `${percentualOEExibicao}%`
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
      if (i === 0 || i === 1 || i === 7) {
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
        if (i === 0 || i === 1 || i === 7) {
          doc.text(textLines[j], currentX + colWidths[i] / 2, textY, { align: 'center' });
        } else {
          doc.text(textLines[j], currentX + cellPadding, textY);
        }
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

  doc.save(`Picking_${new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '')}.pdf`);
}

function init() {
  if (!lerGradeCompleta()) {
    exibirMensagemAlerta();
  } else {
    exibirAreaCSV();
  }
}

init();

document.getElementById('result').addEventListener('click', function(event) {
  if (event.target.closest('.copy-button')) {
    const button = event.target.closest('.copy-button');
    const oe = button.getAttribute('data-oe');
    navigator.clipboard.writeText(oe).then(() => {
      // Copiado com sucesso
    }).catch(err => {
      console.error('Erro ao copiar OE: ', err);
    });
  }
});
