const STORAGE_KEY = "checkbox_state_monitor";
let registrosCombinados = [];
let resetCriado = false;

function lerGradeCompleta() {
  return localStorage.getItem("gradeCompleta");
}

function exibirMensagemAlerta() {
  document.getElementById("mainContent").innerHTML =
    '<p class="alert"><i class="fa-solid fa-exclamation-triangle"></i> Nenhuma GRADE Encontrada, favor carregar a GRADE.</p>';
}

function exibirAreaCSV() {
  // Remove o botão RESET se existir
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
}

function exibirBotaoReset() {
  let btn = document.createElement("button");
  btn.id = "btnReset";
  btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> RESET';
  btn.addEventListener("click", () => {
    document.getElementById("result").innerHTML = "";
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
        congelado: { separadores: [], totalPeso: 0, totalEntregue: 0, totalCaixas: 0 },
        resfriado: { separadores: [], totalPeso: 0, totalEntregue: 0, totalCaixas: 0 }
      };
    }
    if (temperatura === "CONGELADO") {
      csvPorOE[oe].congelado.separadores.push(separador);
      csvPorOE[oe].congelado.totalPeso += peso;
      csvPorOE[oe].congelado.totalEntregue += entregue;
      csvPorOE[oe].congelado.totalCaixas += caixas;
    } else if (temperatura === "RESFRIADO") {
      csvPorOE[oe].resfriado.separadores.push(separador);
      csvPorOE[oe].resfriado.totalPeso += peso;
      csvPorOE[oe].resfriado.totalEntregue += entregue;
      csvPorOE[oe].resfriado.totalCaixas += caixas;
    }
  });
  
  for (let oe in csvPorOE) {
    let grupo = csvPorOE[oe];
    let totalPeso = grupo.congelado.totalPeso + grupo.resfriado.totalPeso;
    let totalEntregue = grupo.congelado.totalEntregue + grupo.resfriado.totalEntregue;
    grupo.finalPercentual = totalPeso > 0 ? Math.min(100, (totalEntregue / totalPeso) * 100) : 0;
    grupo.totalCaixas = grupo.congelado.totalCaixas + grupo.resfriado.totalCaixas;
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
    return {
      placa,
      oe: reg.OE ? reg.OE.trim() : "",
      destino,
      sepCongeladoFull: fullCongelado.join(", "),
      sepResfriadoFull: fullResfriado.join(", "),
      sepCongeladoDisplay: displayCongelado,
      sepResfriadoDisplay: displayResfriado,
      caixasSeparacao: totalCaixas,
      percentual,
      emConferencia: getCheckboxState(reg.OE ? reg.OE.trim() : "")
    };
  }).filter(item => item !== null);
  
  novosRegistros.forEach(novo => {
    let existente = registrosCombinados.find(r => r.oe === novo.oe);
    if (existente) { novo.emConferencia = existente.emConferencia; }
  });
  registrosCombinados = novosRegistros;
  
  renderizarTabela();
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
  let naoConferencia = registrosCombinados.filter(r => !r.emConferencia);
  naoConferencia.sort((a, b) => b.percentual - a.percentual);
  let emConferencia = registrosCombinados.filter(r => r.emConferencia);
  let registrosOrdenados = naoConferencia.concat(emConferencia);
  
  let html = '<table><thead><tr>' +
             '<th><i class="fa-solid fa-car"></i> Placa</th>' +
             '<th><i class="fa-solid fa-hashtag"></i> OE</th>' +
             '<th><i class="fa-solid fa-location-dot"></i> Destino</th>' +
             '<th><i class="fa-solid fa-snowflake"></i> Separador Congelado</th>' +
             '<th><i class="fa-solid fa-temperature-low"></i> Separador Resfriado</th>' +
             '<th><i class="fa-solid fa-box"></i> Caixas Separação</th>' +
             '<th><i class="fa-solid fa-percent"></i> %</th>' +
             '<th><i class="fa-solid fa-check"></i> EM CONFERÊNCIA</th>' +
             '</tr></thead><tbody>';
  registrosOrdenados.forEach(item => {
    let congeladoHTML = item.sepCongeladoDisplay ? `<span title="${item.sepCongeladoFull}">${item.sepCongeladoDisplay}</span>` : "";
    let resfriadoHTML = item.sepResfriadoDisplay ? `<span title="${item.sepResfriadoFull}">${item.sepResfriadoDisplay}</span>` : "";
    let progresso = `<div class="progress-container">
                       <div class="progress-bar" style="width: ${item.percentual.toFixed(2)}%; min-width: 2rem;">
                         ${item.percentual.toFixed(2)}%
                       </div>
                     </div>`;
    let linhaStyle = item.percentual >= 100 ? ' class="completo"' : "";
    html += `<tr${linhaStyle}>
              <td>${item.placa}</td>
             <td class="oe-cell">
    <span class="oe-text">${item.oe}</span>
    <button class="copy-button" data-oe="${item.oe}"><i class="fa-solid fa-copy"></i></button>
</td>
              <td>${item.destino}</td>
              <td>${congeladoHTML}</td>
              <td>${resfriadoHTML}</td>
              <td>${item.caixasSeparacao}</td>
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
    // Posiciona o botão PDF acima da área de resultados
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
  
  // Definindo as colunas para o PDF (omitindo a coluna EM CONFERÊNCIA)
  const colWidths = [20, 20, 30, 30, 30, 20, 20]; // colunas: OE, Placa, Destino, Sep Congelado, Sep Resfriado, Caixas, %
  const headers = ["OE", "Placa", "Destino", "Sep Congelado", "Sep Resfriado", "Caixas", "%"];
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
  
  // Filtra e ordena os dados para o PDF (excluindo os em conferência, ordenados por % decrescente)
  const dadosPDF = registrosCombinados
                    .filter(reg => !reg.emConferencia)
                    .sort((a, b) => b.percentual - a.percentual);
  
  dadosPDF.forEach((reg) => {
    const content = [
      reg.oe,
      reg.placa,
      reg.destino,
      reg.sepCongeladoDisplay,
      reg.sepResfriadoDisplay,
      reg.caixasSeparacao.toString(),
      reg.percentual.toFixed(1) + "%"
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
      // Não faz nada
    }).catch(err => {
      console.error('Erro ao copiar OE: ', err);
    });
  }
});