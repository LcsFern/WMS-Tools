// script.js

// Carrega as ondas do localStorage ou inicializa arrays vazios
let ondasReabastecimento = JSON.parse(localStorage.getItem('reaba')) || [];
let ondasDinamico = JSON.parse(localStorage.getItem('ondasdin')) || [];

// Determina os números das ondas atuais com base nos maiores números existentes
let ondaAtualReabastecimento = ondasReabastecimento.length > 0 ? Math.max(0, ...ondasReabastecimento.map(o => o.numero)) : 0;
let ondaAtualDinamico = ondasDinamico.length > 0 ? Math.max(0, ...ondasDinamico.map(o => o.numero)) : 0;

// Coluna "TIPO" nos dados do Excel (base 0)
const COLUNA_TIPO_INDEX = 7;
const TIPO_DINAMICO_TEXT = "EXPEDIÇÃO PICKING DINÂMICO IN";
const TIPO_REABASTECIMENTO_TEXT = "ARMAZEM REABASTECIMENTO";

// Configurações iniciais ao carregar a página
window.addEventListener('load', () => {
  if (ondasReabastecimento.length > 0 || ondasDinamico.length > 0) {
    exibirMovimentacoes();
    mostrarBarraPesquisa();
    ocultarImportacaoExibirMais();
  }

  // Listener para o textarea de entrada
  const textarea = document.getElementById('movimentacaoInput');
  textarea.addEventListener('input', function(e) {
    if (this.value.trim().length > 10 && this.value.includes('\t')) {
      setTimeout(() => processarMovimentacao(this.value), 200);
    }
  });

  // Listener para o botão "Processar Mais Dados"
  document.getElementById('btnProcessarMais').addEventListener('click', () => {
    document.getElementById('processMoreContainer').classList.add('hidden');
    document.getElementById('importSection').classList.remove('hidden');
    document.getElementById('movimentacaoInput').value = '';
    document.getElementById('movimentacaoInput').focus();
  });

  // Listener para a barra de pesquisa
  document.getElementById('searchInput').addEventListener('input', realizarPesquisa);
});

