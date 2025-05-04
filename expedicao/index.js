function copiarOE(texto) {
  navigator.clipboard.writeText(texto);
  alert('OE copiado!');
}

function criarCard(registro) {
  const card = document.createElement('div');
  card.className = 'data-card';
  
  const html = `
      <div class="card-header">
          <div class="oe-number">
              ${registro.OE} 
              <i class="fa-regular fa-copy copy-oe" onclick="copiarOE('${registro.OE}')"></i>
          </div>
          
          <div class="placa-container">
              <i class="fa-solid fa-truck-plate placa-icon"></i>
              <span class="placa-value">${registro["PLACA ROTEIRIZADA"]}</span>
              ${registro["TROCAR PLACA"] ? 
                `<span class="placa-alteracao">→ ${registro["TROCAR PLACA"]}</span>` : ''}
          </div>
      </div>
      <div class="card-details">
          <div class="detail-item">
              <span class="detail-label">Data</span>
              <span class="detail-value">${registro.DATA}</span>
          </div>
          <div class="detail-item">
              <span class="detail-label">Destino</span>
              <span class="detail-value">${registro.DESTINO}</span>
          </div>
          <div class="detail-item">
              <span class="detail-label">Transportadora</span>
              <span class="detail-value">${registro.TRANSPORTADORA}</span>
          </div>
          <div class="detail-item">
              <span class="detail-label">Qtd. Pallets</span>
              <span class="detail-value">${registro["QTD PALLETS"]}</span>
          </div>
          <div class="detail-item">
              <span class="detail-label">Entregas</span>
              <span class="detail-value">${registro["QUANT. ENTREGAS"]}</span>
          </div>
          <div class="detail-item">
              <span class="detail-label">Peso Total</span>
              <span class="detail-value">${registro["PESO ENTREGAS"]} kg</span>
          </div>
          <div class="detail-item">
              <span class="detail-label">Caixas</span>
              <span class="detail-value">${registro["QTDE CXS"]}</span>
          </div>
      </div>
  `;
  
  card.innerHTML = html;
  return card;
}

function filterCards() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const cards = document.querySelectorAll('.data-card');
  
  cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(searchTerm) ? 'block' : 'none';
  });
}

function loadDashboard() {
  const gradeRaw = localStorage.getItem("gradeCompleta");
  const container = document.getElementById('dashboardContainer');
  
  if (!gradeRaw) {
      container.innerHTML = `
          <div class="error-container">
              <h2><i class="fa-solid fa-triangle-exclamation"></i> GRADE NÃO ENCONTRADA</h2>
                <p>Carregue a GRADE no menu ao lado.</p>
          </div>
      `;
      return;
  }

  try {
      const gradeCompleta = JSON.parse(gradeRaw);
      container.innerHTML = '';
      
      gradeCompleta.slice(1).forEach(registro => {
          if(registro.OE) {
              container.appendChild(criarCard(registro));
          }
      });

      document.getElementById('searchInput').addEventListener('input', filterCards);
  } catch (e) {
      console.error("Erro ao carregar grade:", e);
      container.innerHTML = `
          <div class="error-container">
              <h2><i class="fa-solid fa-bug"></i> ERRO NA GRADE</h2>
              <p>Formato inválido ou dados corrompidos.</p>
          </div>
      `;
  }
}

window.onload = loadDashboard;