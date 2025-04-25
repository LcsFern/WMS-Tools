let veiculosData = [];

// Debounce para evitar gravações repetidas no localStorage
function debounce(func, wait = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Mostra popup de mensagem customizado (uso geral)
function showInfoPopup(message) {
  const pop = document.getElementById('confirmPopup');
  document.getElementById('popupMessage').textContent = message;
  const btn = document.getElementById('confirmBtn');
  const cancel = document.getElementById('cancelBtn');
  btn.innerHTML = '<i class="fas fa-check"></i> OK';
  btn.onclick = closePopup;
  cancel.style.display = 'none';
  pop.classList.add('show');
}

// Fecha popup e restaura botões
function closePopup() {
  const pop = document.getElementById('confirmPopup');
  pop.classList.remove('show');
  const btn = document.getElementById('confirmBtn');
  const cancel = document.getElementById('cancelBtn');
  btn.innerHTML = '<i class="fas fa-check"></i> Sim';
  cancel.style.display = '';
}

// Atualiza localStorage com o estado atual da tabela
function atualizarStorageOndas() {
  const rows = document.querySelectorAll('#ondasTableBody tr');
  const dados = Array.from(rows).map(row => {
    const c = row.querySelectorAll('td');
    return {
      OE: c[1].textContent,
      "PLACA ROTEIRIZADA": c[2].textContent,
      DOCA: c[3].textContent,
      "PESO TOTAL": c[4].textContent,
      "QTD PALLETS": c[5].textContent,
      DESTINO: c[6].textContent,
      STATUS: c[7].textContent
    };
  });
  localStorage.setItem('ondas', JSON.stringify(dados));
}
const debouncedAtualizarStorageOndas = debounce(atualizarStorageOndas, 500);

// 1. Carrega JSON de veículos
function carregarVeiculos() {
  const fetchWithTimeout = (url, options, timeout = 5000) =>
    Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);

  fetchWithTimeout('veiculos.json')
    .then(resp => {
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      return resp.json();
    })
    .then(data => {
      console.log('Veículos carregados:', data.length);
      veiculosData = data;
    })
    .catch(err => {
      console.error('Erro ao carregar veiculos.json:', err);
      setTimeout(carregarVeiculos, 2000);
    });
}

// 2. Mostrar e fechar popup de importação
function showImportPopup() {
  // Preencher o dropdown de ondas no popup de importação
  const selectOndas = document.getElementById('ondaImportacaoSelect');
  selectOndas.innerHTML = '';
  
  // Lista única de ondas
  const listaOndas = [];
  for (let i = 1; i <= 10; i++) {
    listaOndas.push(`${i}ª ONDA`);
  }
  
  // Adicionar ondas existentes na tabela
  document.querySelectorAll('#ondasTableBody td:nth-child(8)').forEach(c => {
    const ondaText = c.textContent.trim();
    if (ondaText && !listaOndas.includes(ondaText)) {
      listaOndas.push(ondaText);
    }
  });
  
  // Ordenar ondas
  listaOndas.sort((a, b) => {
    const numA = parseInt(a) || 999;
    const numB = parseInt(b) || 999;
    return numA - numB;
  });
  
  // Adicionar ao dropdown sem duplicatas
  const ondasAdicionadas = new Set();
  listaOndas.forEach(onda => {
    if (!ondasAdicionadas.has(onda)) {
      const opt = document.createElement('option');
      opt.value = onda;
      opt.textContent = onda;
      selectOndas.appendChild(opt);
      ondasAdicionadas.add(onda);
    }
  });
  
  document.getElementById('importPopup').classList.add('show');
}
function closeImportPopup() {
  document.getElementById('importPopup').classList.remove('show');
}

