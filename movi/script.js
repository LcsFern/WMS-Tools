// script.js

let gradeCompleta = null;
let movimentacoesProcessadas = {};

// Função para exibir mensagem de erro (quando grade não for carregada)
function exibirMensagem(mensagem) {
  const gradeStatus = document.getElementById('gradeStatus');
  gradeStatus.innerHTML = `<h2>${mensagem}</h2>`;
  gradeStatus.className = 'error-container';
  
  // Ocultar a seção de importação quando a grade não estiver carregada
  document.getElementById('importSection').classList.add('hidden');
}

// Carrega a gradeCompleta e os dados processados (se houver) ao iniciar
window.addEventListener('load', () => {
  // Carregar grade (key "gradeCompleta")
  const gradeString = localStorage.getItem('gradeCompleta');
  if (!gradeString) {
    exibirMensagem('Grade não carregada');
  } else {
    try {
      gradeCompleta = JSON.parse(gradeString);
      document.getElementById('gradeStatus').innerHTML = ''; // limpa mensagem
      document.getElementById('importSection').classList.remove('hidden'); // mostra a seção de importação
    } catch (error) {
      exibirMensagem('Erro ao processar gradeCompleta');
      console.error(error);
    }
  }
  
  // Carregar movimentações processadas (se houver)
  const movString = localStorage.getItem('movimentacoesProcessadas');
  if (movString) {
    movimentacoesProcessadas = JSON.parse(movString);
    exibirMovimentacoes();
    mostrarBarraPesquisa();
    ocultarImportacaoExibirMais();
  }
  
  // Configurar o processamento automático ao colar no textarea
  const textarea = document.getElementById('movimentacaoInput');
  textarea.addEventListener('input', function(e) {
    // Verificar se o texto foi colado (tem conteúdo significativo)
    if (this.value.trim().length > 10 && this.value.includes('\t')) {
      // Dar um pequeno delay para garantir que todo o conteúdo foi colado
      setTimeout(() => processarMovimentacao(this.value), 200);
    }
  });
  
  // Configurar botão para processar mais movimentações
  document.getElementById('btnProcessarMais').addEventListener('click', () => {
    document.getElementById('processMoreContainer').classList.add('hidden');
    document.getElementById('importSection').classList.remove('hidden');
    document.getElementById('movimentacaoInput').value = '';
  });
  
  // Configurar evento de pesquisa
  document.getElementById('searchInput').addEventListener('input', realizarPesquisa);
});

// Função para mostrar barra de pesquisa
function mostrarBarraPesquisa() {
  document.getElementById('searchContainer').classList.remove('hidden');
}

// Função para ocultar importação e mostrar botão de "processar mais"
function ocultarImportacaoExibirMais() {
  document.getElementById('importSection').classList.add('hidden');
  document.getElementById('processMoreContainer').classList.remove('hidden');
}

// Função para extrair chave de ordenação do campo ORIGEM (ex: "C01A" => {camera:1, rua:"A"})
function extrairChaveOrdenacao(origem) {
  const match = origem.match(/^C(\d\d)([A-Z])/);
  if (match) {
    return { camera: parseInt(match[1], 10), rua: match[2] };
  }
  return { camera: 99, rua: 'Z' };
}

function compararOrigem(a, b) {
  const chaveA = extrairChaveOrdenacao(a.origem);
  const chaveB = extrairChaveOrdenacao(b.origem);
  if (chaveA.camera !== chaveB.camera) {
    return chaveA.camera - chaveB.camera;
  }
  if (chaveA.rua < chaveB.rua) return -1;
  if (chaveA.rua > chaveB.rua) return 1;
  return 0;
}

