const destinosCoordenadas = {
  // Locais TSP e principais cidades
  "TSP IÇARA": [-28.7133, -49.3044],
  "TSP SEARA": [-27.1333, -52.3167],
  "TSP PALHOÇA": [-27.6428, -48.6694],
  "SEARA": [-27.1486, -52.3186],
  "LAGES": [-27.8157, -50.3264],
  "IÇARA": [-28.7133, -49.3044],
  "PALHOÇA": [-27.6428, -48.6694],
  "CHAPECÓ": [-27.0964, -52.6182],
  "CRICIÚMA": [-28.6775, -49.3697],
  "COCAL DO SUL": [-28.6008, -49.3258],
  "BRAÇO DO NORTE": [-28.2750, -49.1658],
  "TUBARAO": [-28.4667, -49.0069],
  "CAPIVARI DE BAIXO": [-28.4452, -48.9583],
  "MAFRA": [-26.1114, -49.8052],
  "LAGUNA": [-28.4825, -48.7808],
  "SAO BENTO DO SUL": [-26.2506, -49.3787],
  "IMBITUBA": [-28.2333, -48.6667],
  "RIO DO SUL": [-27.2142, -49.6430],
  "ARNALDO RIO DO SUL": [-27.2142, -49.6430], // mesma coordenada da cidade
  "JOINVILLE": [-26.3045, -48.8487],
  "JARAGUA DO SUL": [-26.4852, -49.0713],
  "SAO FRANCISCO": [-26.2394, -48.6408],
  "SAO JOSE": [-27.6136, -48.6276],
  "BIGUAÇU": [-27.4942, -48.6597],
  "INDAIAL": [-26.8978, -49.2317],
  "BLUMENAU": [-26.9194, -49.0661],
  "COOP BLUMENAU": [-26.9194, -49.0661],
  "ATACADAO BLUMENAU": [-26.9153, -49.0650], // endereço real aproximado do Atacadão Blumenau
  "ITAPEMA": [-27.0903, -48.6114],
  "BRUSQUE": [-27.0979, -48.9172],
  "GASPAR": [-26.9316, -48.9586],
  "NAVEGANTES": [-26.8988, -48.6542],
  "TIJUCAS": [-27.2414, -48.6336],
  "KOCH TIJUCAS": [-27.2414, -48.6336],
  "BALNEARIO CAMBORIU": [-26.9906, -48.6348],
  "BARRA VELHA": [-26.6371, -48.6842],

  // Fort Atacadistas
  "FORT PALHOCA PASSA VINTE": [-27.6143, -48.6348], // unidade próxima ao bairro Passa Vinte
  "FORT VARGEM GRANDE": [-27.4726, -48.5053], // bairro Vargem Grande, Florianópolis
  "FORT CAMPECHE": [-27.6765, -48.4830],
  "FORT STO ANTONIO LISBOA": [-27.5069, -48.5196],
  "FORT BUCAREIN": [-26.3125, -48.8478], // bairro Bucarein, Joinville
  "FORT PORTO BELO": [-27.1600, -48.5460],

  // Outros estabelecimentos
  "FINCO": [-27.1495, -52.3035], // Finco Alimentos, Seara
  "OESA JARAGUA": [-26.4810, -49.0616], // OESA - Av. Prefeito Waldemar Grubba, Jaraguá do Sul
  "ANGELONI PORTO BELO": [-27.1547, -48.5147], // endereço aproximado
  "SEGALAS GASPAR": [-26.9333, -48.9500], // estimativa - bairro Bela Vista
  "ATACADAO CIDADE NOVA": [-26.9150, -48.6547], // unidade no bairro Cidade Nova, Itajaí
  "REDE TOP": [-26.9194, -49.0661], // assume Blumenau como base
  "SAO MIGUEL": [-26.7258, -53.5181], // São Miguel do Oeste
  "REDE TOP ITAJAI": [-26.9063, -48.6619], // unidade em Itajaí

  // Filiais Flóripa
  "FLOPIS NORTE": [-27.5935, -48.5447],
  "FLOPIS SUL": [-27.6799, -48.5477],
  "FLOPIS CENTRO": [-27.5954, -48.5482],
  "FLOPIS CONTINENTE": [-27.5949, -48.5895]
};

const baseItajai = { lat: -26.947144, lon: -48.739698 };

// Função para parsear o peso vindo como string tipo "1.234,56"
function parsePeso(valor) {
  return parseFloat(valor.toString().replace(/[\.]/g, '').replace(/[,]/g, '.'));
}