// 3. Importação em massa com seleção de onda
function processarImportacao() {
  const txt = document.getElementById('importTextarea').value.trim();
  if (!txt) { showInfoPopup('Cole os dados para importação.'); return; }

  const linhas = txt.split('\n');
  if (linhas.length < 2) { showInfoPopup('Dados insuficientes.'); return; }

  // Obter cabeçalho e separar em colunas (detecta se usa tab ou múltiplos espaços)
  const cab = linhas[0];
  const separador = cab.includes('\t') ? /\t/ : /\s{2,}/;
  const colunas = cab.split(separador);
  
  // Procurar índices das colunas necessárias (case-insensitive)
  // Com prioridade para PESO PREVISTO sobre PESO LIQ.
  const indices = {
    oe: colunas.findIndex(col => /oe|viagem/i.test(col)),
    placa: colunas.findIndex(col => /placa/i.test(col)),
    doca: colunas.findIndex(col => /doca/i.test(col)),
    pesoPrevisto: colunas.findIndex(col => /peso\s+previsto/i.test(col)),
    pesoLiq: colunas.findIndex(col => /peso\s+liq/i.test(col))
  };
  
  // Priorizar PESO PREVISTO se existir, caso contrário usar PESO LIQ.
  const indicePeso = indices.pesoPrevisto !== -1 ? indices.pesoPrevisto : indices.pesoLiq;
  indices.peso = indicePeso;
  
  // Verificar se encontrou as colunas necessárias
  const colunasNaoEncontradas = [];
  if (indices.oe === -1) colunasNaoEncontradas.push("OE/VIAGEM");
  if (indices.placa === -1) colunasNaoEncontradas.push("PLACA");
  if (indices.doca === -1) colunasNaoEncontradas.push("DOCA");
  if (indices.peso === -1) colunasNaoEncontradas.push("PESO PREVISTO ou PESO LIQ.");
  
  if (colunasNaoEncontradas.length > 0) {
    showInfoPopup(`Colunas não encontradas: ${colunasNaoEncontradas.join(', ')}`);
    return;
  }

  // Obter onda selecionada para importação
  const ondaSelecionada = document.getElementById('ondaImportacaoSelect').value;
  
  let sucessos = 0, falhas = 0;
  const tbody = document.getElementById('ondasTableBody');
  const frag = document.createDocumentFragment();

  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;
    
    // Dividir linha usando o mesmo separador do cabeçalho
    const cols = l.split(separador);
    if (cols.length < Math.max(indices.oe, indices.placa, indices.doca, indices.peso) + 1) { 
      falhas++; 
      continue; 
    }

    // Extrair dados usando os índices detectados
    const oe = cols[indices.oe]?.trim() || '';
    const placa = cols[indices.placa]?.trim() || '';
    const doca = cols[indices.doca]?.trim() || '';
    
    // Tratamento do valor do peso
    let peso = cols[indices.peso]?.trim() || '';
    // Garantir que o peso seja um número formatado corretamente
    if (peso) {
      // Remove pontos de milhares e substitui vírgula por ponto para decimal
      peso = peso.replace(/\./g, '').replace(',', '.');
      // Se for um número válido, formata como número
      if (!isNaN(parseFloat(peso))) {
        peso = parseFloat(peso).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
    }
    
    // Se algum campo obrigatório estiver vazio, pula
    if (!oe || !placa || !doca) {
      falhas++;
      continue;
    }
    
    const v = veiculosData.find(x => x["PLACA ROTEIRIZADA"] === placa) || {};
    const pallets = v["QTD PALLETS"] || '';
    const destino = v["DESTINO"] || '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="linha-checkbox"></td>
      <td class="editable" onclick="editarCelula(this,'oe')">${oe}</td>
      <td class="editable" onclick="editarCelula(this,'placa')">${placa}</td>
      <td class="editable" onclick="editarCelula(this,'doca')">${doca}</td>
      <td>${peso}</td>
      <td>${pallets}</td>
      <td class="editable" onclick="editarCelula(this,'destino')">${destino}</td>
      <td class="editable" onclick="editarCelula(this,'status')">${ondaSelecionada}</td>
      <td><button onclick="removerOnda(this)" style="background:#dc3545"><i class="fa-solid fa-trash"></i></button></td>
    `;
    frag.appendChild(tr);
    sucessos++;
  }

  if (sucessos) {
    tbody.appendChild(frag);
    ordenarTabelaPorOnda(); // Ordena a tabela após adicionar novas linhas
    showInfoPopup(`Importados: ${sucessos} | Ignorados: ${falhas}`);
    document.getElementById('importTextarea').value = '';
    closeImportPopup();
    debouncedAtualizarStorageOndas();
  } else {
    showInfoPopup('Nenhum veículo importado.');
  }
}

// 4. Adiciona linha manual e atualiza storage
function adicionarLinhaTabelaOnda(oe, placa, doca, peso, pallets, destino, status) {
  const tbody = document.getElementById('ondasTableBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="checkbox" class="linha-checkbox"></td>
    <td class="editable" onclick="editarCelula(this,'oe')">${oe}</td>
    <td class="editable" onclick="editarCelula(this,'placa')">${placa}</td>
    <td class="editable" onclick="editarCelula(this,'doca')">${doca}</td>
    <td>${peso}</td>
    <td>${pallets}</td>
    <td class="editable" onclick="editarCelula(this,'destino')">${destino}</td>
    <td class="editable" onclick="editarCelula(this,'status')">${status}</td>
    <td><button onclick="removerOnda(this)" style="background:#dc3545"><i class="fa-solid fa-trash"></i></button></td>
  `;
  tbody.appendChild(tr);
  ordenarTabelaPorOnda(); // Reordenar após adicionar linha
  debouncedAtualizarStorageOndas();
}

// 5. Edição in-place; repuxa ao editar placa
function editarCelula(cel, tipo) {
  const orig = cel.textContent;
  const tr = cel.parentElement;
  if (tr.classList.contains('edit-row')) return;
  tr.classList.add('edit-row');

  if (tipo === 'status') {
    let opts = '';
    const atual = orig;
    const ondasSet = new Set();
    
    // Adicionar ondas existentes na tabela
    document.querySelectorAll('#ondasTableBody td:nth-child(8)').forEach(c => {
      const t = c.textContent.trim(); 
      if (t) ondasSet.add(t);
    });
    
    // Adicionar ondas padrão
    for (let i = 1; i <= 10; i++) {
      ondasSet.add(`${i}ª ONDA`);
    }
    
    // Ordenar ondas
    const listaOndas = Array.from(ondasSet);
    listaOndas.sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "999");
      const numB = parseInt(b.match(/\d+/)?.[0] || "999");
      return numA - numB;
    });
    
    listaOndas.forEach(v => {
      opts += `<option value="${v}" ${v===atual?'selected':''}>${v}</option>`;
    });
    
    cel.innerHTML = `<select>${opts}</select>`;
  } else {
    cel.innerHTML = `<input type="text" value="${orig}">`;
  }

  const input = cel.querySelector('input, select');
  input.focus();

  function confirmar() {
    tr.classList.remove('edit-row');
    const val = input.value.trim();
    cel.innerHTML = val;
    if (tipo === 'placa') {
      const v = veiculosData.find(x => x["PLACA ROTEIRIZADA"] === val) || {};
      const cells = tr.querySelectorAll('td');
      cells[5].textContent = v["QTD PALLETS"] || '';
      cells[6].textContent = v["DESTINO"] || '';
    }
    if (tipo === 'status') {
      // Reordenar a tabela quando mudar o status/onda
      ordenarTabelaPorOnda();
    }
    debouncedAtualizarStorageOndas();
  }
  function cancelar() {
    tr.classList.remove('edit-row');
    cel.innerHTML = orig;
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
  });
  input.addEventListener('blur', confirmar);
}

