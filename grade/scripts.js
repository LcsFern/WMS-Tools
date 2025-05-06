const destinosCoordenadas = {
  "TSP IÇARA": [-28.7133, -49.3044],
  "TSP SEARA": [-27.1333, -52.3167],
  "TSP PALHOÇA": [-27.6428, -48.6694],
  "ITAPEMA": [-27.0903, -48.6114],
  "BRUSQUE": [-27.0979, -48.9172],
  "SAO BENTO DO SUL": [-26.2506, -49.3787],
  "LAGES": [-27.8157, -50.3264],
  "RIO DO SUL": [-27.2142, -49.6430],
  "MAFRA": [-26.1114, -49.8052],
  "COOP BLUMENAU": [-26.9194, -49.0661],
  "INDAIAL": [-26.8978, -49.2317],
  "FLOPIS NORTE": [-27.5935, -48.5447],
  "FLOPIS SUL": [-27.6799, -48.5477],
  "FLOPIS CENTRO": [-27.5954, -48.5482],
  "FLOPIS CONTINENTE": [-27.5949, -48.5895],
  "SAO FRANCISCO": [-26.2394, -48.6408],
  "JOINVILLE": [-26.3045, -48.8487],
  "TIJUCAS": [-27.2414, -48.6336],
  "SAO JOSE": [-27.6136, -48.6276],
  "BLUMENAU": [-26.9194, -49.0661],
  "NAVEGANTES": [-26.8988, -48.6542],
  "GASPAR": [-26.9316, -48.9586],
  "KOCH TIJUCAS": [-27.2414, -48.6336],
  "ITAJAI": [-26.9078, -48.6619],
  "BALNEARIO CAMBORIU": [-26.9906, -48.6348],
  "SEARA": [-27.1486, -52.3186]
};

const baseItajai = { lat: -26.947144, lon: -48.739698 };

function parsePeso(valor) {
  return parseFloat(valor.toString().replace(/[\.]/g, '').replace(/[,]/g, '.'));
}

