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

function parsePeso(valor) {
  return parseFloat(valor.toString().replace(/[\.]/g, '').replace(/[,]/g, '.'));
}

async function getCoordinates(destino) {
  if (destinosCoordenadas[destino]) return destinosCoordenadas[destino];
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destino + ", SC, Brasil")}&format=json&limit=1`);
    const data = await response.json();
    if (data.length > 0) {
      const coord = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      destinosCoordenadas[destino] = coord;
      return coord;
    }
  } catch (error) {
    console.error(`Erro ao buscar coordenadas para ${destino}:`, error);
  }
  return null;
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
      totalCaixas += parseInt(registro[headers[indexQtdeCxs]]) || 0;
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

  const map = L.map('map').setView([-27.5954, -48.5482], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  for (const destino of destinosUnicos) {
    const coord = await getCoordinates(destino);
    if (coord) {
      const placas = destinoPlacas[destino].join(', ');
      L.marker(coord).addTo(map).bindPopup(`<strong>${destino}</strong><br>Placas: ${placas}`);
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
      totalCaixas += parseInt(registro[headers[indexQtdeCxs]]) || 0;
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

  const map = L.map('map').setView([-27.5954, -48.5482], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  for (const destino of destinosUnicos) {
    const coord = await getCoordinates(destino);
    if (coord) {
      const placas = destinoPlacas[destino].join(', ');
      L.marker(coord).addTo(map).bindPopup(`<strong>${destino}</strong><br>Placas: ${placas}`);
    }
  }

  setupAutocomplete(gradeCompleta);
}

function resetGrade() {
  localStorage.removeItem("gradeCompleta");
  document.getElementById('excelData').value = '';
  document.getElementById('gradeSection').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('resetBtn').classList.add('hidden');
}

function searchGrade() {
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
    results.forEach(registro => {
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `
        <span>Placa: ${registro["PLACA ROTEIRIZADA"]} | Destino: ${registro["DESTINO"]} | Peso: ${registro["PESO ENTREGAS"] || 'N/A'} | Caixas: ${registro["QTDE CXS"]}</span>
        <a href="https://www.google.com/search?q=${encodeURIComponent(registro["TRANSPORTADORA"])}" target="_blank">Buscar Transportadora</a>
      `;
      searchResults.appendChild(div);
    });
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