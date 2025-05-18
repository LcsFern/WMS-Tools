const STORAGE_KEY = "estadoCheckboxMonitor";
const RESULT_STORAGE_KEY = "estadoMonitorResultados";
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
 <p>Carregue a GRADE no menu ao lado.</p>
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
  // Novos índices para grupo e tipo do peso
  const idxGrupo = cabecalho.findIndex(col => col === "grupo");
  const idxTipoPeso = cabecalho.findIndex(col => col === "tipo do peso");

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
    // Extraindo grupo e tipo do peso do CSV
    let grupoCsv = (idxGrupo >= 0 && cols[idxGrupo]) ? cols[idxGrupo].trim() : "";
    let tipoPeso = (idxTipoPeso >= 0 && cols[idxTipoPeso]) ? cols[idxTipoPeso].trim() : "";
    let peso = caixas * posicao;
    let entregue = peso * (percentual / 100);

    if (!csvPorOE[oe]) {
      csvPorOE[oe] = {
        congelado: { separadores: [], totalPeso: 0, totalEntregue: 0, totalCaixas: 0, separadoresDados: {}, pendentes: 0, pendentesDados: [] },
        resfriado: { separadores: [], totalPeso: 0, totalEntregue: 0, totalCaixas: 0, separadoresDados: {}, pendentes: 0, pendentesDados: [] }
      };
    }

    let grupo = temperatura === "CONGELADO" ? csvPorOE[oe].congelado : csvPorOE[oe].resfriado;
    if (temperatura === "CONGELADO" || temperatura === "RESFRIADO") {
      if (separador) {
        if (!grupo.separadores.includes(separador)) {
          grupo.separadores.push(separador);
          if (separadoresPorOE.has(separador) && separadoresPorOE.get(separador).percentual < 100 && separadoresPorOE.get(separador).oe !== oe) {
            console.warn(`Separador ${separador} duplicado em OE ${oe} e ${separadoresPorOE.get(separador).oe}`);
          }
        }
        if (!grupo.separadoresDados[separador]) {
          grupo.separadoresDados[separador] = [];
        }
        grupo.separadoresDados[separador].push({ peso, entregue, caixas, posicao, grupoCsv, tipoPeso, percentual });
        separadoresPorOE.set(separador, { oe, percentual });
      } else {
        // Sem separador: trata como carga pendente
        grupo.pendentes += 1;
        grupo.pendentesDados.push({ caixas, posicao, grupoCsv, tipoPeso, percentual });
      }
      grupo.totalPeso += peso;
      grupo.totalEntregue += entregue;
      grupo.totalCaixas += caixas;
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
    if (!grupo.congelado.separadores.length &&
        !grupo.resfriado.separadores.length &&
        grupo.congelado.pendentes === 0 &&
        grupo.resfriado.pendentes === 0) return null;
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
      pendentesResfriado: grupo.resfriado.pendentes,
      // Armazena os dados detalhados das cargas pendentes
      pendentesCongeladoDados: grupo.congelado.pendentesDados || [],
      pendentesResfriadoDados: grupo.resfriado.pendentesDados || [],
      // Mantém os arrays completos para uso nos tooltips dos separadores
      congeladoDados: grupo.congelado.separadoresDados,
      resfriadoDados: grupo.resfriado.separadoresDados
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
    '<th><i class="fa-solid fa-box"></i> CXS Separação (Total) </th>' +
    '<th><i class="fa-solid fa-boxes"></i>Cxs Total</th>' +
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
        let infoObj = (item.congeladoDados[sep] && item.congeladoDados[sep][0]) ? item.congeladoDados[sep][0] : {};
        // Adiciona style inline para garantir alinhamento centralizado
        let tooltipContent = `<div style="text-align: center;"><strong>${sep} (${percentualExibicao}%)</strong><br>Caixas: ${infoObj.caixas || '-'}<br>Posições: ${infoObj.posicao || '-'}<br>Grupo: ${infoObj.grupoCsv || '-'}<br>Tipo do Peso: ${infoObj.tipoPeso || '-'}</div>`;
        return `<span class="separador-tooltip-wrapper">${displaySeparadores[index]} ${progresso}<div class="custom-tooltip">${tooltipContent}</div></span>`;
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
        let infoObj = (item.resfriadoDados[sep] && item.resfriadoDados[sep][0]) ? item.resfriadoDados[sep][0] : {};
        let tooltipContent = `<div style="text-align: center;"><strong>${sep} (${percentualExibicao}%)</strong><br>Caixas: ${infoObj.caixas || '-'}<br>Posições: ${infoObj.posicao || '-'}<br>Grupo: ${infoObj.grupoCsv || '-'}<br>Tipo do Peso: ${infoObj.tipoPeso || '-'}</div>`;
        return `<span class="separador-tooltip-wrapper">${displaySeparadores[index]} ${progresso}<div class="custom-tooltip">${tooltipContent}</div></span>`;
      }).join(", ");
    }

    let percentualOE = item.percentual;
    let percentualOEExibicao = percentualOE === 100 ? 100 : Math.floor(percentualOE);
    let progresso = `<div class="progress-container main-progress">
      <div class="progress-bar" style="width: ${percentualOEExibicao}%; --progress-width: ${percentualOEExibicao}%;" data-percent="${percentualOEExibicao}%"></div>
    </div>`;

    let linhaStyle = percentualOE === 100 ? ' class="completo"' : "";

    // Construindo o tooltip para as cargas pendentes
    let pendentesTotal = item.pendentesCongelado + item.pendentesResfriado;
    let pendentesHTML = "";
    if (pendentesTotal > 0) {
      let pendingDetails = [];
      // Primeira linha: total de pendentes para cada grupo
      pendingDetails.push(`<strong>Congelado: ${item.pendentesCongelado} | Resfriado: ${item.pendentesResfriado}</strong>`);
      if (item.pendentesCongelado > 0) {
        pendingDetails.push("<br><strong>Pendentes - CONGELADO:</strong>");
        item.pendentesCongeladoDados.forEach((data, idx) => {
          pendingDetails.push(`<br>#${idx+1}: Caixas: ${data.caixas || '-'}, Posições: ${data.posicao || '-'}, Grupo: ${data.grupoCsv || '-'}, Tipo do Peso: ${data.tipoPeso || '-'}`);
        });
      }
      if (item.pendentesResfriado > 0) {
        pendingDetails.push("<br><strong>Pendentes - RESFRIADO:</strong>");
        item.pendentesResfriadoDados.forEach((data, idx) => {
          pendingDetails.push(`<br>#${idx+1}: Caixas: ${data.caixas || '-'}, Posições: ${data.posicao || '-'}, Grupo: ${data.grupoCsv || '-'}, Tipo do Peso: ${data.tipoPeso || '-'}`);
        });
      }
      let tooltipPendingContent = pendingDetails.join("");
      pendentesHTML = `<span class="pendentes-column">
        <span class="pendentes-indicator separador-tooltip-wrapper">
          P${pendentesTotal}
          <div class="custom-tooltip">${tooltipPendingContent}</div>
        </span>
      </span>`;
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

  let searchInputField = document.getElementById("searchInput");
  if (searchInputField) {
    searchInputField.addEventListener("input", function () {
      let filter = this.value.toLowerCase();
      let rows = document.querySelectorAll("#result table tbody tr");
      rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(filter) ? "" : "none";
      });
    });
  }

  const checkboxes = resultDiv.querySelectorAll("input[type='checkbox']");
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener("change", function () {
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
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  // --- CONFIGURAÇÕES GERAIS DE LAYOUT ---
  const pageW     = doc.internal.pageSize.getWidth();
  const pageH     = doc.internal.pageSize.getHeight();
  const margin    = 10;
  const startX    = margin;
  const startY    = margin + 12;              // Y inicial do cabeçalho
  const colWidths = [20, 20, 25, 30, 30, 15, 20, 20];
  const headers   = ["Placa","OE","Destino","Sep Cong.","Sep Resf.","Caixas","Peso","%"];
  const headerH   = 10;
  const cellPad   = 2;
  const lineH     = 7;

  // --- DESENHA TÍTULO NA PRIMEIRA PÁGINA ---
  (function desenharTitulo() {
    const agora = new Date();
    const data  = agora.toLocaleDateString();
    const hora  = agora.toLocaleTimeString();
    doc.setFont('helvetica','bold');
    doc.setFontSize(14);
    doc.setTextColor(0,0,0);
    doc.text(`RELATÓRIO DE PICKING - ${data} ${hora}`, startX, margin + 5);
  })();

  // --- DESENHA O CABEÇALHO (SEMPRE MESMO ESTILO) ---
  function desenharCabecalho(yPos) {
    let x = startX;
    for (let i = 0; i < headers.length; i++) {
      // 1) reset total de estilo antes de cada célula
      doc.setDrawColor(0,0,0);              // cor da borda
      doc.setFillColor(200,200,200);        // cor do fundo
      doc.setTextColor(0,0,0);              // cor do texto
      doc.setFont('helvetica','bold');      // fonte em negrito
      doc.setFontSize(10);                  // tamanho do texto

      // 2) desenha retângulo preenchido + contorno
      //    'FD' = Fill then Draw (preencher e depois traçar borda)
      doc.rect(x, yPos, colWidths[i], headerH, 'FD');

      // 3) escreve texto centralizado
      doc.text(
        headers[i],
        x + colWidths[i] / 2,
        yPos + headerH / 2 + 3,
        { align: 'center' }
      );

      x += colWidths[i];
    }
  }

  // Primeiro cabeçalho na PÁGINA 1
  desenharCabecalho(startY);
  let cursorY = startY + headerH;

  // --- PREPARA DADOS PARA IMPRESSÃO ---
  const dadosPDF = registrosCombinados
    .filter(r => !r.emConferencia)
    .sort((a,b) => b.percentual - a.percentual);

  doc.setFontSize(9);

  // --- DESENHA LINHAS DE DADOS ---
  dadosPDF.forEach(reg => {
    // Monta strings de congelado/resfriado
    let sepCong = "";
    if (reg.sepCongeladoFull && Object.keys(reg.congeladoPercentuais).length) {
      sepCong = reg.sepCongeladoFull.split(", ").map(item => {
        const pct = Math.round(reg.congeladoPercentuais[item]||0);
        return `${item.split(" ")[0]} (${pct}%)`;
      }).join(", ");
    }
    if (reg.pendentesCongelado > 0) {
      sepCong += (sepCong ? ", " : "") + `${reg.pendentesCongelado} PEND.`;
    }
    let sepResf = "";
    if (reg.sepResfriadoFull && Object.keys(reg.resfriadoPercentuais).length) {
      sepResf = reg.sepResfriadoFull.split(", ").map(item => {
        const pct = Math.round(reg.resfriadoPercentuais[item]||0);
        return `${item.split(" ")[0]} (${pct}%)`;
      }).join(", ");
    }
    if (reg.pendentesResfriado > 0) {
      sepResf += (sepResf ? ", " : "") + `${reg.pendentesResfriado} PEND.`;
    }

    const pctOE = reg.percentual === 100
      ? 100
      : Math.floor(reg.percentual);

    const linha = [
      reg.placa,
      reg.oe,
      reg.destino,
      sepCong,
      sepResf,
      reg.qtdeCxs,
      reg.pesoTotal,
      `${pctOE}%`
    ];

    // Calcula altura dinâmica da linha
    let maxLines = 1;
    linha.forEach((txt,i) => {
      const partes = doc.splitTextToSize(txt.toString(), colWidths[i] - 2*cellPad);
      if (partes.length > maxLines) maxLines = partes.length;
    });
    const rowH = maxLines * lineH + 2 * cellPad;

    // Se passar do rodapé, cria nova página e repinta cabeçalho
    if (cursorY + rowH > pageH - margin) {
      doc.addPage();
      desenharCabecalho(startY);
      cursorY = startY + headerH;
    }

    // Desenha cada célula de dados
    let x = startX;
    for (let i = 0; i < linha.length; i++) {
      // Estilo diferenciado para colunas 0,1 e última
      if ([0,1,7].includes(i)) {
        doc.setFillColor(240,240,240);
        doc.setFont('helvetica','bold');
      } else {
        doc.setFillColor(255,255,255);
        doc.setFont('helvetica','normal');
      }
      doc.setDrawColor(0,0,0);

      // desenha retângulo (preenchimento + contorno)
      doc.rect(x, cursorY, colWidths[i], rowH, 'FD');

      // escreve texto ajustado
      const partes = doc.splitTextToSize(linha[i].toString(), colWidths[i] - 2*cellPad);
      partes.forEach((t, idx) => {
        const yTexto = cursorY + cellPad + (idx+1) * lineH - lineH/2;
        if ([0,1,7].includes(i)) {
          doc.text(t, x + colWidths[i]/2, yTexto, { align: 'center' });
        } else {
          doc.text(t, x + cellPad, yTexto);
        }
      });

      x += colWidths[i];
    }

    cursorY += rowH;
  });

  // --- NUMERAÇÃO DE PÁGINAS ---
  const totalPag = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(0,0,0);
  for (let p = 1; p <= totalPag; p++) {
    doc.setPage(p);
    doc.text(`Página ${p} de ${totalPag}`, margin, pageH - 5);
  }

  // --- SALVAR ARQUIVO ---
  const ts = new Date().toISOString().slice(0,16).replace(/[-T:]/g,'');
  doc.save(`Picking_${ts}.pdf`);
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