// Calcula a distância haversine entre dois pontos
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getCoordinates(destino) {
  const chave = destino.trim().toUpperCase();

  // Se já está em cache, retorna imediatamente
  if (destinosCoordenadas[chave]) {
    return destinosCoordenadas[chave];
  }

  // Função auxiliar que força SC na busca
  async function consultaSC(query) {
    try {
      const fullQuery = `${query}, Santa Catarina, Brasil`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQuery)}&format=json&limit=1`);
      const data = await res.json();
      if (data.length > 0) {
        const coord = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        destinosCoordenadas[chave] = coord; // cacheia
        return coord;
      }
    } catch (e) {
      console.warn(`Erro ao consultar Nominatim para "${query}":`, e);
    }
    return null;
  }

  // 1) Tenta com o destino completo + ", SC"
  const tentativa1 = await consultaSC(destino);
  if (tentativa1) return tentativa1;

  // 2) Se falhar, tenta por palavras-chave relevantes
  const palavras = destino
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .split(/\s+/)
    .filter(p => p.length >= 4); // ignora palavras curtas

  for (const palavra of palavras) {
    const tentativa2 = await consultaSC(palavra);
    if (tentativa2) return tentativa2;
  }

  // 3) Falhou completamente
  destinosCoordenadas[chave] = null;
  console.error(`❌ Coordenadas não encontradas para destino: "${destino}"`);
  return null;
}




// Gera o SVG da placa no padrão Mercosul
function getSVGPlaca(placa) {
  return `
  <svg width="150" height="50" xmlns="http://www.w3.org/2000/svg">
    <!-- Fundo branco -->
    <rect width="150" height="50" fill="white" stroke="#ccc" rx="4"/>
    <!-- Faixa azul superior -->
    <rect width="150" height="15" fill="#0033A0"/>
    <!-- Texto "BRASIL" na faixa -->
    <text x="5" y="12" font-family="Arial, sans-serif" font-size="10" fill="white">BRASIL</text>
    <!-- Bandeira do Brasil (simplificada) -->
    <rect x="110" y="2" width="30" height="10" fill="#009C3B"/>
    <rect x="110" y="12" width="30" height="3" fill="#FFDF00"/>
    <!-- Emblema do Mercosul (círculo azul simplificado) -->
    <circle cx="130" cy="30" r="8" fill="#0033A0"/>
    <!-- Número da placa -->
    <text x="10" y="40" font-family="Arial, sans-serif" font-size="20" fill="black">${placa}</text>
  </svg>
  `;
}

async function processarGrade() {
  const rawData = document.getElementById('excelData').value.trim();
  if (!rawData) return;

  const linhas = rawData.split('\n');
  if (linhas.length < 2) return;

  const headersOriginais = linhas[0].split('\t');
  const headers = headersOriginais.map(h => h.replace(/\s+/g, ' ').trim());
  const headersNorm = headers.map(h => h.toUpperCase());

  const indexPlaca = headersNorm.findIndex(h => h === "PLACA ROTEIRIZADA");
  const indexQtdeCxs = headersNorm.findIndex(h => h === "QTDE CXS");
  const indexPeso = headersNorm.findIndex(h => h === "PESO TOTAL") !== -1 ? headersNorm.findIndex(h => h === "PESO TOTAL") :
                    headersNorm.findIndex(h => h.includes("PESO RE-ENTREGA")) !== -1 ? headersNorm.findIndex(h => h.includes("PESO RE-ENTREGA")) :
                    headersNorm.findIndex(h => h.includes("PESO ENTREGAS"));
  const indexDestino = headersNorm.findIndex(h => h === "DESTINO");
  const indexQtdPallets = headersNorm.findIndex(h => h === "QTD PALLETS");
  const indexData = headersNorm.findIndex(h => h === "DATA");
  const indexTransportadora = headersNorm.findIndex(h => h === "TRANSPORTADORA");

  const veiculosUnicos = new Set();
  let totalCaixas = 0;
  let pesoTotal = 0;
  const destinosUnicos = new Set();
  const destinoPlacas = {};
  let paletizados = 0, gradiados = 0, batidos = 0;
  const gradeCompleta = [];

  let dataGrade = "";
  for (let i = 1; i < linhas.length; i++) {
    const partes = linhas[i].split('\t');
    if (partes.length < headers.length) continue;

    const registro = {};
    headers.forEach((chave, index) => {
      registro[chave] = partes[index]?.trim() || "";
    });
    gradeCompleta.push(registro);

    const placa = registro[headers[indexPlaca]];
    if (placa && !veiculosUnicos.has(placa)) {
      veiculosUnicos.add(placa);
      // Corrigindo a conversão: removendo o separador de milhar (ponto)
      totalCaixas += parseInt(registro[headers[indexQtdeCxs]].replace(/[.]/g, '')) || 0;
      if (indexPeso !== -1) {
        pesoTotal += parsePeso(registro[headers[indexPeso]] || '0');
      }
      const destino = registro[headers[indexDestino]];
      if (destino) {
        destinosUnicos.add(destino);
        if (!destinoPlacas[destino]) destinoPlacas[destino] = [];
        destinoPlacas[destino].push(placa);
      }

      const qtdPallets = registro[headers[indexQtdPallets]];
      if (qtdPallets && qtdPallets !== "0") {
        const tipo = qtdPallets.split('/')[0].trim().toUpperCase();
        if (tipo.startsWith("P")) paletizados++;
        else if (tipo.startsWith("G")) gradiados++;
        else if (tipo.startsWith("B")) batidos++;
      }

      if (!dataGrade) dataGrade = registro[headers[indexData]];
    }
  }

  localStorage.setItem("gradeCompleta", JSON.stringify(gradeCompleta));

  document.getElementById('dataGrade').textContent = dataGrade;
  document.getElementById('totalVeiculos').textContent = veiculosUnicos.size;
  document.getElementById('pesoTotal').textContent = pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  document.getElementById('totalCaixas').textContent = totalCaixas;
  document.getElementById('paletizados').textContent = paletizados;
  document.getElementById('gradiados').textContent = gradiados;
  document.getElementById('batidos').textContent = batidos;

  document.getElementById('gradeSection').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('resetBtn').classList.remove('hidden');

  // Cria o mapa e armazena globalmente para permitir centralização via busca
  const map = L.map('map').setView([-27.5954, -48.5482], 7);
  window.map = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  for (const destino of destinosUnicos) {
    const coord = await getCoordinates(destino);
    if (coord) {
      const distance = haversineDistance(baseItajai.lat, baseItajai.lon, coord[0], coord[1]).toFixed(1);
      const placas = destinoPlacas[destino].join(', ');
      L.marker(coord).addTo(map).bindPopup(`<strong>${destino}</strong><br>Distância do CD MI: ${distance} km<br>Placas: ${placas}`);
    }
  }

  setupAutocomplete(gradeCompleta);
}

async function loadGradeFromStorage() {
  const gradeRaw = localStorage.getItem("gradeCompleta");
  if (!gradeRaw) return;

  const gradeCompleta = JSON.parse(gradeRaw);
  const headers = gradeCompleta[0] ? Object.keys(gradeCompleta[0]) : [];
  const headersNorm = headers.map(h => h.toUpperCase());

  const indexPlaca = headersNorm.findIndex(h => h === "PLACA ROTEIRIZADA");
  const indexQtdeCxs = headersNorm.findIndex(h => h === "QTDE CXS");
  const indexPeso = headersNorm.findIndex(h => h === "PESO TOTAL") !== -1 ? headersNorm.findIndex(h => h === "PESO TOTAL") :
                    headersNorm.findIndex(h => h.includes("PESO RE-ENTREGA")) !== -1 ? headersNorm.findIndex(h => h.includes("PESO RE-ENTREGA")) :
                    headersNorm.findIndex(h => h.includes("PESO ENTREGAS"));
  const indexDestino = headersNorm.findIndex(h => h === "DESTINO");
  const indexQtdPallets = headersNorm.findIndex(h => h === "QTD PALLETS");
  const indexData = headersNorm.findIndex(h => h === "DATA");

  const veiculosUnicos = new Set();
  let totalCaixas = 0;
  let pesoTotal = 0;
  const destinosUnicos = new Set();
  const destinoPlacas = {};
  let paletizados = 0, gradiados = 0, batidos = 0;
  let dataGrade = "";

  gradeCompleta.forEach(registro => {
    const placa = registro[headers[indexPlaca]];
    if (placa && !veiculosUnicos.has(placa)) {
      veiculosUnicos.add(placa);
      // Corrigindo a conversão para "QTDE CXS" removendo o ponto separador
      totalCaixas += parseInt(registro[headers[indexQtdeCxs]].replace(/[.]/g, '')) || 0;
      if (indexPeso !== -1) {
        pesoTotal += parsePeso(registro[headers[indexPeso]] || '0');
      }
      const destino = registro[headers[indexDestino]];
      if (destino) {
        destinosUnicos.add(destino);
        if (!destinoPlacas[destino]) destinoPlacas[destino] = [];
        destinoPlacas[destino].push(placa);
      }

      const qtdPallets = registro[headers[indexQtdPallets]];
      if (qtdPallets && qtdPallets !== "0") {
        const tipo = qtdPallets.split('/')[0].trim().toUpperCase();
        if (tipo.startsWith("P")) paletizados++;
        else if (tipo.startsWith("G")) gradiados++;
        else if (tipo.startsWith("B")) batidos++;
      }

      if (!dataGrade) dataGrade = registro[headers[indexData]];
    }
  });

  document.getElementById('dataGrade').textContent = dataGrade;
  document.getElementById('totalVeiculos').textContent = veiculosUnicos.size;
  document.getElementById('pesoTotal').textContent = pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  document.getElementById('totalCaixas').textContent = totalCaixas;
  document.getElementById('paletizados').textContent = paletizados;
  document.getElementById('gradiados').textContent = gradiados;
  document.getElementById('batidos').textContent = batidos;

  document.getElementById('gradeSection').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('resetBtn').classList.remove('hidden');

  // Cria o mapa e o torna global
  const map = L.map('map').setView([-27.5954, -48.5482], 7);
  window.map = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  for (const destino of destinosUnicos) {
    const coord = await getCoordinates(destino);
    if (coord) {
      const distance = haversineDistance(baseItajai.lat, baseItajai.lon, coord[0], coord[1]).toFixed(1);
      const placas = destinoPlacas[destino].join(', ');
      L.marker(coord).addTo(map).bindPopup(`<strong>${destino}</strong><br>Distância do CD Mi: ${distance} km<br>Placas: ${placas}`);
    }
  }

  setupAutocomplete(gradeCompleta);
}

function resetGrade() {
  askConfirmation("Deseja apagar os Picking Dinâmicos?", function (confirmarOndas) {
    if (confirmarOndas) localStorage.removeItem("ondasdin");

    askConfirmation("Deseja apagar os Ressuprimentos?", function (confirmarRessu) {
      if (confirmarRessu) localStorage.removeItem("reaba");

      askConfirmation("Deseja apagar as Movimentações?", function (confirmarMovs) {
        if (confirmarMovs) localStorage.removeItem("movimentacoesProcessadas");

});

      // Zera os demais dados
      localStorage.removeItem("activeSeparatorsSaved");
      localStorage.removeItem("historicalInactiveSeparators");
      localStorage.removeItem("gradeCompleta");
      localStorage.removeItem("result_state_monitor");
      document.getElementById('excelData').value = '';
      document.getElementById('gradeSection').classList.remove('hidden');
      document.getElementById('dashboard').classList.add('hidden');
      document.getElementById('resetBtn').classList.add('hidden');
    });
  });
}

function askConfirmation(msg, callback) {
  const popup = document.getElementById('customResetPopup');
  const message = document.getElementById('resetMessage');
  const btnYes = document.getElementById('confirmReset');
  const btnNo = document.getElementById('cancelReset');

  message.textContent = msg;
  popup.classList.remove('hidden');

  // animação suave
  setTimeout(() => popup.classList.add('show'), 10);

  const handleYes = () => {
    closePopup(popup);
    cleanup();
    callback(true);
  };

  const handleNo = () => {
    closePopup(popup);
    cleanup();
    callback(false);
  };

  function cleanup() {
    btnYes.removeEventListener('click', handleYes);
    btnNo.removeEventListener('click', handleNo);
  }

  btnYes.addEventListener('click', handleYes);
  btnNo.addEventListener('click', handleNo);
}

function closePopup(popup) {
  popup.classList.remove('show');
  setTimeout(() => popup.classList.add('hidden'), 300);
}

// Função para copiar o texto da OE
function copiarTexto(texto) {
  navigator.clipboard.writeText(texto);
}

// Função de busca com ícones e clique no destino para centralizar o mapa
async function searchGrade() {
  const query = document.getElementById('searchInput').value.trim().toUpperCase();
  if (!query) return;

  const gradeCompleta = JSON.parse(localStorage.getItem("gradeCompleta") || "[]");
  const results = gradeCompleta.filter(registro => 
    registro["PLACA ROTEIRIZADA"]?.toUpperCase().includes(query) || 
    registro["TRANSPORTADORA"]?.toUpperCase().includes(query)
  );

  const searchResults = document.getElementById('searchResults');
  searchResults.innerHTML = '';
  if (results.length > 0) {
    for (const registro of results) {
      const placa = registro["PLACA ROTEIRIZADA"];
      const svgPlaca = getSVGPlaca(placa);
      const oe = registro["OE"] || "";
      const destino = registro["DESTINO"] || "";
      // Calcula distância (se possível)
      let destinoDistance = "N/A";
      const coord = await getCoordinates(destino);
      if (coord) {
        destinoDistance = haversineDistance(baseItajai.lat, baseItajai.lon, coord[0], coord[1]).toFixed(1) + " km";
      }
      // Peso: utiliza a coluna disponível
      const peso = registro["PESO ENTREGAS"] || registro["PESO TOTAL"] || registro["PESO RE-ENTREGA"] || "N/A";
      const caixas = registro["QTDE CXS"] || "N/A";
      const entregas = registro["QUANT. ENTREGAS"] || "N/A";
      // Tipo de carga a partir de "QTD PALLETS"
      let tipoCarga = "N/A";
      const qtdPallets = registro["QTD PALLETS"] || "";
      if (qtdPallets) {
        const tipo = qtdPallets.split('/')[0].trim().toUpperCase();
        if (tipo.startsWith("P")) tipoCarga = "Paletizado";
        else if (tipo.startsWith("G")) tipoCarga = "Gradeado";
        else if (tipo.startsWith("B")) tipoCarga = "Batido";
      }
      const transportadora = registro["TRANSPORTADORA"] || "";
      // Monta o item de resultado com ícones e destino clicável
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `
        <div class="result-info">
          ${svgPlaca}
          <div class="result-details">
            <div class="result-oe">
              <i class="fa-solid fa-hashtag"></i> <span>${oe}</span>
              <button class="copy-btn" title="Copiar OE" onclick="copiarTexto('${oe}')"><i class="fa-solid fa-copy"></i></button>
            </div>
            <div class="result-destino">
              <i class="fa-solid fa-location-dot"></i>
              <strong>Destino:</strong> 
              <span class="destino-link" data-destino="${destino}">${destino}</span> (${destinoDistance})
            </div>
            <div><i class="fa-solid fa-weight-hanging"></i> <strong>Peso:</strong> ${peso}</div>
            <div><i class="fa-solid fa-box"></i> <strong>Caixas:</strong> ${caixas}</div>
            <div><i class="fa-solid fa-truck-loading"></i> <strong>Entregas:</strong> ${entregas}</div>
            <div><i class="fa-solid fa-truck"></i> <strong>Tipo de Carga:</strong> ${tipoCarga}</div>
          </div>
        </div>
        <a class="btn-transportadora" href="https://www.google.com/search?q=${encodeURIComponent(transportadora)}" target="_blank">
          <i class="fa-solid fa-magnifying-glass"></i> Buscar Transportadora
        </a>
      `;
      searchResults.appendChild(div);

      // Adiciona evento para centralizar o mapa ao clicar no destino
      const destinoLink = div.querySelector('.destino-link');
      if (destinoLink) {
        destinoLink.style.cursor = "pointer";
        destinoLink.addEventListener('click', async () => {
          const destinoNome = destinoLink.getAttribute('data-destino');
          const coords = await getCoordinates(destinoNome);
          if (coords && window.map) {
            window.map.setView(coords, 12);
            // Abre o popup do marcador correspondente, se houver
            L.popup()
              .setLatLng(coords)
              .setContent(`<strong>${destinoNome}</strong>`)
              .openOn(window.map);
          }
        });
      }
    }
  } else {
    searchResults.innerHTML = '<p>Nenhum resultado encontrado.</p>';
  }
}

function setupAutocomplete(gradeCompleta) {
  const input = document.getElementById('searchInput');
  const suggestionsBox = document.getElementById('suggestions');
  const suggestions = new Set();
  gradeCompleta.forEach(registro => {
    if (registro["PLACA ROTEIRIZADA"]) suggestions.add(registro["PLACA ROTEIRIZADA"]);
    if (registro["TRANSPORTADORA"]) suggestions.add(registro["TRANSPORTADORA"]);
  });
  const suggestionList = Array.from(suggestions);

  input.addEventListener('input', () => {
    const query = input.value.trim().toUpperCase();
    suggestionsBox.innerHTML = '';
    if (!query) {
      suggestionsBox.style.display = 'none';
      return;
    }

    const filteredSuggestions = suggestionList.filter(s => s.toUpperCase().startsWith(query));
    if (filteredSuggestions.length > 0) {
      filteredSuggestions.forEach(suggestion => {
        const div = document.createElement('div');
        div.textContent = suggestion;
        div.addEventListener('click', () => {
          input.value = suggestion;
          suggestionsBox.style.display = 'none';
          searchGrade();
        });
        suggestionsBox.appendChild(div);
      });
      suggestionsBox.style.display = 'block';
    } else {
      suggestionsBox.style.display = 'none';
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => suggestionsBox.style.display = 'none', 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      suggestionsBox.style.display = 'none';
      searchGrade();
    }
  });
}

document.getElementById('excelData').addEventListener('paste', (e) => {
  setTimeout(() => {
    processarGrade();
  }, 100);
});

window.onload = loadGradeFromStorage;
