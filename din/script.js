// Carrega as ondas do localStorage ou inicializa um array vazio
let ondas = JSON.parse(localStorage.getItem('ondasdin')) || [];
// Determina o número da onda atual com base no maior número existente
let ondaAtual = ondas.length > 0 ? Math.max(...ondas.map(o => o.numero)) : 0;

// Configurações iniciais ao carregar a página
window.addEventListener('load', () => {
  if (ondas.length > 0) {
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

  // Listener para o botão "Processar Mais"
  document.getElementById('btnProcessarMais').addEventListener('click', () => {
    document.getElementById('processMoreContainer').classList.add('hidden');
    document.getElementById('importSection').classList.remove('hidden');
    document.getElementById('movimentacaoInput').value = '';
  });

  // Listener para a barra de pesquisa
  document.getElementById('searchInput').addEventListener('input', realizarPesquisa);
});



// Função para processar os dados colados do Excel
function processarMovimentacao(rawText) {
  // Remove espaços em branco no início e fim do texto bruto
  rawText = rawText.trim();
  if (!rawText) {
    showCustomAlert('Cole os dados copiados do Excel.');
    return;
  }

  // Divide o texto em linhas, remove espaços de cada linha e filtra linhas vazias
  const linhas = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');
  if (linhas.length < 2) {
    showCustomAlert('O texto deve conter o cabeçalho e ao menos uma linha de dados.');
    return;
  }

  // A primeira linha é o cabeçalho, as demais são dados
  const cabecalho = linhas[0].split('\t');
  const dadosLinhas = linhas.slice(1);

  // Mapeia as colunas de cada linha de dados para um objeto de movimentação
  let movimentacoesTemp = dadosLinhas.map(linha => {
    const cols = linha.split('\t');
    // Cria um objeto para cada linha, associando colunas aos campos esperados
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

  // Agrupa as movimentações recém-coladas por chave composta (etiqueta, produto, origem, destino)
  // Isso consolida itens idênticos DENTRO DA MESMA COLAGEM, somando quantidades e pesos.
  let movimentacoesAgrupadasDoPaste = agruparMovimentacoes(movimentacoesTemp);

  // --- INÍCIO DA LÓGICA DE VERIFICAÇÃO DE DUPLICATAS CONTRA ONDAS EXISTENTES ---
  // 1. Coleta todas as movimentações de todas as ondas já armazenadas.
  const todasAsMovimentacoesExistentes = ondas.flatMap(onda => [...onda.congelado, ...onda.resfriado]);
  let numeroDeDuplicadosIgnorados = 0;

  // 2. Filtra as movimentações recém-coladas (já agrupadas)
  //    para remover aquelas que já existem em ondas anteriores.
  const movimentacoesRealmenteNovas = movimentacoesAgrupadasDoPaste.filter(novaMov => {
    // Verifica se existe alguma movimentação nas ondas anteriores que corresponda
    // à chave da movimentação atual (etiqueta, produto, origem, destino).
    const isDuplicate = todasAsMovimentacoesExistentes.some(existente =>
      existente.etiquetaPalete === novaMov.etiquetaPalete &&
      existente.codProduto === novaMov.codProduto &&
      existente.origem === novaMov.origem &&
      existente.destino === novaMov.destino
      // NOTA: Se a definição de "duplicata entre ondas" precisar incluir outros campos
      // (ex: quantidade, peso), eles devem ser adicionados a esta condição.
    );

    if (isDuplicate) {
      // Registra no console a duplicata encontrada e não a inclui.
      console.warn(`Item duplicado (já existente em onda anterior): Etiqueta ${novaMov.etiquetaPalete}, Produto ${novaMov.codProduto}, Origem ${novaMov.origem}. Não será carregado.`);
      numeroDeDuplicadosIgnorados++;
      return false; // Indica que este item não deve ser incluído na lista de 'movimentacoesRealmenteNovas'.
    }
    return true; // Item não duplicado, pode ser incluído.
  });

  // 3. Verifica se, após o filtro, todos os itens colados eram duplicatas.
  if (movimentacoesAgrupadasDoPaste.length > 0 && movimentacoesRealmenteNovas.length === 0) {
    showCustomAlert('Todos os itens colados já existem em ondas anteriores e não foram carregados novamente.');
    document.getElementById('movimentacaoInput').value = ''; // Limpa o textarea.
    return; // Interrompe o processamento, pois não há novos itens.
  }

  // 4. Informa ao usuário se alguns itens foram ignorados por serem duplicatas.
  if (numeroDeDuplicadosIgnorados > 0) {
    showCustomAlert(`${numeroDeDuplicadosIgnorados} item(ns) duplicado(s) foram encontrados (já existiam em ondas anteriores) e não foram carregados novamente.`);
  }
  // --- FIM DA LÓGICA DE VERIFICAÇÃO DE DUPLICATAS ---

  // Se não restarem movimentações válidas após o filtro de duplicatas.
  if (movimentacoesRealmenteNovas.length === 0) {
    // Esta situação pode ocorrer se todos os itens colados eram duplicatas de ondas anteriores,
    // ou se os itens que não eram duplicatas não se qualificaram para nenhuma categoria (congelado/resfriado).
    showCustomAlert('Nenhum item novo para adicionar nesta operação (após verificação de duplicatas e regras de categoria).');
    document.getElementById('movimentacaoInput').value = ''; // Limpa o textarea.
    return;
  }

  // Incrementa o contador da onda atual.
  ondaAtual++;
  const dataCriacaoOnda = new Date().toLocaleString('pt-BR');

  // Cria o objeto para a nova onda.
  const novaOnda = {
    numero: ondaAtual,
    congelado: [],
    resfriado: [],
    exportado: { congelado: false, resfriado: false },
    dataCriacao: dataCriacaoOnda // Adiciona a data de criação à onda
  };

  // Distribui as movimentações realmente novas nas categorias congelado ou resfriado.
  movimentacoesRealmenteNovas.forEach(item => {
    const origem = item.origem;
    // Verifica os primeiros 3 caracteres do código de origem para categorizar.
    if (['C01', 'C02', 'C03'].includes(origem.slice(0, 3))) {
      novaOnda.congelado.push(item);
    } else if (origem.slice(0, 3) === 'C04') {
      novaOnda.resfriado.push(item);
    }
    // Itens que não se encaixam nas categorias acima serão ignorados.
  });

  // Se a nova onda não contiver itens (nem congelados, nem resfriados) após a categorização.
  if (novaOnda.congelado.length === 0 && novaOnda.resfriado.length === 0) {
    showCustomAlert('Nenhuma movimentação válida (após filtro de duplicados e categorização por temperatura) encontrada para criar uma nova onda.');
    document.getElementById('movimentacaoInput').value = ''; // Limpa o textarea.
    ondaAtual--; // Decrementa o contador, pois a onda não será efetivamente criada/salva.
    return;
  }

  // Ordena os itens dentro de cada categoria da nova onda.
  novaOnda.congelado.sort(compararOrigem);
  novaOnda.resfriado.sort(compararOrigem);

  // Adiciona a nova onda ao array de ondas.
  ondas.push(novaOnda);
  // Salva o array atualizado de ondas no localStorage.
  localStorage.setItem('ondasdin', JSON.stringify(ondas));

  // Atualiza a exibição na tela, mostra a barra de pesquisa e oculta a área de importação.
  exibirMovimentacoes();
  mostrarBarraPesquisa();
  ocultarImportacaoExibirMais();
  document.getElementById('movimentacaoInput').value = ''; // Limpa o textarea após o processamento bem-sucedido.
}

// Função auxiliar para agrupar movimentações
function agruparMovimentacoes(movimentacoes) {
  const grupos = {};
  
  movimentacoes.forEach(item => {
    // Criamos uma chave única baseada nos critérios de agrupamento
    const chave = `${item.etiquetaPalete}|${item.codProduto}|${item.origem}|${item.destino}`;
    
    if (!grupos[chave]) {
      grupos[chave] = { ...item };
    } else {
      // Convertemos as strings de quantidade e peso para números, lidando com diferentes formatos
      // Substituímos vírgula por ponto para tratar valores decimais no formato brasileiro
      const qtdeAtual = parseFloat(grupos[chave].qtde.replace(',', '.')) || 0;
      const qtdeNova = parseFloat(item.qtde.replace(',', '.')) || 0;
      grupos[chave].qtde = (qtdeAtual + qtdeNova).toString().replace('.', ',');
      
      const pesoAtual = parseFloat(grupos[chave].peso.replace(',', '.')) || 0;
      const pesoNovo = parseFloat(item.peso.replace(',', '.')) || 0;
      grupos[chave].peso = (pesoAtual + pesoNovo).toString().replace('.', ',');
    }
  });
  
  // Convertemos o objeto de volta para array
  return Object.values(grupos);
}

// Função auxiliar para extrair chave de ordenação
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
      camera: parseInt(match[1], 10),    // ex: "03" → 3
      rua:    match[2],                  // ex: "C"
      quadra: parseInt(match[3], 10),    // ex: "02" → 2, "36" → 36
      numero: parseInt(match[4], 10)     // ex: "2"  → 2
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

// Função de comparação para ordenar por origem
function compararOrigem(a, b) {
  const A = extrairChaveOrdenacao(a.origem);
  const B = extrairChaveOrdenacao(b.origem);

  if (A.camera !== B.camera)   return A.camera - B.camera;
  if (A.rua    !== B.rua)      return A.rua < B.rua ? -1 : 1;
  if (A.quadra !== B.quadra)   return A.quadra - B.quadra;
  return A.numero - B.numero;
}

// Função para exibir as movimentações na interface
function exibirMovimentacoes() {
  const container = document.getElementById('movimentacoesContainer');
  container.classList.remove('hidden');
  const lista = document.getElementById('movimentacoesList');
  lista.innerHTML = '';

  const pendentes = ondas.filter(onda => !isOndaFinalizada(onda));
  const finalizadas = ondas.filter(onda => isOndaFinalizada(onda));

  [...pendentes, ...finalizadas].forEach(onda => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.onda = onda.numero;

    const finalizada = isOndaFinalizada(onda);
    if (finalizada) {
      card.classList.add('finalized-card');
    }

    const header = document.createElement('div');
    header.className = 'group-header';

    let btnCongelado = onda.congelado.length > 0 ? '<button class="btnExportar btnExportarCongelado">Congelado <i class="fa-solid fa-file-pdf"></i></button>' : '';
    let btnResfriado = onda.resfriado.length > 0 ? '<button class="btnExportar btnExportarResfriado">Resfriado <i class="fa-solid fa-file-pdf"></i></button>' : '';

    header.innerHTML = `
      <span class="wave-badge">ONDA ${onda.numero} - ${onda.dataCriacao}</span>
      <div class="group-info">
        <div><strong>Total Congelado:</strong> ${onda.congelado.length}</div>
        <div><strong>Total Resfriado:</strong> ${onda.resfriado.length}</div>
      </div>
      <div class="group-actions">
        <button class="btnMostrar">Mostrar Dinâmicos</button>
        <div class="export-container">
          ${btnCongelado}
          ${btnResfriado}
          <input type="checkbox" class="export-checkbox" ${finalizada ? 'checked' : ''} disabled>
          <span class="conferencia-label">Finalizado</span>
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
    [...onda.congelado, ...onda.resfriado].forEach(item => {
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

    const btnMostrar = header.querySelector('.btnMostrar');
    btnMostrar.addEventListener('click', () => {
      if (details.style.display === 'none' || !details.style.display) {
        details.style.display = 'block';
        btnMostrar.textContent = 'Ocultar Dinâmicos';
      } else {
        details.style.display = 'none';
        btnMostrar.textContent = 'Mostrar Dinâmicos';
      }
    });

    const btnExportarCongelado = header.querySelector('.btnExportarCongelado');
    if (btnExportarCongelado) {
      btnExportarCongelado.addEventListener('click', (e) => {
        e.stopPropagation();
        exportarPDF(onda.numero, 'congelado', onda.congelado);
        onda.exportado.congelado = true;
        localStorage.setItem('ondasdin', JSON.stringify(ondas));
        if (isOndaFinalizada(onda)) {
          header.querySelector('.export-checkbox').checked = true;
          card.classList.add('finalized-card');
        }
      });
    }

    const btnExportarResfriado = header.querySelector('.btnExportarResfriado');
    if (btnExportarResfriado) {
      btnExportarResfriado.addEventListener('click', (e) => {
        e.stopPropagation();
        exportarPDF(onda.numero, 'resfriado', onda.resfriado);
        onda.exportado.resfriado = true;
        localStorage.setItem('ondasdin', JSON.stringify(ondas));
        if (isOndaFinalizada(onda)) {
          header.querySelector('.export-checkbox').checked = true;
          card.classList.add('finalized-card');
        }
      });
    }

    card.appendChild(header);
    card.appendChild(details);
    lista.appendChild(card);
  });
}

// Verifica se uma onda está finalizada
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

// Função para exportar os dados em PDF
function exportarPDF(ondaNum, tipo, registros) {
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
  doc.text('PICKING DINÂMICO', 50, 65);

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

  doc.save(`Picking_Dinamico_ONDA_${ondaNum}_${tipo}.pdf`);
}


// Funções auxiliares para a interface
function mostrarBarraPesquisa() {
  document.getElementById('searchContainer').classList.remove('hidden');
}

function ocultarImportacaoExibirMais() {
  document.getElementById('importSection').classList.add('hidden');
  document.getElementById('processMoreContainer').classList.remove('hidden');
}

// Função de pesquisa corrigida
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
// Função para mostrar o pop-up customizado
// tipo pode ser 'warning', 'success', 'error' ou 'info' (default)
function showCustomAlert(message, type = 'info') {
  // Pega os elementos do pop-up no HTML
  const popup = document.getElementById('customAlertPopup');
  const alertMessage = document.getElementById('customAlertMessage');
  const alertIcon = document.getElementById('customAlertIcon');
  const okButton = document.getElementById('customAlertOkButton');
  const closeButton = document.querySelector('.custom-popup-close-btn');

  // Define a mensagem do pop-up
  alertMessage.textContent = message;

  // Define o ícone com base no tipo de alerta
  // Certifique-se de ter FontAwesome incluído no seu HTML para os ícones
  let iconClass = 'fa-solid fa-circle-info'; // Ícone padrão
  if (type === 'warning') {
    iconClass = 'fa-solid fa-triangle-exclamation'; // Ícone de aviso
  } else if (type === 'success') {
    iconClass = 'fa-solid fa-circle-check'; // Ícone de sucesso
  } else if (type === 'error') {
    iconClass = 'fa-solid fa-circle-xmark'; // Ícone de erro
  }
  alertIcon.innerHTML = `<i class="${iconClass}"></i>`; // Adiciona o ícone

  // Função para fechar o pop-up
  const closePopup = () => {
    popup.classList.add('hidden');
  };

  // Adiciona evento para fechar ao clicar no botão OK
  okButton.onclick = closePopup;
  // Adiciona evento para fechar ao clicar no botão X
  closeButton.onclick = closePopup;

  // Adiciona evento para fechar ao clicar fora do conteúdo do pop-up (no overlay)
  popup.onclick = (event) => {
    if (event.target === popup) { // Verifica se o clique foi no overlay e não no conteúdo
      closePopup();
    }
  };

  // Mostra o pop-up
  popup.classList.remove('hidden');
  okButton.focus(); // Coloca o foco no botão OK para acessibilidade
}