// Função para processar os dados colados do Excel
function processarMovimentacao(rawText) {
  rawText = rawText.trim();
  if (!rawText) {
    showCustomAlert('Cole os dados copiados do Excel.', 'warning');
    return;
  }

  const linhas = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');
  if (linhas.length < 2) {
    showCustomAlert('O texto deve conter o cabeçalho e ao menos uma linha de dados.', 'error');
    return;
  }

  const dadosLinhas = linhas.slice(1);

  if (dadosLinhas.length === 0) {
    showCustomAlert('Nenhuma linha de dados encontrada abaixo do cabeçalho.', 'error');
    return;
  }

  const primeiraLinhaCols = dadosLinhas[0].split('\t');
  let operationType = null;

  if (primeiraLinhaCols.length > COLUNA_TIPO_INDEX) {
    const tipoValor = primeiraLinhaCols[COLUNA_TIPO_INDEX].toUpperCase();
    if (tipoValor.includes(TIPO_DINAMICO_TEXT)) {
      operationType = 'dinamico';
    } else if (tipoValor.includes(TIPO_REABASTECIMENTO_TEXT)) {
      operationType = 'reabastecimento';
    }
  }

  if (!operationType) {
    showCustomAlert(`Tipo de operação não reconhecido. Verifique se é uma reposição ou picking dinâmico.`, 'error');
    document.getElementById('movimentacaoInput').value = '';
    return;
  }

  for (let i = 0; i < dadosLinhas.length; i++) {
    const cols = dadosLinhas[i].split('\t');
    if (cols.length <= COLUNA_TIPO_INDEX) {
      showCustomAlert(`Erro na linha ${i + 2} dos dados: não possui colunas suficientes para identificar o tipo.`, 'error');
      return;
    }
    const currentTipoValor = cols[COLUNA_TIPO_INDEX].toUpperCase();
    if (operationType === 'dinamico' && !currentTipoValor.includes(TIPO_DINAMICO_TEXT)) {
      showCustomAlert(`Mistura de tipos de operação detectada. Linha ${i + 2} não parece ser "${TIPO_DINAMICO_TEXT}". Todas as linhas devem ser do mesmo tipo.`, 'error');
      return;
    }
    if (operationType === 'reabastecimento' && !currentTipoValor.includes(TIPO_REABASTECIMENTO_TEXT)) {
      showCustomAlert(`Mistura de tipos de operação detectada. Linha ${i + 2} não parece ser "${TIPO_REABASTECIMENTO_TEXT}". Todas as linhas devem ser do mesmo tipo.`, 'error');
      return;
    }
  }

  let movimentacoesTemp = dadosLinhas.map(linha => {
    const cols = linha.split('\t');
    return {
      etiquetaPalete: cols[0] || '',
      prioridade: cols[1] || '',
      rgCaixa: cols[2] || '',
      codProduto: cols[3] || '',
      produto: cols[4] || '',
      qtde: cols[5] || '',
      peso: cols[6] || '',
      tipoOperacaoOriginal: cols[7] || '',
      status: cols[8] || '',
      carga: cols[9] || '',
      oeViagem: cols[10] || '',
      origem: cols[11] || '',
      destino: cols[12] || '',
      modificadoPor: cols[13] || '',
      criadoPor: cols[14] || '',
      dataCriacaoOriginal: cols[15] || '',
      dataModificacao: cols[16] || ''
    };
  });

  let movimentacoesAgrupadasDoPaste = agruparMovimentacoes(movimentacoesTemp);

  let todasAsMovimentacoesExistentesAnteriores;
  if (operationType === 'reabastecimento') {
    todasAsMovimentacoesExistentesAnteriores = ondasReabastecimento.flatMap(onda => [...onda.congelado, ...onda.resfriado]);
  } else {
    todasAsMovimentacoesExistentesAnteriores = ondasDinamico.flatMap(onda => [...onda.congelado, ...onda.resfriado]);
  }

  let numeroDeDuplicadosIgnorados = 0;
  const movimentacoesRealmenteNovas = movimentacoesAgrupadasDoPaste.filter(novaMov => {
    const isDuplicate = todasAsMovimentacoesExistentesAnteriores.some(existente =>
      existente.etiquetaPalete === novaMov.etiquetaPalete &&
      existente.codProduto === novaMov.codProduto &&
      existente.origem === novaMov.origem &&
      existente.destino === novaMov.destino
    );

    if (isDuplicate) {
      console.warn(`Item duplicado (tipo: ${operationType}, já existente em onda anterior): Etiqueta ${novaMov.etiquetaPalete}, Produto ${novaMov.codProduto}, Origem ${novaMov.origem}. Não será carregado.`);
      numeroDeDuplicadosIgnorados++;
      return false;
    }
    return true;
  });

  if (movimentacoesAgrupadasDoPaste.length > 0 && movimentacoesRealmenteNovas.length === 0 && numeroDeDuplicadosIgnorados > 0) {
    showCustomAlert(`Todos os ${numeroDeDuplicadosIgnorados} ite(ns) colado(s) já existem em ondas anteriores de ${operationType} e não foram carregados novamente.`, 'warning');
    document.getElementById('movimentacaoInput').value = '';
    return;
  }
   if (numeroDeDuplicadosIgnorados > 0) {
    showCustomAlert(`${numeroDeDuplicadosIgnorados} item(ns) duplicado(s) foram encontrados (já existiam em ondas anteriores de ${operationType}) e não foram carregados novamente.`, 'info');
  }

  if (movimentacoesRealmenteNovas.length === 0) {
    showCustomAlert(`Nenhum item novo para adicionar para ${operationType} (após verificação de duplicatas e regras de categoria).`, 'info');
    document.getElementById('movimentacaoInput').value = '';
    return;
  }

  const dataCriacaoOnda = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  let novaOndaNumero;
  let currentOndasArray;
  let localStorageKey;

  if (operationType === 'reabastecimento') {
    ondaAtualReabastecimento++;
    novaOndaNumero = ondaAtualReabastecimento;
    currentOndasArray = ondasReabastecimento;
    localStorageKey = 'reaba';
  } else {
    ondaAtualDinamico++;
    novaOndaNumero = ondaAtualDinamico;
    currentOndasArray = ondasDinamico;
    localStorageKey = 'ondasdin';
  }

  const novaOnda = {
    numero: novaOndaNumero,
    congelado: [],
    resfriado: [],
    exportado: { congelado: false, resfriado: false },
    dataCriacao: dataCriacaoOnda,
    tipoOperacao: operationType
  };

  movimentacoesRealmenteNovas.forEach(item => {
    const origem = item.origem || "";
    if (['C01', 'C02', 'C03'].includes(origem.slice(0, 3).toUpperCase())) {
      novaOnda.congelado.push(item);
    } else if (origem.slice(0, 3).toUpperCase() === 'C04') {
      novaOnda.resfriado.push(item);
    }
  });

  if (novaOnda.congelado.length === 0 && novaOnda.resfriado.length === 0) {
    showCustomAlert(`Nenhuma movimentação válida (para ${operationType}, após categorização por temperatura) encontrada para criar uma nova onda.`, 'warning');
    document.getElementById('movimentacaoInput').value = '';
    if (operationType === 'reabastecimento') {
      ondaAtualReabastecimento--;
    } else {
      ondaAtualDinamico--;
    }
    return;
  }

  novaOnda.congelado.sort(compararOrigem);
  novaOnda.resfriado.sort(compararOrigem);

  currentOndasArray.push(novaOnda);
  localStorage.setItem(localStorageKey, JSON.stringify(currentOndasArray));

  //showCustomAlert(`Onda ${novaOndaNumero} de ${operationType} processada com sucesso! ${novaOnda.congelado.length} congelado(s), ${novaOnda.resfriado.length} resfriado(s).`, 'success');
  exibirMovimentacoes();
  mostrarBarraPesquisa();
  ocultarImportacaoExibirMais();
  document.getElementById('movimentacaoInput').value = '';
}