// Função para processar os dados colados
function processarMovimentacao(rawText) {
  rawText = rawText.trim();
  if (!rawText) {
    alert('Cole os dados copiados do Excel.');
    return;
  }
  
  const linhas = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');
  if (linhas.length < 2) {
    alert('O texto deve conter o cabeçalho e ao menos uma linha de dados.');
    return;
  }
  
  const cabecalho = linhas[0].split('\t');
  const dadosLinhas = linhas.slice(1);
  
  const movimentacoes = dadosLinhas.map(linha => {
    const cols = linha.split('\t');
    return {
      etiquetaPalete: cols[0] || '',
      prioridade: cols[1] || '',
      rgCaixa: cols[2] || '',
      codProduto: cols[3] || '',
      produto: cols[4] || '',
      qtde: cols[5] || '',
      peso: cols[6] || '',
      tipo: cols[7] || '',
      status: cols[8] || '',
      carga: cols[9] || '',
      oeViagem: cols[10] || '',
      origem: cols[11] || '',
      destino: cols[12] || '',
      modificadoPor: cols[13] || '',
      criadoPor: cols[14] || '',
      dataCriacao: cols[15] || '',
      dataModificacao: cols[16] || ''
    };
  });
  
  // Agrupar por OE/VIAGEM
  const agrupado = {};
  movimentacoes.forEach(item => {
    const chave = item.oeViagem || 'SEM_OE';
    if (!agrupado[chave]) {
      agrupado[chave] = { registros: [], exportado: false };
    }
    agrupado[chave].registros.push(item);
  });
  
  // Ordena cada grupo pela origem (câmera e rua)
  Object.keys(agrupado).forEach(oeKey => {
    agrupado[oeKey].registros.sort(compararOrigem);
  });
  
  // Mesclar com as movimentações já processadas (se houver)
  Object.keys(agrupado).forEach(oeKey => {
    if (movimentacoesProcessadas[oeKey]) {
      // Se a OE já existe, mesclamos os registros (evitando duplicatas)
      const registrosExistentes = movimentacoesProcessadas[oeKey].registros.map(r => r.etiquetaPalete);
      agrupado[oeKey].registros.forEach(novoRegistro => {
        if (!registrosExistentes.includes(novoRegistro.etiquetaPalete)) {
          movimentacoesProcessadas[oeKey].registros.push(novoRegistro);
        }
      });
      // Reordenar após mesclar
      movimentacoesProcessadas[oeKey].registros.sort(compararOrigem);
    } else {
      // Se é uma nova OE, só adicionamos ao objeto
      movimentacoesProcessadas[oeKey] = agrupado[oeKey];
    }
  });
  
  // Armazena os dados processados no localStorage
  localStorage.setItem('movimentacoesProcessadas', JSON.stringify(movimentacoesProcessadas));
  
  // Exibe os grupos na tela
  exibirMovimentacoes();
  
  // Mostrar barra de pesquisa e ocultar importação
  mostrarBarraPesquisa();
  ocultarImportacaoExibirMais();
}