// 6. Remove linha e atualiza storage
function removerOnda(btn) {
  btn.closest('tr').remove();
  debouncedAtualizarStorageOndas();
}

// 7. Salvar ondas como Grade
function salvarOndas() {
  const rows = document.querySelectorAll('#ondasTableBody tr');
  const hoje = new Date().toLocaleDateString('pt-BR');
  const grade = Array.from(rows).map(row => {
    const c = row.querySelectorAll('td');
    const reg = {
      OE: c[1].textContent,
      "PLACA ROTEIRIZADA": c[2].textContent,
      DOCA: c[3].textContent,
      "PESO TOTAL": c[4].textContent,
      "PESO ENTREGAS": c[4].textContent,
      "QTD PALLETS": c[5].textContent,
      DESTINO: c[6].textContent,
      STATUS: c[7].textContent,
      DATA: hoje,
      "QTDE CXS": "0",
      TRANSPORTADORA: "",
      "QUANT. ENTREGAS": "1"
    };
    const v = veiculosData.find(x => x["PLACA ROTEIRIZADA"] === reg["PLACA ROTEIRIZADA"]) || {};
    reg.TRANSPORTADORA = v.TRANSPORTADORA || "";
    return reg;
  });
  localStorage.setItem('gradeCompleta', JSON.stringify(grade));
  localStorage.setItem('ondas', JSON.stringify(grade));
  localStorage.removeItem('gradeCarregadaExternamente'); // Remove a flag de carregamento externo
  showInfoPopup('Ondas salvas como Grade!');
}