function agruparMovimentacoes(movimentacoes) {
  const grupos = {};
  movimentacoes.forEach(item => {
    const chave = `${item.etiquetaPalete}|${item.codProduto}|${item.origem}|${item.destino}`;
    if (!grupos[chave]) {
      grupos[chave] = { ...item, qtde: 0, peso: 0.0 };
    }
    const qtdeItem = parseInt(item.qtde) || 0;
    const pesoItem = parseFloat(String(item.peso).replace(',', '.')) || 0.0;

    grupos[chave].qtde += qtdeItem;
    grupos[chave].peso += pesoItem;
  });

  return Object.values(grupos).map(item => ({
    ...item,
    qtde: String(item.qtde),
    peso: item.peso.toFixed(3).replace('.', ',')
  }));
}

function extrairChaveOrdenacao(origem) {
  if (!origem || typeof origem !== 'string') {
    return { camera: Infinity, rua: 'ZZZ', quadra: Infinity, numero: Infinity };
  }
  const str = origem.toUpperCase();
  const match = str.match(/C(\d+)([A-Z]+)(Q(\d+))?(N(\d+))?/i);

  if (match) {
    return {
      camera: parseInt(match[1], 10),
      rua:    match[2],
      quadra: match[4] ? parseInt(match[4], 10) : 0,
      numero: match[6] ? parseInt(match[6], 10) : 0
    };
  }
  const shortMatch = str.match(/C(\d+)([A-Z]+)/i);
  if (shortMatch) {
    return {
      camera: parseInt(shortMatch[1], 10),
      rua:    shortMatch[2],
      quadra: 0,
      numero: 0
    };
  }
  return { camera: Infinity, rua: 'ZZZ', quadra: Infinity, numero: Infinity };
}

function compararOrigem(a, b) {
  const A = extrairChaveOrdenacao(a.origem);
  const B = extrairChaveOrdenacao(b.origem);

  if (A.camera !== B.camera) return A.camera - B.camera;
  if (A.rua    !== B.rua)    return A.rua.localeCompare(B.rua);
  if (A.quadra !== B.quadra) return A.quadra - B.quadra;
  return A.numero - B.numero;
}

function parsePtBrDate(ptBRDate) {
    if (!ptBRDate || typeof ptBRDate !== 'string') return new Date(0);
    const parts = ptBRDate.split(' ');
    if (parts.length !== 2) return new Date(0);

    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');

    if (dateParts.length !== 3 || timeParts.length < 2) return new Date(0); // Segundos podem ser opcionais

    return new Date(
        parseInt(dateParts[2], 10),
        parseInt(dateParts[1], 10) - 1,
        parseInt(dateParts[0], 10),
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10),
        parseInt(timeParts[2], 10) || 0 // Segundos como 0 se não presentes
    );
}