// Função para exibir os grupos processados
function exibirMovimentacoes() {
  const container = document.getElementById('movimentacoesContainer');
  container.classList.remove('hidden');
  const lista = document.getElementById('movimentacoesList');
  lista.innerHTML = '';
  
  // Separar movimentações finalizadas e pendentes
  const oeKeys = Object.keys(movimentacoesProcessadas);
  const pendentes = [];
  const finalizadas = [];
  
  oeKeys.forEach(oeKey => {
    // Verificar se a OE está na grade (caso não esteja, não exibimos)
    let naGrade = false;
    if (gradeCompleta) {
      naGrade = gradeCompleta.some(item => item.OE.trim() === oeKey.trim());
    }
    
    // Se não estiver na grade, ignoramos esta OE
    if (!naGrade && oeKey !== 'SEM_OE') {
      return;
    }
    
    if (movimentacoesProcessadas[oeKey].exportado) {
      finalizadas.push(oeKey);
    } else {
      pendentes.push(oeKey);
    }
  });
  
  // Processar primeiro as pendentes, depois as finalizadas
  [...pendentes, ...finalizadas].forEach(oeKey => {
    // Buscar na grade os dados referentes à OE (comparação exata)
    let placa = 'N/A', destinoGrade = 'N/A';
    if (gradeCompleta) {
      const gradeItem = gradeCompleta.find(item => item.OE.trim() === oeKey.trim());
      if (gradeItem) {
        placa = gradeItem["PLACA ROTEIRIZADA"] || placa;
        destinoGrade = gradeItem["DESTINO"] || destinoGrade;
      }
    }
    
    // Cria o cartão do grupo
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.oe = oeKey;
    
    // Adicionar classe para cartões finalizados
    if (movimentacoesProcessadas[oeKey].exportado) {
      card.classList.add('finalized-card');
    }
    
    // Cabeçalho do cartão
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <div class="group-info">
        <div><strong>OE:</strong> ${oeKey}</div>
        <div><strong>Placa:</strong> ${placa}</div>
        <div><strong>Destino:</strong> ${destinoGrade}</div>
      </div>
      <div class="group-actions">
        <button class="btnMostrar">Mostrar Movimentação</button>
        <div class="export-container">
          <button class="btnExportar">Exportar PDF</button>
          <input type="checkbox" class="export-checkbox" ${movimentacoesProcessadas[oeKey].exportado ? 'checked' : ''} disabled>
          <span class="conferencia-label">Finalizado</span>
        </div>
      </div>
    `;
    
    // Seção de detalhes (tabela)
    const details = document.createElement('div');
    details.className = 'group-details';
    details.style.display = 'none'; // Inicia oculto por padrão
    
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
    movimentacoesProcessadas[oeKey].registros.forEach(item => {
      const tr = document.createElement('tr');
      tr.dataset.etiqueta = item.etiquetaPalete;
      tr.dataset.produto = item.codProduto + " " + item.produto;
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
    
    // Botão para mostrar/ocultar detalhes
    const btnMostrar = header.querySelector('.btnMostrar');
    btnMostrar.addEventListener('click', () => {
      if (details.style.display === 'none' || !details.style.display) {
        details.style.display = 'block';
        btnMostrar.textContent = 'Ocultar Movimentação';
      } else {
        details.style.display = 'none';
        btnMostrar.textContent = 'Mostrar Movimentação';
      }
    });
    
    // Botão para exportar PDF do grupo
    const btnExportar = header.querySelector('.btnExportar');
    const checkbox = header.querySelector('.export-checkbox');
    btnExportar.addEventListener('click', (e) => {
      e.stopPropagation();
      exportarPDF(oeKey, placa, destinoGrade, movimentacoesProcessadas[oeKey].registros);
      // Marcar como exportado
      movimentacoesProcessadas[oeKey].exportado = true;
      localStorage.setItem('movimentacoesProcessadas', JSON.stringify(movimentacoesProcessadas));
      checkbox.checked = true;
      
      // Reordenar para mover os finalizados para o final
      exibirMovimentacoes();
    });
    
    card.appendChild(header);
    card.appendChild(details);
    lista.appendChild(card);
  });
}

// Função para realizar pesquisa
// Função para realizar pesquisa
function realizarPesquisa() {
  const termo = document.getElementById('searchInput').value.trim().toLowerCase();
  const cards = document.querySelectorAll('.group-card');
  let encontrados = 0;
  const total = cards.length;
  
  if (!termo) {
    // Se não há termo de busca, remover highlights e mostrar tudo
    cards.forEach(card => {
      card.style.display = 'block';
      removerHighlights(card);
    });
    document.getElementById('searchResults').textContent = '';
    return;
  }
  
  cards.forEach(card => {
    const textoOE = card.dataset.oe.toLowerCase();
    const placaElement = card.querySelector('.group-info div:nth-child(2)');
    const destinoElement = card.querySelector('.group-info div:nth-child(3)');
    const placa = placaElement ? placaElement.textContent.toLowerCase() : '';
    const destino = destinoElement ? destinoElement.textContent.toLowerCase() : '';
    
    // Estado atual do card (detalhes visíveis ou não)
    const detalheVisivel = card.querySelector('.group-details').style.display === 'block';
    
    // Verificar se encontrou nos campos do cabeçalho
    let encontrado = textoOE.includes(termo) || placa.includes(termo) || destino.includes(termo);
    
    // Verificar nas linhas da tabela mesmo se os detalhes estiverem ocultos
    const linhas = card.querySelectorAll('tbody tr');
    linhas.forEach(linha => {
      const etiqueta = linha.dataset.etiqueta.toLowerCase();
      const produto = linha.dataset.produto.toLowerCase();
      
      // Se encontrou em algum campo da linha
      if (etiqueta.includes(termo) || produto.includes(termo)) {
        encontrado = true;
      }
    });
    
    // Agora aplicar highlights apenas em elementos visíveis
    if (detalheVisivel) {
      // Destacar nas linhas da tabela
      linhas.forEach(linha => {
        const etiqueta = linha.dataset.etiqueta.toLowerCase();
        const produto = linha.dataset.produto.toLowerCase();
        
        if (etiqueta.includes(termo) || produto.includes(termo)) {
          destacarTexto(linha, termo);
        } else {
          removerHighlights(linha);
        }
      });
    }
    
    // Destacar no cabeçalho se necessário
    if (textoOE.includes(termo)) {
      destacarTexto(card.querySelector('.group-info div:nth-child(1)'), termo);
    } else {
      removerHighlights(card.querySelector('.group-info div:nth-child(1)'));
    }
    
    if (placa.includes(termo)) {
      destacarTexto(placaElement, termo);
    } else {
      removerHighlights(placaElement);
    }
    
    if (destino.includes(termo)) {
      destacarTexto(destinoElement, termo);
    } else {
      removerHighlights(destinoElement);
    }
    
    // Mostra ou oculta o card
    if (encontrado) {
      card.style.display = 'block';
      encontrados++;
      
      // Se encontrou em linhas ocultas, abrir automaticamente os detalhes
      if (!detalheVisivel && 
          !textoOE.includes(termo) && 
          !placa.includes(termo) && 
          !destino.includes(termo)) {
        const btnMostrar = card.querySelector('.btnMostrar');
        btnMostrar.click(); // Abre os detalhes do card
      }
    } else {
      card.style.display = 'none';
    }
  });
  
  // Atualizar contador de resultados
  document.getElementById('searchResults').textContent = `${encontrados} de ${total}`;
}

// Função para destacar o texto encontrado
function destacarTexto(elemento, termo) {
  // Não destacar novamente se já tem highlights
  if (elemento.querySelector('.highlight')) return;
  
  const regex = new RegExp(`(${termo})`, 'gi');
  const textoNodes = Array.from(elemento.childNodes).filter(n => n.nodeType === 3);
  
  textoNodes.forEach(node => {
    const parent = node.parentNode;
    const content = node.textContent;
    if (content.toLowerCase().includes(termo.toLowerCase())) {
      const highlighted = content.replace(regex, '<span class="highlight">$1</span>');
      const temp = document.createElement('div');
      temp.innerHTML = highlighted;
      
      // Substituir o nó de texto por seu conteúdo destacado
      while (temp.firstChild) {
        parent.insertBefore(temp.firstChild, node);
      }
      parent.removeChild(node);
    }
  });
}

// Função para remover highlights
function removerHighlights(elemento) {
  const highlights = elemento.querySelectorAll('.highlight');
  highlights.forEach(h => {
    const parent = h.parentNode;
    const texto = document.createTextNode(h.textContent);
    parent.replaceChild(texto, h);
    parent.normalize(); // Junta nós de texto adjacentes
  });
}

function exportarPDF(oeKey, placa, destinoGrade, registros) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'pt', 'a4');
  
  // Configurar fonte para todo o documento
  doc.setFont('helvetica', 'bold'); // Usando helvetica que tem melhor suporte a negrito no jsPDF
  
  // Obter doca do primeiro registro, se disponível
  const docaNum = registros.length > 0 && registros[0].destino 
    ? registros[0].destino.match(/DOCA(\d+)/i) 
    : null;
  const docaNumero = docaNum ? docaNum[1] : '';
  
  // Obter a data e hora atual formatada
  const dataAtual = new Date();
  const dataFormatada = `${dataAtual.getDate().toString().padStart(2, '0')}/${(dataAtual.getMonth() + 1).toString().padStart(2, '0')}/${dataAtual.getFullYear()}`;
  const horaFormatada = `${dataAtual.getHours().toString().padStart(2, '0')}:${dataAtual.getMinutes().toString().padStart(2, '0')}`;
  const dataHoraFormatada = `${dataFormatada} - ${horaFormatada}`;
  
  // Configurações de estilo
  const corCinza = [200, 200, 200];
  const corAmarela = [255, 240, 153];
  const corAmarelaMaisEscura = [255, 225, 102];
  
  // Cabeçalho do PDF
  doc.setFillColor(...corCinza);
  doc.rect(40, 40, 515, 40, 'F');
  
  // Título - garantindo que seja negrito e com boa visibilidade
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('MOVIMENTAÇÃO', 50, 65);
  
  // Área de OE à direita no cabeçalho
  doc.setFillColor(255, 255, 255);
  doc.rect(430, 45, 120, 30);
  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(430, 45, 120, 30);
  
  // Centralizar OE dentro do quadrado - com ênfase no negrito
  doc.setFontSize(11); // Aumentado um pouco para melhor legibilidade
  doc.setFont('helvetica', 'bold');
  
  // Medir largura do texto da OE para centralização
  const oeWidth = doc.getTextWidth(oeKey);
  doc.text(oeKey, 430 + (120 - oeWidth) / 2, 60);
  
  // Data/hora centralizada na parte inferior do quadrado
  doc.setFontSize(9); // Aumentado um pouco para melhor legibilidade
  doc.setFont('helvetica', 'bold');
  const dataWidth = doc.getTextWidth(dataHoraFormatada);
  doc.text(dataHoraFormatada, 430 + (120 - dataWidth) / 2, 72);
  
  // Seção de operador
  doc.setFillColor(...corAmarela);
  doc.rect(40, 100, 515, 30, 'F');
  
  doc.setFontSize(11); // Aumentado um pouco para melhor legibilidade
  doc.setFont('helvetica', 'bold');
  doc.text('Nome Operador:', 50, 118);
  doc.text('___________________________', 140, 118);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Ass:', 350, 118);
  doc.text('___________________', 380, 118);
  
  // Cabeçalho da tabela principal com valores reais no lugar das palavras
  doc.setFillColor(...corCinza);
  doc.rect(40, 140, 515, 20, 'F');
  
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  
  // PLACA - substituída pelo valor real e centralizada
  doc.rect(40, 140, 60, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11); // Aumentado para melhor legibilidade
  const placaWidth = doc.getTextWidth(placa || 'N/A');
  doc.text(placa || 'N/A', 40 + (60 - placaWidth) / 2, 153);
  
  // DESTINO - substituído pelo valor real e centralizado
  doc.rect(100, 140, 180, 20);
  const destinoWidth = doc.getTextWidth(destinoGrade || 'N/A');
  doc.text(destinoGrade || 'N/A', 100 + (180 - destinoWidth) / 2, 153);
  
  // Número - mostra o número de registros e centralizado
  doc.rect(280, 140, 60, 20);
  const numWidth = doc.getTextWidth(`${registros.length}`);
  doc.text(`${registros.length}`, 280 + (60 - numWidth) / 2, 153);
  
  // DOCA - centralizada
  doc.rect(340, 140, 215, 20);
  const docaText = 'DOCA' + (docaNumero ? ' ' + docaNumero : '');
  const docaWidth = doc.getTextWidth(docaText);
  doc.text(docaText, 340 + (215 - docaWidth) / 2, 153);
  
  // Segunda linha da tabela - cabeçalho colunas
  doc.setFillColor(...corAmarelaMaisEscura);
  doc.rect(40, 160, 515, 20, 'F');
  
  // Definir colunas com suas larguras ajustadas
  const cols = [
    { width: 90, text: 'PALETE' },
    { width: 45, text: 'COD. PROD' },
    { width: 130, text: 'PRODUTO' },
    { width: 30, text: 'QTD' },
    { width: 40, text: 'PESO' },
    { width: 45, text: 'OE' },
    { width: 45, text: 'LOCAL' },
    { width: 60, text: 'DESTINO' },
    { width: 30, text: 'GRUPO' }
  ];
  
  // Desenhar as células do cabeçalho das colunas
  let posX = 40;
  cols.forEach((col, i) => {
    doc.rect(posX, 160, col.width, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8); // Aumentado de 7 para 8
    doc.text(col.text, posX + (col.width/2 - doc.getTextWidth(col.text)/2), 173);
    posX += col.width;
  });
  
  // Conteúdo da tabela - dados
  let posY = 180;
  
  // Preencher a tabela com os dados existentes
  registros.forEach((item, index) => {
    posX = 40;
    
    // Para cada linha, iterar pelas colunas
    cols.forEach((col, i) => {
      // Desenhar a célula
      doc.rect(posX, posY, col.width, 20);
      
      // Definir o conteúdo de cada célula
      let conteudo = '';
      switch(i) {
        case 0: conteudo = item.etiquetaPalete || ''; break;
        case 1: conteudo = item.codProduto || ''; break;
        case 2: conteudo = item.produto || ''; break;
        case 3: conteudo = item.qtde || ''; break;
        case 4: conteudo = item.peso || ''; break;
        case 5: conteudo = oeKey || ''; break;
        case 6: conteudo = item.origem || ''; break;
        case 7: conteudo = item.destino || ''; break;
        case 8: conteudo = '-'; break;
      }
      
      // Texto nas células - com garantia de negrito
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7); // Aumentado de 6 para 7
      
      // Truncar texto longo, mas NUNCA truncar a etiqueta do palete (coluna 0)
      if (i === 2 && conteudo.length > 35) {
        conteudo = conteudo.substring(0, 35) + '...';
      } else if (i !== 0 && i !== 2 && conteudo.length > 12) {
        // Truncar outras colunas, exceto PALETE e PRODUTO
        conteudo = conteudo.substring(0, 12) + '...';
      }
      
      // Posicionamento do texto dentro da célula - ajustado para evitar sobreposição
      if (i === 0) { // Para coluna de PALETE (etiqueta)
        doc.text(conteudo, posX + 2, posY + 12, { maxWidth: col.width - 4 });
      } else if (i === 2) { // Para coluna de produtos
        doc.text(conteudo, posX + 2, posY + 12, { maxWidth: col.width - 4 });
      } else { // Para outras colunas
        doc.text(conteudo, posX + (col.width/2 - doc.getTextWidth(conteudo)/2), posY + 12);
      }
      
      posX += col.width;
    });
    
    posY += 20;
  });
  
  // Adicionar linhas vazias para completar a tabela (até 8 linhas no total)
  const linhasVazias = Math.max(0, 8 - registros.length);
  for (let i = 0; i < linhasVazias; i++) {
    posX = 40;
    cols.forEach((col) => {
      doc.rect(posX, posY, col.width, 20);
      posX += col.width;
    });
    posY += 20;
  }
  
  doc.save(`Movimentacao_OE_${oeKey}.pdf`);
}