// Função de distância Haversine para calcular distância entre dois pontos (em km)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Função para obter coordenadas de um destino
async function getCoordinates(destino) {
  const chave = destino.trim().toUpperCase();

  // 1) Se já está em cache, retorna imediatamente
  if (destinosCoordenadas[chave]) {
    return destinosCoordenadas[chave];
  }

  // 2) Se não estiver, tenta encontrar uma cidade conhecida dentro do nome
  for (const nomeSalvo in destinosCoordenadas) {
    if (
      chave.includes(nomeSalvo) &&               // destino contém o nome da cidade
      !destinosCoordenadas[chave] &&             // ainda não resolvido
      nomeSalvo !== chave                        // não é o mesmo nome exatamente
    ) {
      console.log(`✔️ Usando coordenada de "${nomeSalvo}" para "${destino}"`);
      destinosCoordenadas[chave] = destinosCoordenadas[nomeSalvo];
      return destinosCoordenadas[nomeSalvo];
    }
  }

  // 3) Caso nenhuma cidade conhecida esteja no nome, tenta Nominatim
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

  // 4) Tenta busca direta com o destino completo
  const tentativa1 = await consultaSC(destino);
  if (tentativa1) return tentativa1;

  // 5) Tenta por palavras-chave do nome (sem acento, com mínimo de 4 letras)
  const palavras = chave
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .split(/\s+/)
    .filter(p => p.length >= 4);

  for (const palavra of palavras) {
    const tentativa2 = await consultaSC(palavra);
    if (tentativa2) return tentativa2;
  }

  // 6) Falha completa — retorna null e marca como não encontrado
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

  showLoading('gradeSection', 'Processando grade');

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

async function resetGrade() {
  // Solicitação de confirmação para apagar as chaves específicas
  askConfirmation("Deseja apagar os Picking Dinâmicos?", async function (confirmarOndas) {
    if (confirmarOndas) {
      // Deleta do localStorage e do servidor
      localStorage.removeItem("ondasdin");
      await deleteKeyFromServer("ondasdin");
    }

    askConfirmation("Deseja apagar os Ressuprimentos?", async function (confirmarRessu) {
      if (confirmarRessu) {
        // Deleta do localStorage e do servidor
        localStorage.removeItem("reaba");
        await deleteKeyFromServer("reaba");
      }

      askConfirmation("Deseja apagar as Movimentações?", async function (confirmarMovs) {
        if (confirmarMovs) {
          // Deleta do localStorage e do servidor
          localStorage.removeItem("movimentacoesProcessadas");
          await deleteKeyFromServer("movimentacoesProcessadas");
        }
      });

      // Zera os dados restantes diretamente
      localStorage.removeItem("activeSeparatorsSaved");
      localStorage.removeItem("historicalInactiveSeparators");
      localStorage.removeItem("gradeCompleta");
      localStorage.removeItem("result_state_monitor");

      // Envia os dados do formulário e controla a visibilidade de elementos da interface
      document.getElementById('excelData').value = '';
      document.getElementById('gradeSection').classList.remove('hidden');
      document.getElementById('dashboard').classList.add('hidden');
      document.getElementById('resetBtn').classList.add('hidden');
    });
  });
}

// Função auxiliar para deletar a chave do servidor
const KEY_NAMES = {
  ondasdin: "Picking Dinâmico",
  reaba: "Ressuprimento",
  movimentacoesProcessadas: "Movimentações"
};

async function deleteKeyFromServer(key) {
  const nomeAmigavel = KEY_NAMES[key] || key;
  try {
    const res = await fetch('https://labsuaideia.store/api/delete.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chaves: [key] })
    });

    const data = await res.json();
    console.log('Resposta do servidor:', data);

    if (data.status === 'success') {
      showPopup(`"${nomeAmigavel}" deletado com sucesso no servidor!`, 'success');
    } else {
      showPopup(`Erro ao tentar deletar "${nomeAmigavel}" no servidor: ${data.message}`, 'error');
    }
  } catch (error) {
    console.error('Erro ao deletar chave no servidor:', error);
    showPopup(`Falha ao conectar para deletar "${nomeAmigavel}": ${error.message}`, 'error');
  }
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
  navigator.clipboard.writeText(texto)
    .then(() => showNotification('Texto copiado!'))
    .catch(() => showNotification('Falha ao copiar', 'error'));
}

// Função de busca com ícones e clique no destino para centralizar o mapa
async function searchGrade() {
  const query = document.getElementById('searchInput').value.trim().toUpperCase();
  if (!query) return;

  const searchResults = document.getElementById('searchResults');
  searchResults.innerHTML = '<div class="loading-container"><div class="loading"></div><span style="margin-left: 10px;">Buscando...</span></div>';

  const gradeCompleta = JSON.parse(localStorage.getItem("gradeCompleta") || "[]");
  const results = gradeCompleta.filter(registro => 
    registro["PLACA ROTEIRIZADA"]?.toUpperCase().includes(query) || 
    registro["TRANSPORTADORA"]?.toUpperCase().includes(query)
  );

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

// Função para mostrar o loading
function showLoading(elementId, message) {
  const element = document.getElementById(elementId);
  element.innerHTML = `
    <div class="loading-container">
      <div class="loading"></div>
      <span class="typing-indicator" style="margin-left: 10px;">${message}</span>
    </div>
  `;
}

// Função para mostrar notificação
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Configuração do botão de ação flutuante
document.addEventListener('DOMContentLoaded', () => {
  const fabButton = document.getElementById('fabButton');
  const fabOptions = document.querySelector('.fab-options');
  
  fabButton.addEventListener('click', () => {
    fabOptions.classList.toggle('show');
  });
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#fab') && fabOptions.classList.contains('show')) {
      fabOptions.classList.remove('show');
    }
  });
  
  // Botão de ajuda
  document.getElementById('helpBtn').addEventListener('click', () => {
    showNotification('GRADE Principal para funcionamento do sistema', 'info');
  });
});