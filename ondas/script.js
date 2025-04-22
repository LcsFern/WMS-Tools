
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
  document.getElementById('importPopup').classList.add('show');
}
function closeImportPopup() {
  document.getElementById('importPopup').classList.remove('show');
}

// 3. Importação em massa (DocumentFragment para performance)
function processarImportacao() {
  const txt = document.getElementById('importTextarea').value.trim();
  if (!txt) { showInfoPopup('Cole os dados para importação.'); return; }

  const linhas = txt.split('\n');
  if (linhas.length < 2) { showInfoPopup('Dados insuficientes.'); return; }

  const cab = linhas[0];
  if (!cab.includes('OE') || !cab.includes('PLACA') || !cab.includes('DOCA') || !cab.includes('PESO')) {
    showInfoPopup('Cabeçalho inválido.'); return;
  }

  let sucessos = 0, falhas = 0;
  const tbody = document.getElementById('ondasTableBody');
  const frag = document.createDocumentFragment();

  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l) continue;
    const cols = l.split(/\t|    +/);
    if (cols.length < 3) { falhas++; continue; }

    const oe = cols[0].trim(), placa = cols[1].trim(), doca = cols[2].trim();
    const peso = cols[3]?.trim().replace('.', '').replace(',', '.') || '';
    const v = veiculosData.find(x => x["PLACA ROTEIRIZADA"] === placa) || {};
    const pallets = v["QTD PALLETS"] || '', destino = v["DESTINO"] || '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="linha-checkbox"></td>
      <td class="editable" onclick="editarCelula(this,'oe')">${oe}</td>
      <td class="editable" onclick="editarCelula(this,'placa')">${placa}</td>
      <td class="editable" onclick="editarCelula(this,'doca')">${doca}</td>
      <td>${peso}</td>
      <td>${pallets}</td>
      <td class="editable" onclick="editarCelula(this,'destino')">${destino}</td>
      <td class="editable" onclick="editarCelula(this,'status')">1ª ONDA</td>
      <td><button onclick="removerOnda(this)" style="background:#dc3545"><i class="fa-solid fa-trash"></i></button></td>
    `;
    frag.appendChild(tr);
    sucessos++;
  }

  if (sucessos) {
    tbody.appendChild(frag);
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
  debouncedAtualizarStorageOndas();
}

// 5. Edição in‑place; repuxa ao editar placa
function editarCelula(cel, tipo) {
  const orig = cel.textContent;
  const tr = cel.parentElement;
  if (tr.classList.contains('edit-row')) return;
  tr.classList.add('edit-row');

  if (tipo === 'status') {
    let opts = '';
    const atual = orig;
    const lista = [];
    document.querySelectorAll('#ondasTableBody td:nth-child(8)').forEach(c => {
      const t = c.textContent.trim(); if (t && !lista.includes(t)) lista.push(t);
    });
    for (let i = 1; i <= 10; i++) lista.push(`${i}ª ONDA`);
    lista.sort((a,b)=>parseInt(a)-parseInt(b)).forEach(v=>{
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
}

// 9. Confirmar e limpar
function confirmarLimparOndas() {
  showConfirmationPopup('Deseja limpar todas as ondas?', limparOndas);
}
function limparOndas() {
  document.querySelectorAll('#ondasTableBody tr').forEach(r => r.remove());
  localStorage.removeItem('ondas');
  localStorage.removeItem('gradeCompleta');
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
  if (g && JSON.parse(g).length) {
    const o = localStorage.getItem('ondas');
    if (!o || o !== g) {
      document.getElementById('ondasSection').classList.add('hidden');
      document.getElementById('gradeAlert').classList.remove('hidden');
      return true;
    }
  }
  document.getElementById('ondasSection').classList.remove('hidden');
  document.getElementById('gradeAlert').classList.add('hidden');
  return false;
}

// 12. Exportar PDF em background, com bordas e negrito
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
      styles: { fontSize: 10, fontStyle: 'bold', overflow: 'ellipsize' },
      headStyles: { fillColor: [0,141,76], textColor: [255,255,255], fontStyle: 'bold' },
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

// 13 & 14. Status em massa e seleção geral
function alterarStatusEmMassa() {
  document.getElementById('alterarStatusPopup').classList.add('show');
  const sel = document.getElementById('statusEmMassaSelect');
  sel.innerHTML = '';
  const lista = [];
  document.querySelectorAll('#ondasTableBody td:nth-child(8)').forEach(c => {
    const t = c.textContent.trim(); if (t && !lista.includes(t)) lista.push(t);
  });
  for (let i = 1; i <= 10; i++) lista.push(`${i}ª ONDA`);
  lista.sort((a, b) => parseInt(a) - parseInt(b)).forEach(o => {
    const opt = document.createElement('option'); opt.value = o; opt.textContent = o;
    sel.appendChild(opt);
  });
}
function aplicarAlteracaoStatusEmMassa() {
  const novo = document.getElementById('statusEmMassaSelect').value;
  const chks = document.querySelectorAll('.linha-checkbox:checked');
  if (!chks.length) { showInfoPopup('Selecione ao menos um veículo.'); return; }
  chks.forEach(cb => {
    const c = cb.closest('tr').querySelector('td:nth-child(8)'); c.textContent = novo;
    cb.checked = false;
  });
  document.getElementById('selecionarTodos').checked = false;
  document.getElementById('alterarStatusPopup').classList.remove('show');
  showInfoPopup(`Status alterado para ${novo} em ${chks.length} veículo(s).`);
  debouncedAtualizarStorageOndas();
}
function selecionarTodosCheckboxes() {
  const all = document.getElementById('selecionarTodos').checked;
  document.querySelectorAll('.linha-checkbox').forEach(cb => cb.checked = all);
}

// Inicialização
window.onload = function() {
  carregarVeiculos();
  if (!verificarGradeCarregada()) carregarOndas();
};