// 8. Carrega ondas ao iniciar
function carregarOndas() {
  const o = localStorage.getItem('ondas');
  if (o) {
    carregarDadosNaTabela(JSON.parse(o));
    return;
  }
  const g = localStorage.getItem('gradeCompleta');
  if (g) {
    const grade = JSON.parse(g);
    if (grade.length) carregarDadosNaTabela(grade);
  }
}
function carregarDadosNaTabela(dados) {
  const tbody = document.getElementById('ondasTableBody');
  dados.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="linha-checkbox"></td>
      <td class="editable" onclick="editarCelula(this,'oe')">${item.OE||''}</td>
      <td class="editable" onclick="editarCelula(this,'placa')">${item["PLACA ROTEIRIZADA"]||''}</td>
      <td class="editable" onclick="editarCelula(this,'doca')">${item.DOCA||''}</td>
      <td>${item["PESO TOTAL"]||item["PESO ENTREGAS"]||''}</td>
      <td>${item["QTD PALLETS"]||''}</td>
      <td class="editable" onclick="editarCelula(this,'destino')">${item.DESTINO||''}</td>
      <td class="editable" onclick="editarCelula(this,'status')">${item.STATUS||''}</td>
      <td><button onclick="removerOnda(this)" style="background:#dc3545"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
  ordenarTabelaPorOnda(); // Ordenar após carregar dados
}

// 9. Confirmar e limpar
function confirmarLimparOndas() {
  showConfirmationPopup('Deseja limpar todas as ondas?', limparOndas);
}

function limparOndas() {
  try {
    // Abordagem mais robusta para remoção de linhas
    const tbody = document.getElementById('ondasTableBody');
    while (tbody.firstChild) {
      tbody.removeChild(tbody.firstChild);
    }
    
    // Limpar dados do localStorage em uma operação separada
    localStorage.removeItem('ondas');
    localStorage.removeItem('gradeCompleta');
    
    showInfoPopup('Todas as ondas foram removidas com sucesso.');
  } catch (error) {
    console.error('Erro ao limpar ondas:', error);
    showInfoPopup('Ocorreu um erro ao limpar as ondas. Tente recarregar a página.');
  }
}
// 10. Popup de confirmação
function showConfirmationPopup(msg, fn) {
  const pop = document.getElementById('confirmPopup');
  document.getElementById('popupMessage').textContent = msg;
  const btn = document.getElementById('confirmBtn');
  const cancel = document.getElementById('cancelBtn');
  btn.innerHTML = '<i class="fas fa-check"></i> Sim';
  cancel.style.display = '';
  btn.onclick = () => { fn(); closePopup(); };
  cancel.onclick = closePopup;
  pop.classList.add('show');
}