function exibirMovimentacoes() {
  const container = document.getElementById('movimentacoesContainer');
  container.classList.remove('hidden');
  const lista = document.getElementById('movimentacoesList');
  lista.innerHTML = '';

  const todasAsOndas = [
    ...ondasReabastecimento.map(onda => ({ ...onda, tipoOperacao: 'reabastecimento', dataCriacaoObj: parsePtBrDate(onda.dataCriacao) })),
    ...ondasDinamico.map(onda => ({ ...onda, tipoOperacao: 'dinamico', dataCriacaoObj: parsePtBrDate(onda.dataCriacao) }))
  ];

  const pendentes = todasAsOndas.filter(onda => !isOndaFinalizada(onda))
                                .sort((a, b) => b.dataCriacaoObj - a.dataCriacaoObj);
  const finalizadas = todasAsOndas.filter(onda => isOndaFinalizada(onda))
                                .sort((a, b) => b.dataCriacaoObj - a.dataCriacaoObj);

  [...pendentes, ...finalizadas].forEach(onda => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.ondaNumero = onda.numero;
    card.dataset.ondaTipo = onda.tipoOperacao;

    const isReab = onda.tipoOperacao === 'reabastecimento';
    const finalizada = isOndaFinalizada(onda);

    if (finalizada) {
      card.classList.add('finalized-card');
      if (isReab) {
        card.classList.add('reabastecimento-card-finalized');
      }
    }

    const header = document.createElement('div');
    header.className = 'group-header';

    let btnCongelado = onda.congelado.length > 0 ? `<button class="btnExportar btnExportarCongelado" title="Exportar Congelados PDF"><i class="fa-solid fa-file-pdf"></i> Congelado</button>` : '';
    let btnResfriado = onda.resfriado.length > 0 ? `<button class="btnExportar btnExportarResfriado" title="Exportar Resfriados PDF"><i class="fa-solid fa-file-pdf"></i> Resfriado</button>` : '';
    
    const tipoOndaTexto = isReab ? 'REPOSIÇÃO' : 'DINÂMICO';
    const badgeClass = isReab ? 'wave-badge-reabastecimento' : '';
    const btnMostrarTexto = isReab ? 'Reabastecimentos' : 'Dinâmicos';

    header.innerHTML = `
      <span class="wave-badge ${badgeClass}">${tipoOndaTexto} ONDA ${onda.numero} <small>(${onda.dataCriacao})</small></span>
      <div class="group-info">
        <div><strong>Congelado:</strong> ${onda.congelado.length}</div>
        <div><strong>Resfriado:</strong> ${onda.resfriado.length}</div>
      </div>
      <div class="group-actions">
        <button class="btnMostrar">Mostrar ${btnMostrarTexto}</button>
        <div class="export-container">
          ${btnCongelado}
          ${btnResfriado}
          <input type="checkbox" id="finalizado-${onda.tipoOperacao}-${onda.numero}" class="export-checkbox" ${finalizada ? 'checked' : ''} disabled>
          <label for="finalizado-${onda.tipoOperacao}-${onda.numero}" class="conferencia-label">Finalizado</label>
        </div>
      </div>
    `;

    const details = document.createElement('div');
    details.className = 'group-details';
    details.style.display = 'none';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>ETIQUETA</th>
        <th>COD. PRODUTO</th>
        <th>PRODUTO</th>
        <th>QTDE</th>
        <th>PESO</th>
        <th>ORIGEM</th>
        <th>DESTINO</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const itensParaExibir = [...onda.congelado, ...onda.resfriado];

    itensParaExibir.forEach(item => {
      const tr = document.createElement('tr');
      tr.dataset.etiqueta = item.etiquetaPalete;
      tr.dataset.produto = `${item.codProduto} ${item.produto}`;
      tr.innerHTML = `
        <td>${item.etiquetaPalete}</td>
        <td>${item.codProduto}</td>
        <td>${item.produto}</td>
        <td>${item.qtde}</td>
        <td>${item.peso}</td>
        <td>${item.origem}</td>
        <td>${item.destino}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    details.appendChild(table);

    const btnMostrar = header.querySelector('.btnMostrar');
    btnMostrar.addEventListener('click', () => {
      const isHidden = details.style.display === 'none' || !details.style.display;
      details.style.display = isHidden ? 'block' : 'none';
      btnMostrar.textContent = isHidden ? `Ocultar ${btnMostrarTexto}` : `Mostrar ${btnMostrarTexto}`;
    });

    const btnExpCong = header.querySelector('.btnExportarCongelado');
    if (btnExpCong) {
      btnExpCong.addEventListener('click', (e) => {
        e.stopPropagation();
        exportarPDF(onda.numero, 'congelado', onda.congelado, onda.tipoOperacao); // Removido dataCriacaoOnda daqui, será pego internamente no PDF
        let targetOndas = isReab ? ondasReabastecimento : ondasDinamico;
        let storageKey = isReab ? 'reaba' : 'ondasdin';
        const ondaParaAtualizar = targetOndas.find(o => o.numero === onda.numero);
        if (ondaParaAtualizar) {
          ondaParaAtualizar.exportado.congelado = true;
          localStorage.setItem(storageKey, JSON.stringify(targetOndas));
          exibirMovimentacoes();
        }
      });
    }

    const btnExpResf = header.querySelector('.btnExportarResfriado');
    if (btnExpResf) {
      btnExpResf.addEventListener('click', (e) => {
        e.stopPropagation();
        exportarPDF(onda.numero, 'resfriado', onda.resfriado, onda.tipoOperacao); // Removido dataCriacaoOnda daqui
        let targetOndas = isReab ? ondasReabastecimento : ondasDinamico;
        let storageKey = isReab ? 'reaba' : 'ondasdin';
        const ondaParaAtualizar = targetOndas.find(o => o.numero === onda.numero);
        if (ondaParaAtualizar) {
          ondaParaAtualizar.exportado.resfriado = true;
          localStorage.setItem(storageKey, JSON.stringify(targetOndas));
          exibirMovimentacoes();
        }
      });
    }

    card.appendChild(header);
    card.appendChild(details);
    lista.appendChild(card);
  });
}

function isOndaFinalizada(onda) {
  const temCongelado = onda.congelado.length > 0;
  const temResfriado = onda.resfriado.length > 0;

  if (temCongelado && temResfriado) {
    return onda.exportado.congelado && onda.exportado.resfriado;
  } else if (temCongelado) {
    return onda.exportado.congelado;
  } else if (temResfriado) {
    return onda.exportado.resfriado;
  }
  return false;
}

// Função para exportar os dados em PDF (estilo manual original)
function exportarPDF(ondaNum, categoria, registros, tipoOperacao) {
  if (registros.length === 0) {
    showCustomAlert(`Não há registros de ${categoria} para exportar da onda ${ondaNum} (${tipoOperacao}).`, 'warning');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'pt', 'a4');

  // Definindo cores exatas como no modelo
  const corCinzaClaro = [230, 230, 230];  // Cinza claro para fundo principal
  const corCinzaMedio = [170, 170, 170];  // Cinza médio para cabeçalho 
  const corAmarela = [255, 255, 102];     // Amarelo para cabeçalho da tabela
  const corVerdeClaro = [0, 230, 0, 0.3]; // Verde claro para área de assinatura
  const corAzul = [0, 0, 139];            // Azul escuro para bordas

  // Data e hora atual formatada
  const dataAtual = new Date();
  const dataFormatada = `${dataAtual.getDate().toString().padStart(2, '0')}/${(dataAtual.getMonth() + 1).toString().padStart(2, '0')}/${dataAtual.getFullYear()}`;
  const horaFormatada = `${dataAtual.getHours().toString().padStart(2, '0')}:${dataAtual.getMinutes().toString().padStart(2, '0')}`;
  const dataHoraFormatada = `${dataFormatada} ${horaFormatada}`;

  // Título do PDF baseado no tipo de operação
  const tituloPDF = tipoOperacao === 'reabastecimento' ? 'REPOSIÇÃO' : 'PICKING DINÂMICO';
  const nomeArquivo = `${tipoOperacao === 'reabastecimento' ? 'Picking_Reabastecimento' : 'Picking_Dinamico'}_ONDA_${ondaNum}_${categoria}.pdf`;

  // ------ CABEÇALHO PRINCIPAL ------
  // Fundo do cabeçalho
  doc.setFillColor(...corCinzaMedio);
  doc.rect(40, 40, 515, 40, 'F');
  
  // Borda do cabeçalho
  doc.setDrawColor(0, 0, 139);
  doc.setLineWidth(1);
  doc.rect(40, 40, 515, 40);

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text(tituloPDF, 50, 65);

  // Área para data e número
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  
  // Texto de data e hora
  doc.setFontSize(12);
  doc.text(dataHoraFormatada, 340, 65);
  
  // Separador vertical
  doc.setLineWidth(1);
  doc.line(450, 50, 450, 70);
  
  // Número de itens - Melhor alinhamento
  doc.setFontSize(30);
  doc.text(registros.length.toString(), 490, 65, {align: 'center'});

  // ------ ÁREA DO OPERADOR (VERDE) ------
  doc.setFillColor(150, 230, 150);  // Verde mais claro e sólido
  doc.rect(40, 80, 515, 30, 'F');
  
  // Borda da área do operador
  doc.setDrawColor(0, 0, 139);
  doc.setLineWidth(1);
  doc.rect(40, 80, 515, 30);

  // Texto para operador
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('Nome Operador:', 50, 98);
  doc.text('_____________________________', 140, 98);
  doc.text('Ass:', 350, 98);
  doc.text('___________________', 380, 98);

  // ------ TABELA ------
  // Definição das colunas conforme o modelo - Ajustado largura da etiqueta
  const colunas = [
    { titulo: 'ETIQUETA', largura: 95 },
    { titulo: 'COD. PROD.', largura: 65 },
    { titulo: 'PRODUTO', largura: 175 },
    { titulo: 'QTDE', largura: 35 },
    { titulo: 'PESO', largura: 35 },
    { titulo: 'ORIGEM', largura: 50 },
    { titulo: 'DESTINO', largura: 60 }
  ];

  // Cabeçalho da tabela
  let posY = 120;
  let posX = 40;
  
  // Fundo amarelo para o cabeçalho da tabela
  doc.setFillColor(...corAmarela);
  colunas.forEach(col => {
    doc.rect(posX, posY, col.largura, 20, 'F');
    posX += col.largura;
  });
  
  // Bordas e texto do cabeçalho
  posX = 40;
  doc.setDrawColor(0, 0, 139);
  doc.setTextColor(0, 0, 0);
  colunas.forEach(col => {
    doc.rect(posX, posY, col.largura, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const textWidth = doc.getTextWidth(col.titulo);
    doc.text(col.titulo, posX + (col.largura/2) - (textWidth/2), posY + 14);
    posX += col.largura;
  });

  // Conteúdo da tabela
  posY += 20;

  // Adiciona dados ou linhas vazias (garantindo que tem pelo menos 20 linhas)
  const totalLinhas = Math.max(20, registros.length);

  for (let i = 0; i < totalLinhas; i++) {
    posX = 40;
    const item = i < registros.length ? registros[i] : null;

    colunas.forEach((col, index) => {
      // Desenha a célula (só a borda)
      doc.setDrawColor(0, 0, 139);
      doc.rect(posX, posY, col.largura, 20);

      // Preenche com dados se houver
      if (item) {
        doc.setTextColor(0, 0, 0);
        
        let conteudo = '';
        switch (index) {
          case 0: 
            conteudo = item.etiquetaPalete || ''; 
            break;
          case 1: 
            conteudo = item.codProduto || ''; 
            break;
          case 2: 
            conteudo = item.produto || ''; 
            break;
          case 3: 
            conteudo = item.qtde || ''; 
            break;
          case 4:
            // Formatação corrigida para o peso com no máximo 3 casas decimais
            const pesoRaw = item.peso || '';
            const pesoNum = parseFloat(pesoRaw.replace(',', '.'));
            if (!isNaN(pesoNum)) {
              conteudo = pesoNum.toFixed(3).toString().replace('.', ',');
            } else {
              conteudo = pesoRaw;
            }
            break;
          case 5: 
            conteudo = item.origem || ''; 
            break;
          case 6: 
            conteudo = item.destino || ''; 
            break;
        }

        // TODOS os valores agora são em negrito
        doc.setFont('helvetica', 'bold');
        
        // Etiqueta (como já estava)
        if (index === 0) {
          doc.setFontSize(8);
          // Se a etiqueta for muito longa, ajusta o tamanho da fonte
          if (conteudo.length > 14) {
            doc.setFontSize(7); // Fonte menor para etiquetas longas
          }
          // Alinha a etiqueta à esquerda com um pequeno padding
          doc.text(conteudo, posX + 3, posY + 12);
        } 
        // Produto (texto mais longo)
        else if (index === 2) {
          doc.setFontSize(8);
          // Truncar texto se for muito longo para evitar overflow
          doc.text(conteudo.length > 40 ? conteudo.substring(0, 40) + '...' : conteudo, posX + 3, posY + 12);
        } 
        // Demais colunas
        else {
          doc.setFontSize(8);
          const textWidth = doc.getTextWidth(conteudo);
          doc.text(conteudo, posX + (col.largura/2) - (textWidth/2), posY + 12);
        }
      }

      posX += col.largura;
    });

    posY += 20;

    // Se atingir o limite da página, cria uma nova
    if (posY > 760) {
      doc.addPage();
      posY = 40;
      
      // Cabeçalho da tabela na nova página
      posX = 40;
      
      // Fundo amarelo
      doc.setFillColor(...corAmarela);
      colunas.forEach(col => {
        doc.rect(posX, posY, col.largura, 20, 'F');
        posX += col.largura;
      });
      
      // Bordas e texto
      posX = 40;
      doc.setDrawColor(0, 0, 139);
      doc.setTextColor(0, 0, 0);
      colunas.forEach(col => {
        doc.rect(posX, posY, col.largura, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const textWidth = doc.getTextWidth(col.titulo);
        doc.text(col.titulo, posX + (col.largura/2) - (textWidth/2), posY + 14);
        posX += col.largura;
      });
      
      posY += 20;
    }
  }

  doc.save(nomeArquivo);
}


function mostrarBarraPesquisa() {
  document.getElementById('searchContainer').classList.remove('hidden');
}

function ocultarImportacaoExibirMais() {
  document.getElementById('importSection').classList.add('hidden');
  document.getElementById('processMoreContainer').classList.remove('hidden');
}

function realizarPesquisa() {
  const termo = document.getElementById('searchInput').value.toLowerCase().trim();
  const cards = document.querySelectorAll('#movimentacoesList .group-card');
  let totalEncontrados = 0;

  cards.forEach(card => {
    const details = card.querySelector('.group-details');
    const linhas = card.querySelectorAll('tbody tr');
    let correspondentesNoCard = 0;

    if (termo === '') {
      linhas.forEach(linha => linha.style.display = '');
      details.style.display = 'none';
      card.style.display = '';
    } else {
      linhas.forEach(linha => {
        const etiqueta = linha.dataset.etiqueta.toLowerCase();
        const produto = linha.dataset.produto.toLowerCase();
        if (etiqueta.includes(termo) || produto.includes(termo)) {
          linha.style.display = '';
          correspondentesNoCard++;
        } else {
          linha.style.display = 'none';
        }
      });

      if (correspondentesNoCard > 0) {
        details.style.display = 'block';
        card.style.display = '';
        const btnMostrar = card.querySelector('.btnMostrar');
        const tipoCard = card.dataset.ondaTipo === 'reabastecimento' ? 'Reabastecimentos' : 'Dinâmicos';
        btnMostrar.textContent = `Ocultar ${tipoCard}`;
        totalEncontrados += correspondentesNoCard;
      } else {
        details.style.display = 'none';
        card.style.display = 'none';
      }
    }
  });

  const searchResultsSpan = document.getElementById('searchResults');
  if (termo === '') {
    searchResultsSpan.textContent = '';
    document.querySelectorAll('#movimentacoesList .group-card .btnMostrar').forEach(btn => {
        const card = btn.closest('.group-card');
        if (card) {
            const tipoCard = card.dataset.ondaTipo === 'reabastecimento' ? 'Reabastecimentos' : 'Dinâmicos';
            btn.textContent = `Mostrar ${tipoCard}`;
        }
    });
  } else {
    searchResultsSpan.textContent = `${totalEncontrados} encontrado(s)`;
  }
}

function showCustomAlert(message, type = 'info') {
  const popup = document.getElementById('customAlertPopup');
  const alertMessage = document.getElementById('customAlertMessage');
  const alertIcon = document.getElementById('customAlertIcon');
  const okButton = document.getElementById('customAlertOkButton');
  const closeButton = popup.querySelector('.custom-popup-close-btn');

  alertMessage.textContent = message;
  let iconClass = 'fa-solid fa-circle-info';
  alertIcon.className = 'custom-popup-icon';

  switch (type) {
    case 'success': iconClass = 'fa-solid fa-circle-check'; break;
    case 'warning': iconClass = 'fa-solid fa-triangle-exclamation'; break;
    case 'error': iconClass = 'fa-solid fa-circle-xmark'; break;
  }
  alertIcon.innerHTML = `<i class="${iconClass}"></i>`;

  const closePopup = () => popup.classList.add('hidden');
  okButton.onclick = closePopup;
  closeButton.onclick = closePopup;
  popup.onclick = (event) => { if (event.target === popup) closePopup(); };
  
  popup.classList.remove('hidden');
  okButton.focus();
}