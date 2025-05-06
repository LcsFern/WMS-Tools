// index.js

// Constantes de cores do site (reaproveitáveis em JS se necessário)
const COLORS = {
    accent: '#34c759'
  };
  
  // Copia texto (OE) para a área de transferência
  function copiarOE(texto) {
    navigator.clipboard.writeText(texto);
    alert('OE copiado!');
  }
  
  // Normaliza string para uso em IDs de elementos
  function normKey(key) {
    return key.replace(/[^A-Za-z0-9]/g, '_');
  }
  
  // Campos que receberão sugestão de preenchimento com base nos valores já existentes
  const suggestionKeys = ['QTD PALLETS'];
  
  /**
   * Gera ou atualiza um <datalist> com todas as opções encontradas para uma key
   */
  function ensureDatalist(key) {
    const dlId = `datalist-${normKey(key)}`;
    let datalist = document.getElementById(dlId);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = dlId;
      document.body.appendChild(datalist);
    }
    // limpa opções antigas
    datalist.innerHTML = '';
    // busca todos os valores na grade
    const raw = localStorage.getItem("gradeCompleta");
    if (!raw) return dlId;
    let grade;
    try { grade = JSON.parse(raw); }
    catch { return dlId; }
    const seen = new Set();
    grade.slice(1).forEach(reg => {
      const val = reg[key] ?? '';
      if (val && !seen.has(val)) {
        seen.add(val);
        const opt = document.createElement('option');
        opt.value = val;
        datalist.appendChild(opt);
      }
    });
    return dlId;
  }
  
  // Cria um card de dados, com edição inline e swap minimalista para placas
  function criarCard(registro, index) {
    const card = document.createElement('div');
    card.className = 'data-card';
    card.dataset.index = index;
  
    // Monta header minimalista:
    const headerHTML = `
      <div class="card-header">
        <div class="oe-number">
          <span id="OE-${index}"
                class="oe-text"
                onclick="inlineEditar(${index}, 'OE')"
                style="cursor:pointer;">
            ${registro.OE}
          </span>
          <i class="fa-regular fa-copy copy-oe"
             onclick="copiarOE('${registro.OE}')"></i>
        </div>
        <div class="placa-container">
          <i class="fa-solid fa-truck-plate placa-icon"></i>
          <span id="PLACA_ROTEIRIZADA-${index}"
                class="placa-value"
                onclick="inlineEditar(${index}, 'PLACA ROTEIRIZADA')"
                style="cursor:pointer;">
            ${registro["PLACA ROTEIRIZADA"]}
          </span>
          ${registro["TROCAR PLACA"] ? `
            <i class="fa-solid fa-right-left"
               title="Inverter para nova placa"
               onclick="inverterPlacas(${index})"
               style="color:${COLORS.accent}; margin:0 0.5rem; cursor:pointer;"
            ></i>
            <span id="TROCAR_PLACA-${index}"
                  class="placa-alteracao"
                  onclick="inlineEditar(${index}, 'TROCAR PLACA')"
                  style="cursor:pointer;">
              ${registro["TROCAR PLACA"]}
            </span>` : ''}
        </div>
      </div>
    `;
  
    // Helper para campos do detalhe (mantém labels)
    const spanDetail = (label, key, value) => `
      <div class="detail-item">
        <span class="detail-label">${label}</span>
        <span id="${normKey(key)}-${index}"
              class="detail-value"
              onclick="inlineEditar(${index}, '${key}')"
              style="cursor:pointer;">
          ${value ?? ''}
        </span>
      </div>
    `;
  
    // Monta detalhes
    const detailsHTML = `
      <div class="card-details">
        ${spanDetail('Data', 'DATA', registro.DATA)}
        ${spanDetail('Destino', 'DESTINO', registro.DESTINO)}
        ${spanDetail('Transportadora', 'TRANSPORTADORA', registro.TRANSPORTADORA)}
        ${spanDetail('Qtd. Pallets', 'QTD PALLETS', registro["QTD PALLETS"])}
        ${spanDetail('Entregas', 'QUANT. ENTREGAS', registro["QUANT. ENTREGAS"])}
        ${spanDetail('Peso Total (kg)', 'PESO ENTREGAS', registro["PESO ENTREGAS"])}
        ${spanDetail('Caixas', 'QTDE CXS', registro["QTDE CXS"])}
      </div>
    `;
  
    card.innerHTML = headerHTML + detailsHTML;
    return card;
  }
  
  // Carrega o dashboard e configura busca
  function loadDashboard() {
    const raw = localStorage.getItem("gradeCompleta");
    const container = document.getElementById('dashboardContainer');
  
    if (!raw) {
      container.innerHTML = `
        <div class="error-container">
          <h2><i class="fa-solid fa-triangle-exclamation"></i> GRADE NÃO ENCONTRADA</h2>
          <p>Carregue a GRADE no menu ao lado.</p>
        </div>`;
      return;
    }
  
    try {
      const grade = JSON.parse(raw);
      container.innerHTML = '';
      grade.slice(1).forEach((reg, i) => {
        const idx = i + 1;
        container.appendChild(criarCard(reg, idx));
      });
      document.getElementById('searchInput')
              .addEventListener('input', filterCards);
    } catch {
      container.innerHTML = `
        <div class="error-container">
          <h2><i class="fa-solid fa-bug"></i> ERRO NA GRADE</h2>
          <p>Formato inválido ou dados corrompidos.</p>
        </div>`;
    }
  }
  
  // Filtra cards conforme busca
  function filterCards() {
    const termo = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.data-card').forEach(card => {
      card.style.display = card.textContent
                            .toLowerCase()
                            .includes(termo)
                         ? 'block'
                         : 'none';
    });
  }
  
  // Transforma um span em input para edição inline, com autocomplete se aplicável
  function inlineEditar(index, key) {
    const raw = localStorage.getItem("gradeCompleta");
    const grade = JSON.parse(raw);
    const registro = grade[index];
    const id = `${normKey(key)}-${index}`;
    const span = document.getElementById(id);
    if (!span || span.tagName === 'INPUT') return;
  
    // Define tipo de input
    let tipo = 'text';
    if (key === 'DATA') tipo = 'date';
    else if (['QTD PALLETS','QUANT. ENTREGAS','PESO ENTREGAS','QTDE CXS']
             .includes(key)) tipo = 'text'; // tratamos como text pra permitir "P-28 / L-1"
  
    // Prepara valor inicial (converte data se necessário)
    let valorInicial = registro[key] ?? '';
    if (key === 'DATA' && valorInicial) {
      const [d,m,a] = valorInicial.split('/');
      if (a&&m&&d) valorInicial = `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
  
    const input = document.createElement('input');
    input.type = tipo;
    input.value = valorInicial;
    input.className = 'edit-input';
    input.id = id;
    input.style.width = span.offsetWidth + 'px';
    input.dataset.originalValue = valorInicial;
  
    // Se este campo suporta sugestões, associa datalist
    if (suggestionKeys.includes(key)) {
      const listId = ensureDatalist(key);
      input.setAttribute('list', listId);
    }
  
    // Eventos para salvar/restaurar
    input.addEventListener('blur', () => salvarCampo(index, key));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
  
    span.replaceWith(input);
    input.focus();
  }
  
  // Salva o valor editado ou restaura original se ficar em branco
  function salvarCampo(index, key) {
    const raw = localStorage.getItem("gradeCompleta");
    const grade = JSON.parse(raw);
    const id = `${normKey(key)}-${index}`;
    const input = document.getElementById(id);
    if (!input) return;
  
    let novoValor = input.value;
    const original = input.dataset.originalValue || '';
    if (novoValor === '') novoValor = original;
  
    // Converte data de volta para DD/MM/YYYY
    if (key === 'DATA' && novoValor) {
      const [a,m,d] = novoValor.split('-');
      if (d&&m&&a) novoValor = `${d}/${m}/${a}`;
    }
  
    // Atualiza objeto e salva
    grade[index][key] = novoValor;
    localStorage.setItem("gradeCompleta", JSON.stringify(grade));
  
    // Restaura span
    const span = document.createElement('span');
    span.id = id;
    span.style.cursor = 'pointer';
    span.onclick = () => inlineEditar(index, key);
  
    if (key === 'TROCAR PLACA') {
      span.className = 'placa-alteracao';
      span.textContent = novoValor; // sem seta
    } else if (key === 'PLACA ROTEIRIZADA') {
      span.className = 'placa-value';
      span.textContent = novoValor;
    } else if (key === 'OE') {
      span.className = 'oe-text';
      span.textContent = novoValor;
    } else {
      span.className = 'detail-value';
      span.textContent = novoValor;
    }
  
    input.replaceWith(span);
  }
  
  // Inverte placas antiga/nova e re-renderiza o card
  function inverterPlacas(index) {
    const raw = localStorage.getItem("gradeCompleta");
    const grade = JSON.parse(raw);
    const reg = grade[index];
  
    const antiga = reg["PLACA ROTEIRIZADA"] || '';
    const nova   = reg["TROCAR PLACA"]      || '';
    reg["PLACA ROTEIRIZADA"] = nova;
    reg["TROCAR PLACA"]      = antiga;
  
    localStorage.setItem("gradeCompleta", JSON.stringify(grade));
  
    const container = document.getElementById('dashboardContainer');
    const oldCard = container.querySelector(`.data-card[data-index="${index}"]`);
    const newCard = criarCard(reg, index);
    container.replaceChild(newCard, oldCard);
  }
  
  // Inicializa o dashboard quando a página carrega
  window.onload = loadDashboard;
  