// 11. Verifica grade carregada
function verificarGradeCarregada() {
  const g = localStorage.getItem('gradeCompleta');
  const o = localStorage.getItem('ondas');
  
  // Se temos uma grade completa
  if (g && JSON.parse(g).length) {
    // Se não temos ondas salvas OU temos uma flag indicando que a grade foi carregada externamente
    if (!o || localStorage.getItem('gradeCarregadaExternamente') === 'true') {
      document.getElementById('ondasSection').classList.add('hidden');
      document.getElementById('gradeAlert').classList.remove('hidden');
      return true;
    }
  }
  
  // Marcamos que qualquer grade carregada a partir daqui é do próprio Ondas
  localStorage.removeItem('gradeCarregadaExternamente');
  document.getElementById('ondasSection').classList.remove('hidden');
  document.getElementById('gradeAlert').classList.add('hidden');
  return false;
}

// 12. Exportar PDF com bordas mais grossas
function exportarPDF() {
  if (!window.jspdf || typeof window.jsPDF !== 'function') {
    showInfoPopup('Biblioteca jsPDF não carregada.'); return;
  }
  setTimeout(() => {
    const doc = new window.jsPDF({ unit:'mm', format:'a4' });
    const dh = new Date().toLocaleString('pt-BR');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ONDAS', doc.internal.pageSize.getWidth()/2, 15, { align:'center' });
    doc.setFontSize(11);
    doc.text(`Data/Hora: ${dh}`, doc.internal.pageSize.getWidth()/2, 22, { align:'center' });

    const rows = document.querySelectorAll('#ondasTableBody tr');
    const body = Array.from(rows).map(r => {
      const c = r.querySelectorAll('td');
      return [c[1].textContent, c[2].textContent, c[3].textContent,
              c[4].textContent, c[5].textContent, c[6].textContent,
              c[7].textContent, ''];
    });

    if (typeof doc.autoTable !== 'function') {
      showInfoPopup('Plugin autoTable do jsPDF não carregado.'); return;
    }

    doc.autoTable({
      head: [['OE','PLACA','DOCA','PESO','PALLETS','OBSERVAÇÃO','STATUS','CONFERENTE']],
      body,
      theme: 'grid',
      margin: { top: 30, left: 10, right: 10 },
      styles: { 
        fontSize: 10, 
        fontStyle: 'bold', 
        overflow: 'ellipsize',
        lineWidth: 0.5, // Bordas mais grossas
        lineColor: [0, 0, 0] // Cor preta para as bordas
      },
      headStyles: { 
        fillColor: [0,141,76], 
        textColor: [255,255,255], 
        fontStyle: 'bold',
        lineWidth: 0.5 // Bordas mais grossas para o cabeçalho também
      },
      didDrawPage: data => {
        const total = doc.internal.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.text(`Página ${i}`, doc.internal.pageSize.getWidth()-20, doc.internal.pageSize.getHeight()-10);
        }
      }
    });

    doc.save(`Ondas_${new Date().toISOString().split('T')[0]}.pdf`);
  }, 0);
}

