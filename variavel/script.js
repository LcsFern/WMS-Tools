document.addEventListener('DOMContentLoaded', () => {
    let inputData = document.getElementById('inputData');
    const inputContainer = document.getElementById('inputContainer');
    const resultsSection = document.getElementById('results');

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

        const productSummary = {};
        data.forEach(item => {
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

        const totalWeight = Object.values(productSummary).reduce((sum, item) => sum + item.totalWeight, 0);
        const totalBoxes = Object.values(productSummary).reduce((sum, item) => sum + item.boxCount, 0);
        const averageWeight = totalWeight / totalBoxes;

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
        Object.values(productSummary).forEach(item => {
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

        const qrZebra = qrcode(0, 'L');
        qrZebra.addData(averageWeight.toFixed(3).replace('.', ''));
        qrZebra.make();

        const qrSymbol = qrcode(0, 'L');
        qrSymbol.addData(averageWeight.toFixed(3));
        qrSymbol.make();

        document.getElementById('qrCodes').innerHTML = `
            <div class="qr-card">
                <h3>QR Code Zebra</h3>
                ${qrZebra.createImgTag(4)}
                <p>${averageWeight.toFixed(3).replace('.', '')}</p>
            </div>
            <div class="qr-card">
                <h3>QR Code Symbol</h3>
                ${qrSymbol.createImgTag(4)}
                <p>${averageWeight.toFixed(3)}</p>
            </div>
        `;

        inputContainer.innerHTML = `
            <button id="resetButton"><i class="fas fa-undo"></i> Reset</button>
        `;

        // Adicionar evento ao botão Reset
        document.getElementById('resetButton').addEventListener('click', resetData);
    }

    function resetData() {
        document.getElementById('filterResults').innerHTML = '';
        document.getElementById('qrCodes').innerHTML = '';
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
    }
});