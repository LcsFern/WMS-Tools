document.addEventListener('DOMContentLoaded', function() {
    // Elementos DOM
    const listaPicking = document.getElementById('listaPicking');
    const processarBtn = document.getElementById('processar');
    const limparBtn = document.getElementById('limpar');
    const resetBtn = document.getElementById('resetBtn');
    const statusBar = document.getElementById('status');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const searchInput = document.getElementById('searchInput');
    const tabelaBody = document.getElementById('tabelaBody');
    const tabCongelados = document.getElementById('tabCongelados');
    const tabResfriados = document.getElementById('tabResfriados');
    const tabTodos = document.getElementById('tabTodos');
    const resultsSection = document.querySelector('.results-section');
    const inputSection = document.querySelector('.input-section');
    
    // Elementos do resumo
    const totalProdutos = document.getElementById('totalProdutos');
    const totalCaixas = document.getElementById('totalCaixas');
    const posicoesCongelado = document.getElementById('posicoesCongelado');
    const posicoesResfriado = document.getElementById('posicoesResfriado');
    const totalPosicoes = document.getElementById('totalPosicoes');

    // Estado da aplicação
    let processedData = {
        produtos: [],
        congelados: [],
        resfriados: [],
        todosProds: []
    };
    
    let gradeCompleta = []; // Variável movida para escopo global
        // Tenta carregar a gradeCompleta do localStorage assim que o DOM estiver pronto.
    // Isso garante que, se a gradeCompleta já foi salva anteriormente,
    // ela esteja disponível para funções como renderizarTabela quando
    // os dados de 'tratadin' são carregados por verificarDadosSalvos() após um F5.
    try {
        const gradeCompletaSalvaStr = localStorage.getItem('gradeCompleta'); // Pega a string da grade salva
        if (gradeCompletaSalvaStr) {
            gradeCompleta = JSON.parse(gradeCompletaSalvaStr); // Converte a string de volta para objeto/array e guarda na variável
            // console.log('Sucesso: gradeCompleta carregada do localStorage na inicialização.'); // Linha opcional para verificar no console se carregou
        } else {
            // console.warn('Aviso: gradeCompleta não encontrada no localStorage durante a inicialização.'); // Linha opcional
        }
    } catch (e) {
        // Se der algum erro ao tentar carregar ou converter (ex: se o dado no localStorage estiver corrompido)
        console.error('Erro ao carregar ou fazer parse da gradeCompleta do localStorage na inicialização:', e);
        gradeCompleta = []; // Garante que gradeCompleta seja um array vazio para evitar mais erros.
    }
    let currentTab = 'todos';

    // Event Listeners
    processarBtn.addEventListener('click', processarDados);
    limparBtn.addEventListener('click', limparDados);
    resetBtn.addEventListener('click', limparDados);
    searchInput.addEventListener('input', filtrarTabela);
    
    listaPicking.addEventListener('paste', function() {
        setTimeout(processarDados, 100);
    });
    
    tabCongelados.addEventListener('click', () => mudarTab('congelados'));
    tabResfriados.addEventListener('click', () => mudarTab('resfriados'));
    tabTodos.addEventListener('click', () => mudarTab('todos'));

    // Funções principais
    async function processarDados() {
        const pickingData = listaPicking.value.trim();
        
        if (!pickingData) {
            mostrarNotificacao('Erro', 'Insira dados da lista de picking', 'error');
            return;
        }

        try {
            mostrarLoading(true);
            atualizarStatus('Processando dados...', false);
            
            const gradeCompletaLocal = await obterGradeCompleta();
            const produtosData = await obterProdutosJson();
            
            const linhas = pickingData.split('\n');
            const cabecalhos = linhas[0].split('\t');
            
            let pickingRows = [];
            
            for (let i = 1; i < linhas.length; i++) {
                if (!linhas[i].trim()) continue;
                
                const valores = linhas[i].split('\t');
                let row = {};
                
                cabecalhos.forEach((header, index) => {
                    row[header] = valores[index] || '';
                });
                
                pickingRows.push(row);
            }
            
            const produtosAgrupados = agruparProdutos(pickingRows);
            const produtosProcessados = calcularPosicoesEPlacas(produtosAgrupados, produtosData, gradeCompletaLocal);
            
            produtosProcessados.sort((a, b) => b.quantidade - a.quantidade);
            
            const { congelados, resfriados } = separarPorTipo(produtosProcessados);
            
            congelados.sort((a, b) => b.quantidade - a.quantidade);
            resfriados.sort((a, b) => b.quantidade - a.quantidade);
            
            processedData = {
                produtos: produtosProcessados,
                congelados: congelados,
                resfriados: resfriados,
                todosProds: produtosProcessados
            };
            
            localStorage.setItem('tratadin', JSON.stringify(processedData));
            
            atualizarResumo(produtosProcessados, congelados, resfriados);
            renderizarTabela(produtosProcessados);
            tabTodos.classList.add('active');
            tabCongelados.classList.remove('active');
            tabResfriados.classList.remove('active');
            
            resultsSection.style.display = 'flex';
            listaPicking.style.display = 'none';
            processarBtn.style.display = 'none';
            limparBtn.style.display = 'none';
            resetBtn.style.display = 'block';
            resetBtn.classList.add('btn-primary');
            resetBtn.classList.remove('btn-secondary');
            
            atualizarStatus('Dados processados com sucesso!', false);
            mostrarNotificacao('Sucesso', 'Dados processados com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao processar dados:', error);
            atualizarStatus(`Erro ao processar dados: ${error.message}`, true);
            mostrarNotificacao('Erro', `Erro ao processar dados: ${error.message}`, 'error');
        } finally {
            mostrarLoading(false);
        }
    }

    function limparDados() {
        listaPicking.value = '';
        tabelaBody.innerHTML = '';
        
        processedData = {
            produtos: [],
            congelados: [],
            resfriados: [],
            todosProds: []
        };
        
        totalProdutos.textContent = '-';
        totalCaixas.textContent = '-';
        posicoesCongelado.textContent = '-';
        posicoesResfriado.textContent = '-';
        totalPosicoes.textContent = '-';
        
        statusBar.classList.remove('active', 'error');
        statusBar.textContent = '';
        
        resultsSection.style.display = 'none';
        listaPicking.style.display = 'block';
        processarBtn.style.display = 'inline-flex';
        limparBtn.style.display = 'inline-flex';
        resetBtn.style.display = 'none';
        
        localStorage.removeItem('tratadin');
        
        mostrarNotificacao('Info', 'Dados limpos', 'success');
    }

    function mudarTab(tab) {
        currentTab = tab;
        
        [tabTodos, tabCongelados, tabResfriados].forEach(elem => {
            elem.classList.remove('active');
        });
        
        if (tab === 'todos') {
            tabTodos.classList.add('active');
            renderizarTabela(processedData.todosProds);
        } else if (tab === 'congelados') {
            tabCongelados.classList.add('active');
            renderizarTabela(processedData.congelados);
        } else if (tab === 'resfriados') {
            tabResfriados.classList.add('active');
            renderizarTabela(processedData.resfriados);
        }
        
        filtrarTabela();
    }

    function filtrarTabela() {
        const termo = searchInput.value.toLowerCase().trim();
        let produtos = [];
        
        if (currentTab === 'todos') {
            produtos = processedData.todosProds;
        } else if (currentTab === 'congelados') {
            produtos = processedData.congelados;
        } else if (currentTab === 'resfriados') {
            produtos = processedData.resfriados;
        }
        
        if (!termo) {
            renderizarTabela(produtos);
            return;
        }
        
        const produtosFiltrados = produtos.filter(produto => 
            produto.codigo.toLowerCase().includes(termo) || 
            produto.nome.toLowerCase().includes(termo) ||
            produto.placas.some(placa => placa.toLowerCase().includes(termo))
        );
        
        renderizarTabela(produtosFiltrados);
    }

    // Função para copiar código do produto
    function copiarCodigo(codigo) {
        navigator.clipboard.writeText(codigo).then(() => {
            mostrarNotificacao('Sucesso', `Código ${codigo} copiado para a área de transferência`, 'success');
        }).catch(err => {
            console.error('Erro ao copiar: ', err);
            mostrarNotificacao('Erro', 'Não foi possível copiar o código', 'error');
        });
    }

    // Nova função para copiar texto genérico
    function copiarTexto(texto, descricao) {
        navigator.clipboard.writeText(texto).then(() => {
            mostrarNotificacao('Sucesso', `${descricao} copiado para a área de transferência`, 'success');
        }).catch(err => {
            console.error('Erro ao copiar: ', err);
            mostrarNotificacao('Erro', 'Não foi possível copiar o texto', 'error');
        });
    }

    // Funções auxiliares
    async function obterGradeCompleta() {
        try {
            const gradeCompletaStr = localStorage.getItem('gradeCompleta');
            if (!gradeCompletaStr) {
                throw new Error('Grade completa não encontrada no localStorage');
            }
            
            gradeCompleta = JSON.parse(gradeCompletaStr); // Atribui ao escopo global
            return gradeCompleta;
        } catch (error) {
            console.error('Erro ao obter Grade', error);
            throw new Error('Salve a grade completa antes de processar os dados');
        }
    }

    async function obterProdutosJson() {
        try {
            const response = await fetch('produtos.json');
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter produtos.json:', error);
            throw new Error('Erro ao obter dados de produtos');
        }
    }

    function agruparProdutos(pickingRows) {
        const produtos = {};
        
        pickingRows.forEach(row => {
            const codProduto = row['COD. PRODUTO'];
            const quantidade = parseInt(row['QTDE']) || 0;
            const origem = row['ORIGEM'] || '';
            const oe = row['OE'] || '';
            const nomeProduto = row['PRODUTO'] || '';
            const temperatura = row['TEMPERATURA'] || '';
            
            if (!codProduto) return;
            
            if (!produtos[codProduto]) {
                produtos[codProduto] = {
                    codigo: codProduto,
                    nome: nomeProduto,
                    quantidade: 0,
                    origem: origem,
                    temperatura: temperatura,
                    oes: new Set(),
                    tipo: origem.startsWith('C04') ? 'resfriado' : 'congelado'
                };
            }
            
            produtos[codProduto].quantidade += quantidade;
            produtos[codProduto].oes.add(oe);
        });
        
        return Object.values(produtos);
    }

    function calcularPosicoesEPlacas(produtosAgrupados, produtosData, gradeCompleta) {
        return produtosAgrupados.map(produto => {
            const infoProduto = produtosData.find(p => p['COD. PRODUTO'] === produto.codigo) || {
                'CX/PALETE': '0',
                'PRODUTO': produto.nome
            };
            
            const caixasPorPalete = parseInt(infoProduto['CX/PALETE']) || 1;
            let numPaletes = 0;
            
            if (caixasPorPalete > 0) {
                numPaletes = parseFloat((produto.quantidade / caixasPorPalete).toFixed(1));
                if (numPaletes === 0 && produto.quantidade > 0) {
                    numPaletes = 0.1;
                }
            }
            
            const posicoesDinamicas = Math.ceil(produto.quantidade / caixasPorPalete) || 1;
            
            const placas = new Set();
            produto.oes.forEach(oe => {
                const gradeItem = gradeCompleta.find(item => item.OE === oe);
                if (gradeItem && gradeItem['PLACA ROTEIRIZADA']) {
                    placas.add(gradeItem['PLACA ROTEIRIZADA']);
                }
            });
            
            return {
                ...produto, // Copia as propriedades originais de 'produto' (codigo, nome inicial, quantidade, origem, temperatura, oes (Set), tipo)
                nome: infoProduto['PRODUTO'] || produto.nome, // Atualiza o nome se um melhor for encontrado em produtosData
                oes: Array.from(produto.oes || []), // PONTO CHAVE: Converte o Set 'oes' para um Array ANTES de salvar. Adicionado '|| []' para segurança extra.
                // As propriedades 'codigo' e 'tipo' já estão corretas e incluídas pelo ...produto.
                // A redefinição explícita delas como no código original ('codigo: produto.codigo', 'tipo: produto.origem...') é redundante aqui.
                caixasPorPalete, // Número de caixas por palete, conforme calculado
                paletes: numPaletes, // Número de paletes, conforme calculado
                posicoesDinamicas, // Número de posições dinâmicas, conforme calculado
                placas: Array.from(placas) // Garante que 'placas' também seja um array (já estava assim)
            };
        });
    }

    function separarPorTipo(produtos) {
        const congelados = produtos.filter(p => p.tipo === 'congelado');
        const resfriados = produtos.filter(p => p.tipo === 'resfriado');
        
        return { congelados, resfriados };
    }

    function atualizarResumo(produtos, congelados, resfriados) {
        const totalProds = produtos.length;
        const totalQtde = produtos.reduce((sum, p) => sum + p.quantidade, 0);
        const posicoesCongeladoTotal = congelados.reduce((sum, p) => sum + p.posicoesDinamicas, 0);
        const posicoesResfriadoTotal = resfriados.reduce((sum, p) => sum + p.posicoesDinamicas, 0);
        const totalPosicoesTotal = posicoesCongeladoTotal + posicoesResfriadoTotal;
        
        totalProdutos.textContent = totalProds;
        totalCaixas.textContent = totalQtde;
        posicoesCongelado.textContent = posicoesCongeladoTotal;
        posicoesResfriado.textContent = posicoesResfriadoTotal;
        totalPosicoes.textContent = totalPosicoesTotal;
    }

    function renderizarTabela(produtos) {
        tabelaBody.innerHTML = '';
        
        if (produtos.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.textContent = 'Nenhum produto encontrado';
            td.style.textAlign = 'center';
            tr.appendChild(td);
            tabelaBody.appendChild(tr);
            return;
        }
        
        produtos.forEach(produto => {
            const tr = document.createElement('tr');
            
            // Código com botão de cópia
            const tdCodigo = document.createElement('td');
            const codigoContainer = document.createElement('div');
            codigoContainer.style.display = 'flex';
            codigoContainer.style.alignItems = 'center';
            codigoContainer.style.gap = '8px';
            
            const codigoText = document.createElement('span');
            codigoText.textContent = produto.codigo;
            
            const copyButton = document.createElement('button');
            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
            copyButton.className = 'btn-copy';
            copyButton.title = 'Copiar código';
            copyButton.style.background = 'transparent';
            copyButton.style.border = 'none';
            copyButton.style.color = 'var(--text-muted)';
            copyButton.style.cursor = 'pointer';
            copyButton.style.transition = 'color 0.2s';
            copyButton.addEventListener('mouseover', function() {
                this.style.color = 'var(--accent)';
            });
            copyButton.addEventListener('mouseout', function() {
                this.style.color = 'var(--text-muted)';
            });
            copyButton.addEventListener('click', () => copiarCodigo(produto.codigo));
            
            codigoContainer.appendChild(codigoText);
            codigoContainer.appendChild(copyButton);
            tdCodigo.appendChild(codigoContainer);
            tr.appendChild(tdCodigo);
            
            // Produto
            const tdProduto = document.createElement('td');
            tdProduto.textContent = produto.nome;
            tr.appendChild(tdProduto);
            
            // Quantidade
            const tdQtd = document.createElement('td');
            tdQtd.textContent = produto.quantidade;
            tr.appendChild(tdQtd);
            
            // Paletes
            const tdPaletes = document.createElement('td');
            tdPaletes.textContent = produto.paletes;
            tr.appendChild(tdPaletes);
            
            // Tipo
            const tdTipo = document.createElement('td');
            const tipoTag = document.createElement('span');
            tipoTag.classList.add('tag', produto.tipo === 'congelado' ? 'tag-congelado' : 'tag-resfriado');
            tipoTag.textContent = produto.tipo.toUpperCase();
            tdTipo.appendChild(tipoTag);
            tr.appendChild(tdTipo);
            
            // Placas com tooltip de OEs e cópia ao clicar
            const tdPlacas = document.createElement('td');
            const placasLista = document.createElement('div');
            placasLista.classList.add('placas-lista');
            
            if (produto.placas.length > 0) {
                produto.placas.forEach(placa => {
                    const oesRelacionadas = [];
                    produto.oes.forEach(oe => {
                        const gradeItem = gradeCompleta.find(item => 
                            item.OE === oe && item['PLACA ROTEIRIZADA'] === placa
                        );
                        if (gradeItem) {
                            oesRelacionadas.push(oe);
                        }
                    });
                    
                    const placaItem = document.createElement('span');
                    placaItem.classList.add('placa-item');
                    placaItem.textContent = placa;
                    
                    if (oesRelacionadas.length > 0) {
                        placaItem.title = `OE: ${oesRelacionadas.join(', ')}`;
                        placaItem.setAttribute('data-oes', oesRelacionadas.join(', '));
                        placaItem.classList.add('placa-clicavel');
                        placaItem.addEventListener('click', function() {
                            const oes = this.getAttribute('data-oes');
                            copiarTexto(oes, `OE do veículo ${placa}`);
                        });
                    } else {
                        placaItem.title = 'Nenhuma OE associada';
                    }
                    
                    placasLista.appendChild(placaItem);
                });
            } else {
                const placaItem = document.createElement('span');
                placaItem.classList.add('placa-item');
                placaItem.textContent = 'N/A';
                placasLista.appendChild(placaItem);
            }
            
            tdPlacas.appendChild(placasLista);
            tr.appendChild(tdPlacas);
            
            tabelaBody.appendChild(tr);
        });
    }

    function atualizarStatus(mensagem, isError) {
        statusBar.textContent = mensagem;
        statusBar.classList.add('active');
        
        if (isError) {
            statusBar.classList.add('error');
        } else {
            statusBar.classList.remove('error');
        }
        
        setTimeout(() => {
            statusBar.classList.remove('active');
        }, 5000);
    }

    function mostrarLoading(show) {
        if (show) {
            loadingOverlay.classList.add('active');
        } else {
            loadingOverlay.classList.remove('active');
        }
    }

    function mostrarNotificacao(titulo, mensagem, tipo) {
        const notificationContainer = document.getElementById('notificationContainer');
        
        const notification = document.createElement('div');
        notification.classList.add('notification');
        notification.classList.add(tipo === 'error' ? 'error' : 'success');
        
        const icon = document.createElement('i');
        icon.classList.add('fas');
        icon.classList.add(tipo === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check');
        
        const content = document.createElement('div');
        content.classList.add('notification-content');
        
        const notificationTitle = document.createElement('div');
        notificationTitle.classList.add('notification-title');
        notificationTitle.textContent = titulo;
        
        const notificationMessage = document.createElement('div');
        notificationMessage.classList.add('notification-message');
        notificationMessage.textContent = mensagem;
        
        content.appendChild(notificationTitle);
        content.appendChild(notificationMessage);
        
        notification.appendChild(icon);
        notification.appendChild(content);
        
        notificationContainer.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notificationContainer.removeChild(notification);
            }, 300);
        }, 5000);
    }

    function verificarDadosSalvos() {
        try {
            const dadosSalvos = localStorage.getItem('tratadin');
            if (dadosSalvos) {
                const dados = JSON.parse(dadosSalvos);
                processedData = dados;
                
                atualizarResumo(dados.todosProds, dados.congelados, dados.resfriados);
                renderizarTabela(dados.todosProds);
                
                resultsSection.style.display = 'flex';
                listaPicking.style.display = 'none';
                processarBtn.style.display = 'none';
                limparBtn.style.display = 'none';
                resetBtn.style.display = 'block';
                resetBtn.classList.add('btn-primary');
                resetBtn.classList.remove('btn-secondary');
                
                tabTodos.classList.add('active');
                tabCongelados.classList.remove('active');
                tabResfriados.classList.remove('active');
                
                mostrarNotificacao('Info', 'Dados carregados do armazenamento local', 'success');
            }
        } catch (error) {
            console.error('Erro ao carregar dados salvos:', error);
            localStorage.removeItem('tratadin');
        }
    }

    resultsSection.style.display = 'none';
    resetBtn.style.display = 'none';
    
    try {
        if (!localStorage.getItem('gradeCompleta')) {
            console.warn('gradeCompleta não encontrada no localStorage.');
        }
        verificarDadosSalvos();
    } catch (error) {
        console.error('Erro ao verificar localStorage:', error);
    }
});