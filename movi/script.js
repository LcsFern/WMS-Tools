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

// Garantir que o modal esteja oculto logo que o DOM esteja disponível
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modalGrupos').classList.add('hidden');
});

// Carrega a gradeCompleta e os dados processados (se houver) ao iniciar
window.addEventListener('load', () => {
  // Reforçar que o modal comece oculto
  document.getElementById('modalGrupos').classList.add('hidden');
  
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
    exibirMovimentacoes(); // Exibe as movimentações salvas
    mostrarBarraPesquisa(); // Mostra a barra de pesquisa
    // Esconder a área de importação e exibir os botões de ação
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
  
  // Configurar botão para adicionar grupos (somente mostra o modal quando o usuário clicar)
  document.getElementById('btnAdicionarGrupos').addEventListener('click', () => {
    document.getElementById('modalGrupos').classList.remove('hidden');
  });

  // Configurar botão para fechar o modal
  document.getElementById('btnFecharModal').addEventListener('click', () => {
    document.getElementById('modalGrupos').classList.add('hidden');
  });

  // Configurar botão para processar grupos
  document.getElementById('btnProcessarGrupos').addEventListener('click', () => {
    const rawText = document.getElementById('gruposInput').value.trim();
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
    // Se o cabeçalho não tiver o número esperado de colunas (17), avisa o usuário
    if (cabecalho.length < 17) {
      alert('Formato do cabeçalho inválido. Por favor, verifique os dados copiados do Excel.');
      return;
    }
    
    const dadosLinhas = linhas.slice(1);
    
    const mapaGrupos = {};
    dadosLinhas.forEach(linha => {
      const cols = linha.split('\t');
      if (cols.length < 14) { // mínima verificação para evitar erros
        console.warn('Linha ignorada por não ter colunas suficientes:', linha);
        return;
      }
      const oe = cols[1] || ''; // OE / VIAGEM
      const etiqueta = cols[2] || ''; // ETIQUETA PALETE
      const grupo = cols[13] || ''; // GRUPO (coluna 13)
      if (oe && etiqueta && grupo) {
        const chave = `${oe}-${etiqueta}`;
        if (!mapaGrupos[chave]) {
          mapaGrupos[chave] = grupo; // Apenas a primeira ocorrência
        }
      }
    });
    
    // Associar grupos às movimentações processadas
    Object.keys(movimentacoesProcessadas).forEach(oeKey => {
      movimentacoesProcessadas[oeKey].registros.forEach(item => {
        const chave = `${oeKey}-${item.etiquetaPalete}`;
        if (mapaGrupos[chave]) {
          item.grupo = mapaGrupos[chave];
        }
      });
    });
    
    // Salvar os dados atualizados no localStorage
    localStorage.setItem('movimentacoesProcessadas', JSON.stringify(movimentacoesProcessadas));
    
    // Atualizar a exibição
    exibirMovimentacoes();
    
    // Fechar o modal e limpar o textarea
    document.getElementById('modalGrupos').classList.add('hidden');
    document.getElementById('gruposInput').value = '';
  });
  
  // Configurar evento de pesquisa
  document.getElementById('searchInput').addEventListener('input', realizarPesquisa);
});

// Função para mostrar barra de pesquisa
function mostrarBarraPesquisa() {
  document.getElementById('searchContainer').classList.remove('hidden');
}

// Função para ocultar importação e mostrar botão de "processar mais" e "adicionar grupos"
function ocultarImportacaoExibirMais() {
  document.getElementById('importSection').classList.add('hidden');
  document.getElementById('processMoreContainer').classList.remove('hidden');
}

// 1) Extrai as 4 chaves de ordenação da string de origem.
//    Captura Cxx, letra, Qxx e Nn em QUALQUER parte da string.
function extrairChaveOrdenacao(origem) {
  if (!origem || typeof origem !== 'string') {
    return { camera: Infinity, rua: 'Z', quadra: Infinity, numero: Infinity };
  }
  const str = origem.toUpperCase();
  const regex = /C(\d{2})([A-Z])Q(\d{2})N(\d+)/i;
  const match = str.match(regex);
  if (match) {
    return {
      camera: parseInt(match[1], 10),    // "03" → 3
      rua:    match[2],                  // "C"
      quadra: parseInt(match[3], 10),    // "02" → 2, "36" → 36
      numero: parseInt(match[4], 10)     // "2" → 2
    };
  }
  // Se não achar Q/N, ao menos captura Cxx e letra
  const shortMatch = str.match(/C(\d{2})([A-Z])/i);
  if (shortMatch) {
    return {
      camera: parseInt(shortMatch[1], 10),
      rua:    shortMatch[2],
      quadra: 0,
      numero: 0
    };
  }
  // Qualquer outro caso vai para o fim
  return { camera: Infinity, rua: 'Z', quadra: Infinity, numero: Infinity };
}

