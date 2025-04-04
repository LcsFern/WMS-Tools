document.addEventListener('DOMContentLoaded', () => {
    let inputData = document.getElementById('inputData');
    const inputContainer = document.getElementById('inputContainer');
    const resultsSection = document.getElementById('results');
    const pdfPreview = document.getElementById('pdfPreview');
    const pdfContent = document.getElementById('pdfContent');
    let processedData = [];
    let aggregatedData = []; // Dados agregados para exibição na tabela

    if (!inputData || !inputContainer || !resultsSection) {
        console.error('Um ou mais elementos não foram encontrados no DOM.');
        return;
    }

    // Processar automaticamente ao colar
    inputData.addEventListener('paste', (e) => {
        setTimeout(() => {
            processData();
        }, 0);
    });

    function processData() {
        const input = inputData.value;
        if (!input.trim()) return;

        const lines = input.split('\n');
        const headers = lines[0].split('\t');
        const data = lines.slice(1).map(line => {
            const values = line.split('\t');
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index];
                return obj;
            }, {});
        });

        // Filtrar apenas os itens com código de produto e peso válidos
        processedData = data.filter(item => 
            item['COD. PRODUTO'] && 
            item['PESO LIQ.'] && 
            !isNaN(parseFloat(item['PESO LIQ.'].replace(',', '.')))
        );

        // Agregação para exibição na tabela
        const productSummary = {};
        processedData.forEach(item => {
            if (!item['COD. PRODUTO']) return;
            const key = `${item['COD. PRODUTO']}_${item['DT PRODUÇÃO']}`;
            if (!productSummary[key]) {
                productSummary[key] = {
                    code: item['COD. PRODUTO'],
                    name: item['PRODUTO'],
                    productionDate: item['DT PRODUÇÃO'],
                    boxCount: 0,
                    totalWeight: 0
                };
            }
            productSummary[key].boxCount += parseInt(item['QTD CX']) || 0;
            productSummary[key].totalWeight += parseFloat(item['PESO LIQ.'].replace(',', '.')) || 0;
        });

        // Armazena os dados agregados para exibição
        aggregatedData = Object.values(productSummary);

        const totalWeight = aggregatedData.reduce((sum, item) => sum + item.totalWeight, 0);
        let html = `
            <table>
                <tr>
                    <th>Cód. Produto</th>
                    <th>Produto</th>
                    <th>Data Produção</th>
                    <th>Qtd. Caixas</th>
                    <th>Peso Total</th>
                </tr>
        `;
        aggregatedData.forEach(item => {
            html += `
                <tr>
                    <td>${item.code}</td>
                    <td>${item.name}</td>
                    <td>${item.productionDate}</td>
                    <td>${item.boxCount}</td>
                    <td>${item.totalWeight.toFixed(3).replace('.', ',')}</td>
                </tr>
            `;
        });
        html += `</table>
            <p style="margin-top: 1rem;">Peso Líquido Total: ${totalWeight.toFixed(3).replace('.', ',')}</p>
        `;

        document.getElementById('filterResults').innerHTML = html;
        resultsSection.classList.remove('hidden');

        inputContainer.innerHTML = `
            <button id="resetButton"><i class="fas fa-undo"></i> Reset</button>
        `;

        // Adicionar evento ao botão Reset
        document.getElementById('resetButton').addEventListener('click', resetData);
        
        // Adicionar evento ao botão Exportar PDF
        document.getElementById('exportPdfBtn').addEventListener('click', generatePDF);
    }

    function resetData() {
        document.getElementById('filterResults').innerHTML = '';
        pdfPreview.classList.add('hidden');
        pdfContent.innerHTML = '';
        resultsSection.classList.add('hidden');
        inputContainer.innerHTML = `
            <textarea id="inputData" placeholder="Cole os dados do Excel aqui..."></textarea>
        `;

        inputData = document.getElementById('inputData');
        inputData.addEventListener('paste', (e) => {
            setTimeout(() => {
                processData();
            }, 0);
        });
        
        processedData = [];
        aggregatedData = [];
    }
    
    // A exportação do PDF utiliza cada linha individual dos dados (processedData)
    // para gerar um QR code para cada peso, mantendo a formatação para 16 QR codes por página (grade 4x4).
    function generatePDF() {
        if (!processedData.length) {
            alert('Nenhum dado para exportar.');
            return;
        }
        
        console.log(`Total de itens para gerar QR codes: ${processedData.length}`);
        
        // Criar um elemento temporário oculto para renderizar o conteúdo do PDF
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '-9999px';
        document.body.appendChild(tempDiv);
        
        // Criar container de grade para o layout do PDF
        const pdfGrid = document.createElement('div');
        pdfGrid.className = 'pdf-grid';
        tempDiv.appendChild(pdfGrid);
        
        // Gerar o conteúdo do PDF com os QR codes individuais para cada peso
        processedData.forEach(item => {
            if (!item['PESO LIQ.']) return;
            
            const weight = parseFloat(item['PESO LIQ.'].replace(',', '.'));
            if (isNaN(weight)) return;
            
            const weightForQR = weight.toFixed(3); // Ex: "19.130"
            
            // Criar QR code para este item
            const qrCode = qrcode(0, 'L');
            qrCode.addData(weightForQR);
            qrCode.make();
            
            // Criar card do produto com os dados individuais
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <div class="product-info">
                    <h3>${item['PRODUTO'] || 'Sem nome'}</h3>
                    <p><strong>Código:</strong> ${item['COD. PRODUTO'] || 'N/A'}</p>
                    <p><strong>Data Prod:</strong> ${item['DT PRODUÇÃO'] || 'N/A'}</p>
                    <p><strong>Peso:</strong> ${weight.toFixed(3).replace('.', ',')}</p>
                </div>
                <div class="product-qr">
                    ${qrCode.createImgTag(2)}
                    <p>${weightForQR}</p>
                </div>
            `;
            
            pdfGrid.appendChild(productCard);
        });
        
        // Gerar PDF sem visualização prévia, paginando com 16 QR codes (4x4) por página
        window.jspdf.jsPDF = window.jspdf.jsPDF;
        
        const generatePDFFromElements = async () => {
            const doc = new jspdf.jsPDF('p', 'mm', 'a4');
            
            // Obter os cards gerados
            const cards = tempDiv.querySelectorAll('.product-card');
            console.log(`Cards gerados: ${cards.length}`);
            
            if (cards.length === 0) {
                alert('Nenhum item com peso válido encontrado para gerar o PDF.');
                document.body.removeChild(tempDiv);
                return;
            }
            
            // Configurações para a grade 4x4 (16 por página)
            const pageWidth = 210; // Largura A4 em mm
            const pageHeight = 297; // Altura A4 em mm
            const marginTop = 10;
            const marginLeft = 10;
            const cardWidth = 40;  // Largura do card
            const cardHeight = 50; // Altura do card
            const gapX = 10;
            const gapY = 10;
            const cardsPerPage = 16;
            const columns = 4; // 4 colunas
            
            for (let i = 0; i < cards.length; i++) {
                if (i > 0 && i % cardsPerPage === 0) {
                    doc.addPage();
                }
                const indexOnPage = i % cardsPerPage;
                const row = Math.floor(indexOnPage / columns);
                const col = indexOnPage % columns;
                const currentX = marginLeft + col * (cardWidth + gapX);
                const currentY = marginTop + row * (cardHeight + gapY);
                
                try {
                    const canvas = await html2canvas(cards[i], {
                        scale: 2,
                        backgroundColor: null
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    doc.addImage(imgData, 'PNG', currentX, currentY, cardWidth, cardHeight);
                } catch (error) {
                    console.error(`Erro ao processar card ${i}:`, error);
                }
            }
            
            doc.save('pesos_variaveis.pdf');
            document.body.removeChild(tempDiv);
        };
        
        generatePDFFromElements();
    }
});
