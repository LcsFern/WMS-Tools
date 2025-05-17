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
    
    let currentTab = 'todos'; // Alterado para 'todos'

    // Event Listeners
    processarBtn.addEventListener('click', processarDados);
    limparBtn.addEventListener('click', limparDados);
    resetBtn.addEventListener('click', limparDados);
    searchInput.addEventListener('input', filtrarTabela);
    
    // Detectar colagem de texto automaticamente
    listaPicking.addEventListener('paste', function() {
        // Pequeno delay para garantir que o conteúdo colado seja incluído
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
            
            // Obter dados do localStorage e arquivo JSON
            const gradeCompleta = await obterGradeCompleta();
            const produtosData = await obterProdutosJson();
            
            // Processar a lista de picking
            const linhas = pickingData.split('\n');
            const cabecalhos = linhas[0].split('\t');
            
            let pickingRows = [];
            
            // Processar cada linha
            for (let i = 1; i < linhas.length; i++) {
                if (!linhas[i].trim()) continue;
                
                const valores = linhas[i].split('\t');
                let row = {};
                
                cabecalhos.forEach((header, index) => {
                    row[header] = valores[index] || '';
                });
                
                pickingRows.push(row);
            }
            
            // Agrupar produtos
            const produtosAgrupados = agruparProdutos(pickingRows);
            
            // Calcular posições e associar com placa
            const produtosProcessados = calcularPosicoesEPlacas(produtosAgrupados, produtosData, gradeCompleta);
            
            // Ordenar por quantidade (maior para menor)
            produtosProcessados.sort((a, b) => b.quantidade - a.quantidade);
            
            // Separar por tipo (congelado/resfriado)
            const { congelados, resfriados } = separarPorTipo(produtosProcessados);
            
            // Ordenar também os arrays separados
            congelados.sort((a, b) => b.quantidade - a.quantidade);
            resfriados.sort((a, b) => b.quantidade - a.quantidade);
            
            // Atualizar o estado da aplicação
            processedData = {
                produtos: produtosProcessados,
                congelados: congelados,
                resfriados: resfriados,
                todosProds: produtosProcessados
            };
            
            // Salvar dados processados no localStorage com a key 'tratadin'
            localStorage.setItem('tratadin', JSON.stringify(processedData));
            
            // Atualizar o resumo
            atualizarResumo(produtosProcessados, congelados, resfriados);
            
            // Exibir na tabela inicial (todos)
            renderizarTabela(produtosProcessados);
            tabTodos.classList.add('active');
            tabCongelados.classList.remove('active');
            tabResfriados.classList.remove('active');
            
            // Mostrar resultados e esconder a área de entrada
            resultsSection.style.display = 'flex';
            listaPicking.style.display = 'none';
            processarBtn.style.display = 'none';
            limparBtn.style.display = 'none';
            resetBtn.style.display = 'block';
            resetBtn.classList.add('btn-primary'); // Adicionar classe btn-primary para estilo verde
            resetBtn.classList.remove('btn-secondary'); // Remover classe btn-secondary
            
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
        
        // Limpar estado
        processedData = {
            produtos: [],
            congelados: [],
            resfriados: [],
            todosProds: []
        };
        
        // Limpar resumo
        totalProdutos.textContent = '-';
        totalCaixas.textContent = '-';
        posicoesCongelado.textContent = '-';
        posicoesResfriado.textContent = '-';
        totalPosicoes.textContent = '-';
        
        // Limpar status
        statusBar.classList.remove('active', 'error');
        statusBar.textContent = '';
        
        // Mostrar área de entrada e esconder resultados
        resultsSection.style.display = 'none';
        listaPicking.style.display = 'block';
        processarBtn.style.display = 'inline-flex';
        limparBtn.style.display = 'inline-flex';
        resetBtn.style.display = 'none';
        
        // Remover dados processados do localStorage
        localStorage.removeItem('tratadin');
        
        mostrarNotificacao('Info', 'Dados limpos', 'success');
    }

    function mudarTab(tab) {
        currentTab = tab;
        
        // Atualizar seleção visual
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
        
        // Aplicar filtro de busca após trocar a tab
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

    // Funções auxiliares
    async function obterGradeCompleta() {
        try {
            const gradeCompletaStr = localStorage.getItem('gradeCompleta');
            if (!gradeCompletaStr) {
                throw new Error('Grade completa não encontrada no localStorage');
            }
            
            return JSON.parse(gradeCompletaStr);
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
            // Encontrar info do produto no catálogo
            const infoProduto = produtosData.find(p => p['COD. PRODUTO'] === produto.codigo) || {
                'CX/PALETE': '0',
                'PRODUTO': produto.nome
            };
            
            // Calcular número de paletes
            const caixasPorPalete = parseInt(infoProduto['CX/PALETE']) || 1;
            let numPaletes = 0;
            
            if (caixasPorPalete > 0) {
                // Cálculo proporcional exato (0.3 para 60 caixas em palete de 200)
                numPaletes = parseFloat((produto.quantidade / caixasPorPalete).toFixed(1));
                // Se for 0, mas tiver alguma caixa, garantir pelo menos 0.1
                if (numPaletes === 0 && produto.quantidade > 0) {
                    numPaletes = 0.1;
                }
            }
            
            // Calcular posições dinâmicas (mantemos o cálculo mesmo sem exibir a coluna)
            const posicoesDinamicas = Math.ceil(produto.quantidade / caixasPorPalete) || 1;
            
            // Mapear OEs para placas
            const placas = new Set();
            produto.oes.forEach(oe => {
                const gradeItem = gradeCompleta.find(item => item.OE === oe);
                if (gradeItem && gradeItem['PLACA ROTEIRIZADA']) {
                    placas.add(gradeItem['PLACA ROTEIRIZADA']);
                }
            });
            
            return {
                ...produto,
                codigo: produto.codigo,
                nome: infoProduto['PRODUTO'] || produto.nome,
                caixasPorPalete,
                paletes: numPaletes,
                posicoesDinamicas,
                placas: Array.from(placas),
                tipo: produto.origem.startsWith('C04') ? 'resfriado' : 'congelado'
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
            td.colSpan = 6; // Reduzido para 6 colunas (removemos "posições")
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
            
            // Placas
            const tdPlacas = document.createElement('td');
            const placasLista = document.createElement('div');
            placasLista.classList.add('placas-lista');
            
            if (produto.placas.length > 0) {
                produto.placas.forEach(placa => {
                    const placaItem = document.createElement('span');
                    placaItem.classList.add('placa-item');
                    placaItem.textContent = placa;
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
        
        // Auto-esconder após alguns segundos
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
        
        // Mostrar a notificação com um pequeno atraso para permitir a animação
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Remover a notificação após um período
        setTimeout(() => {
            notification.classList.remove('show');
            
            // Esperar a animação terminar antes de remover o elemento
            setTimeout(() => {
                notificationContainer.removeChild(notification);
            }, 300);
        }, 5000);
    }

    // Função para verificar e carregar dados salvos do localStorage
    function verificarDadosSalvos() {
        try {
            const dadosSalvos = localStorage.getItem('tratadin');
            if (dadosSalvos) {
                const dados = JSON.parse(dadosSalvos);
                // Carregar dados salvos
                processedData = dados;
                
                // Atualizar o resumo
                atualizarResumo(dados.todosProds, dados.congelados, dados.resfriados);
                
                // Exibir na tabela inicial (todos)
                renderizarTabela(dados.todosProds);
                
                // Mostrar resultados e esconder a área de entrada
                resultsSection.style.display = 'flex';
                listaPicking.style.display = 'none';
                processarBtn.style.display = 'none';
                limparBtn.style.display = 'none';
                resetBtn.style.display = 'block';
                resetBtn.classList.add('btn-primary');
                resetBtn.classList.remove('btn-secondary');
                
                // Selecionar a aba "Todos" como ativa
                tabTodos.classList.add('active');
                tabCongelados.classList.remove('active');
                tabResfriados.classList.remove('active');
                
                mostrarNotificacao('Info', 'Dados carregados do armazenamento local', 'success');
            }
        } catch (error) {
            console.error('Erro ao carregar dados salvos:', error);
            localStorage.removeItem('tratadin'); // Remove dados corrompidos
        }
    }

    // Inicialização inicial
    resultsSection.style.display = 'none'; // Esconder resultados inicialmente
    resetBtn.style.display = 'none'; // Esconder botão de reset inicialmente
    
    try {
        // Verificar se há dados no localStorage para gradeCompleta
        if (!localStorage.getItem('gradeCompleta')) {
            console.warn('gradeCompleta não encontrada no localStorage.');
        }
        
        // Verificar se existem dados salvos
        verificarDadosSalvos();
    } catch (error) {
        console.error('Erro ao verificar localStorage:', error);
    }
});