// 2) Compara dois registros pela ordem: camera → rua → quadra → numero
function compararOrigem(a, b) {
  const A = extrairChaveOrdenacao(a.origem);
  const B = extrairChaveOrdenacao(b.origem);

  if (A.camera !== B.camera)   return A.camera - B.camera;
  if (A.rua    !== B.rua)      return A.rua < B.rua ? -1 : 1;
  if (A.quadra !== B.quadra)   return A.quadra - B.quadra;
  return A.numero - B.numero;
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
  // Validação adicional para garantir que os dados têm o formato esperado
  if (cabecalho.length < 17) {
    alert('Formato de dados inválido. O cabeçalho não possui o número esperado de colunas.');
    return;
  }
  
  const dadosLinhas = linhas.slice(1);
  const movimentacoes = dadosLinhas.reduce((acc, linha) => {
    const cols = linha.split('\t');
    // Ignora linhas que não tenham todas as colunas necessárias
    if (cols.length < 17) {
      console.warn('Linha ignorada por não ter colunas suficientes:', linha);
      return acc;
    }
    acc.push({
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
    });
    return acc;
  }, []);
  
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
  
  // Mostra a barra de pesquisa e exibe os botões
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
        <th>GRUPO</th>
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
        <td>${item.grupo || ''}</td>
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
function realizarPesquisa() {
  const termo = document.getElementById('searchInput').value.toLowerCase().trim();
  const grupos = document.querySelectorAll('#movimentacoesList .group-card');
  let encontrados = 0;

  if (termo === '') {
    grupos.forEach(grupo => {
      const details = grupo.querySelector('.group-details');
      details.style.display = 'block'; // Mostrar todos os grupos
      const linhas = details.querySelectorAll('tbody tr');
      linhas.forEach(linha => {
        linha.style.display = '';
      });
    });
    document.getElementById('searchResults').textContent = '';
    return;
  }

  grupos.forEach(grupo => {
    const details = grupo.querySelector('.group-details');
    const linhas = details.querySelectorAll('tbody tr');
    let correspondentesNoGrupo = 0;

    linhas.forEach(linha => {
      const etiqueta = linha.dataset.etiqueta.toLowerCase();
      const produto = linha.dataset.produto.toLowerCase();
      if (etiqueta.includes(termo) || produto.includes(termo)) {
        linha.style.display = '';
        correspondentesNoGrupo++;
      } else {
        linha.style.display = 'none';
      }
    });

    if (correspondentesNoGrupo > 0) {
      details.style.display = 'block';
      encontrados += correspondentesNoGrupo;
    } else {
      details.style.display = 'none';
    }
  });

  document.getElementById('searchResults').textContent = `${encontrados} encontrados`;
}

// Função para exportar PDF
function exportarPDF(oeKey, placa, destinoGrade, registros) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'pt', 'a4');
  
  // Configurar fonte para todo o documento
  doc.setFont('helvetica', 'bold');
  
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
  
  // Título
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
  
  // Centralizar OE dentro do quadrado
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const oeWidth = doc.getTextWidth(oeKey);
  doc.text(oeKey, 430 + (120 - oeWidth) / 2, 60);
  
  // Data/hora centralizada na parte inferior do quadrado
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const dataWidth = doc.getTextWidth(dataHoraFormatada);
  doc.text(dataHoraFormatada, 430 + (120 - dataWidth) / 2, 72);
  
  // Seção de operador
  doc.setFillColor(...corAmarela);
  doc.rect(40, 100, 515, 30, 'F');
  
  doc.setFontSize(11);
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
  doc.setFontSize(11);
  const placaWidth = doc.getTextWidth(placa || 'N/A');
  doc.text(placa || 'N/A', 40 + (60 - placaWidth) / 2, 153);
  
  // DESTINO - substituída pelo valor real e centralizada
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
  cols.forEach((col) => {
    doc.rect(posX, 160, col.width, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(col.text, posX + (col.width/2 - doc.getTextWidth(col.text)/2), 173);
    posX += col.width;
  });
  
  // Conteúdo da tabela - dados
  let posY = 180;
  
  registros.forEach((item) => {
    posX = 40;
    cols.forEach((col, i) => {
      doc.rect(posX, posY, col.width, 20);
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
        case 8: conteudo = item.grupo || ''; break;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      if (i === 2 && conteudo.length > 35) {
        conteudo = conteudo.substring(0, 35) + '...';
      } else if (i !== 0 && i !== 2 && conteudo.length > 12) {
        conteudo = conteudo.substring(0, 12) + '...';
      }
      if (i === 0) {
        doc.text(conteudo, posX + 2, posY + 12, { maxWidth: col.width - 4 });
      } else if (i === 2) {
        doc.text(conteudo, posX + 2, posY + 12, { maxWidth: col.width - 4 });
      } else {
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