// 13. Exportar CSV
function exportarCSV() {
  const rows = document.querySelectorAll('#ondasTableBody tr');
  if (!rows.length) {
    showInfoPopup('Não há dados para exportar.'); 
    return;
  }
  
  // Criar o cabeçalho CSV com separador ponto e vírgula (melhor para Excel)
  let csvContent = "OE;PLACA;DOCA;PESO;PALLETS;OBSERVACAO;STATUS\n";
  
  // Adicionar cada linha da tabela
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    // Ignorar a primeira célula (checkbox) e a última (botão excluir)
    const values = [
      cells[1].textContent, // OE
      cells[2].textContent, // PLACA
      cells[3].textContent, // DOCA
      cells[4].textContent, // PESO
      cells[5].textContent, // PALLETS
      cells[6].textContent, // OBSERVAÇÃO
      cells[7].textContent  // STATUS
    ].join(';'); // Usa ponto e vírgula como separador para compatibilidade com Excel
    csvContent += values + "\n";
  });
  
  // Adicionar BOM (Byte Order Mark) para indicar UTF-8 ao Excel
  const BOM = '\uFEFF';
  const csvContentWithBOM = BOM + csvContent;
  
  // Criar um blob com o conteúdo CSV usando codificação UTF-8
  const blob = new Blob([csvContentWithBOM], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Criar um link para download e simular o clique
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Ondas_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 14. Popup para escolher formato de exportação
function showExportOptions() {
  const pop = document.getElementById('confirmPopup');
  document.getElementById('popupMessage').innerHTML = 'Escolha o formato de exportação:';
  const actionDiv = document.querySelector('#confirmPopup .popup-actions');
  actionDiv.innerHTML = `
    <button onclick="exportarPDF(); closePopup();" class="btn-yes">
      <i class="fa-solid fa-file-pdf"></i> PDF
    </button>
    <button onclick="exportarCSV(); closePopup();" class="btn-yes" style="background: #4a72da;">
      <i class="fa-solid fa-file-csv"></i> CSV
    </button>
    <button class="btn-no" onclick="closePopup()">
      <i class="fa-solid fa-times"></i> Cancelar
    </button>
  `;
  pop.classList.add('show');
}

// 15. Alterar status em massa
function alterarStatusEmMassa() {
  document.getElementById('alterarStatusPopup').classList.add('show');
  const sel = document.getElementById('statusEmMassaSelect');
  sel.innerHTML = '';
  
  // Usar Set para evitar duplicatas
  const ondasSet = new Set();
  
  // Adicionar ondas existentes
  document.querySelectorAll('#ondasTableBody td:nth-child(8)').forEach(c => {
    const t = c.textContent.trim(); 
    if (t) ondasSet.add(t);
  });
  
  // Adicionar ondas padrão
  for (let i = 1; i <= 10; i++) {
    ondasSet.add(`${i}ª ONDA`);
  }
  
  // Converter para array, ordenar e adicionar ao dropdown
  const listaOndas = Array.from(ondasSet);
  listaOndas.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || "999");
    const numB = parseInt(b.match(/\d+/)?.[0] || "999");
    return numA - numB;
  });
  
  listaOndas.forEach(o => {
    const opt = document.createElement('option'); 
    opt.value = o; 
    opt.textContent = o;
    sel.appendChild(opt);
  });
}

// 16. Aplicar alteração de status em massa
function aplicarAlteracaoStatusEmMassa() {
  const novo = document.getElementById('statusEmMassaSelect').value;
  const chks = document.querySelectorAll('.linha-checkbox:checked');
  if (!chks.length) { showInfoPopup('Selecione ao menos um veículo.'); return; }
  chks.forEach(cb => {
    const c = cb.closest('tr').querySelector('td:nth-child(8)'); 
    c.textContent = novo;
    cb.checked = false;
  });
  document.getElementById('selecionarTodos').checked = false;
  document.getElementById('alterarStatusPopup').classList.remove('show');
  showInfoPopup(`Status alterado para ${novo} em ${chks.length} veículo(s).`);
  debouncedAtualizarStorageOndas();
}

// 17. Selecionar todos os checkboxes
function selecionarTodosCheckboxes() {
  const all = document.getElementById('selecionarTodos').checked;
  document.querySelectorAll('.linha-checkbox').forEach(cb => cb.checked = all);
}

// 18. Função para ordenar a tabela por onda
function ordenarTabelaPorOnda() {
  const tbody = document.getElementById('ondasTableBody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  
  // Função para extrair o número da onda
  function extrairNumeroOnda(texto) {
    const match = texto.match(/(\d+)/);
    return match ? parseInt(match[1]) : 999; // Se não for numérico, coloca no final
  }
  
  // Ordenar linhas por número de onda
  rows.sort((a, b) => {
    const ondaA = a.querySelector('td:nth-child(8)').textContent;
    const ondaB = b.querySelector('td:nth-child(8)').textContent;
    return extrairNumeroOnda(ondaA) - extrairNumeroOnda(ondaB);
  });
  
  // Remover todas as linhas
  rows.forEach(row => tbody.removeChild(row));
  
  // Adicionar linhas ordenadas
  rows.forEach(row => tbody.appendChild(row));
}

// Inicialização
window.onload = function() {
  carregarVeiculos();
  if (!verificarGradeCarregada()) carregarOndas();
};