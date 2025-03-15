let dadosGrade = [];
    let placaToOE = new Map();
    let placaAntigaMap = new Map();
    let gradeOriginal = []; // Armazena cópia da grade processada

    function parsePeso(valor) {
      return parseFloat(valor.toString().replace(/[\.]/g, '').replace(/[,]/g, '.'));
    }

    function salvarEstado() {
      localStorage.setItem('gradeExpedicao', JSON.stringify({
        dadosGrade: dadosGrade.map(oe => ({...oe, PLACAS: [...oe.PLACAS]})),
        placaMap: [...placaToOE],
        placaAntigaMap: [...placaAntigaMap],
        gradeOriginal: gradeOriginal.map(oe => ({...oe, PLACAS: [...oe.PLACAS]}))
      }));
    }

    function carregarGradeCache() {
      const cache = localStorage.getItem('gradeExpedicao');
      if (cache) {
        try {
          const { dadosGrade: dg, placaMap, placaAntigaMap: pam, gradeOriginal: go } = JSON.parse(cache);
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

    function resetTudo() {
      localStorage.clear();
      dadosGrade = [];
      gradeOriginal = [];
      placaToOE = new Map();
      placaAntigaMap = new Map();
      document.getElementById('gradeSection').classList.remove('hidden');
      document.getElementById('csvSection').classList.add('hidden');
      document.getElementById('resetBtn').classList.add('hidden');
      document.getElementById('resetCsvBtn').classList.add('hidden');
      document.getElementById('exportBtn').classList.add('hidden');
      document.getElementById('tabelaContainer').classList.add('hidden');
      document.getElementById('excelData').value = '';
      document.getElementById('csvData').value = '';
    }

    function resetCSV() {
      // Restaura os dados da grade original
      dadosGrade = gradeOriginal.map(oe => ({
        ...oe,
        PLACAS: new Set(oe.PLACAS)
      }));
      document.getElementById('csvSection').classList.remove('hidden');
      document.getElementById('csvData').value = '';
      document.getElementById('tabelaContainer').classList.add('hidden');
      document.getElementById('exportBtn').classList.add('hidden');
      salvarEstado();
      atualizarTabela();
    }

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
      gradeOriginal = dadosGrade.map(oe => ({
        ...oe,
        PLACAS: new Set(oe.PLACAS)
      }));
      salvarEstado();
      document.getElementById('gradeSection').classList.add('hidden');
      document.getElementById('csvSection').classList.remove('hidden');
      document.getElementById('resetBtn').classList.remove('hidden');
      document.getElementById('resetCsvBtn').classList.remove('hidden');
    }

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
      document.getElementById('tabelaContainer').innerHTML = html;
      document.getElementById('tabelaContainer').classList.remove('hidden');
    }

    // Função de exportar para PDF com bordas, layout ajustado e numeração de páginas
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
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const title = `RELATÓRIO DE SEPARAÇÃO - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      doc.text(title, startX, startY - 5);
      
      const headers = ["OE", "PLACAS", "DESTINO", "ENT", "CX", "PESO KG", "%", "PEGO"];
      doc.setFontSize(10);
      let currentX = startX;
      const headerHeight = 10;
      for (let i = 0; i < headers.length; i++) {
        doc.rect(currentX, startY, colWidths[i], headerHeight);
        doc.text(headers[i], currentX + cellPadding, startY + headerHeight/2 + 3);
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
          " " // espaço para checkbox
        ];
        let maxLines = 1;
        for (let i = 0; i < content.length; i++) {
          const textLines = doc.splitTextToSize(content[i].toString(), colWidths[i] - 2 * cellPadding);
          maxLines = Math.max(maxLines, textLines.length);
        }
        const rowHeight = maxLines * lineHeight + 2 * cellPadding;
        if (y + rowHeight > 200) {
          doc.addPage();
          y = startY;
          currentX = startX;
          for (let i = 0; i < headers.length; i++) {
            doc.rect(currentX, y, colWidths[i], headerHeight);
            doc.text(headers[i], currentX + cellPadding, y + headerHeight/2 + 3);
            currentX += colWidths[i];
          }
          y += headerHeight;
        }
        currentX = startX;
        for (let i = 0; i < content.length; i++) {
          doc.rect(currentX, y, colWidths[i], rowHeight);
          let textLines = doc.splitTextToSize(content[i].toString(), colWidths[i] - 2 * cellPadding);
          for (let j = 0; j < textLines.length; j++) {
            let textY = y + cellPadding + (j + 1) * lineHeight - (lineHeight / 2);
            doc.text(textLines[j], currentX + cellPadding, textY);
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
        doc.text(`Página ${i} de ${pageCount}`, margin, 205);
      }
      
      doc.save(`Separacao_${new Date().toISOString().slice(0,16).replace(/[-T:]/g,'')}.pdf`);
    }

    function copiarOE(texto) {
      navigator.clipboard.writeText(texto);
    }

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

    window.onload = carregarGradeCache;