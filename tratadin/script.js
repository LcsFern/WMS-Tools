// Aguarda o carregamento completo do DOM antes de executar o script
document.addEventListener('DOMContentLoaded', () => {

  // Função para interpretar uma tabela de texto (TSV ou CSV com ;), transformando em objetos
  function parseTabela(txt) {
    const lns = txt.trim().split(/\r?\n/);
    if (lns.length < 2) return [];
    const hdr = lns[0].split(/\t|;/).map(h => h.trim());
    return lns.slice(1).map(l => {
      const cols = l.split(/\t|;/), obj = {};
      hdr.forEach((h, i) => obj[h] = (cols[i] || '').trim());
      return obj;
    });
  }

  // Função para converter string numérica para float, tratando ponto e vírgula
  function parseNum(s) {
    if (!s || typeof s !== 'string') return 0;
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }

  // Referência aos elementos da interface
  const inputsEl = document.getElementById('inputs'),
        resEl    = document.getElementById('resultado'),
        ulRes    = document.getElementById('listaResup'),
        ulDyn    = document.getElementById('listaDinamico'),
        btnProcess = document.getElementById('btnProcess'),
        btnReset   = document.getElementById('btnReset'),
        copyResup  = document.getElementById('copyResup'),
        copyDyn    = document.getElementById('copyDyn'),
        txtPicking = document.getElementById('txtPicking'),
        txtPreview = document.getElementById('txtPreview'),
        txtSku     = document.getElementById('txtSku');

  let codRes = [], codDyn = [];

  // Função principal de processamento dos dados
  async function processar() {
    inputsEl.classList.add('hidden');
    resEl.style.display = 'block';

    // Carrega o JSON com os produtos
    let prodMap = {};
    try {
      const r = await fetch('produtos.json');
      const data = await r.json();
      if (Array.isArray(data)) {
        data.forEach(p => {
          if (p && p["COD. PRODUTO"]) {
            prodMap[p["COD. PRODUTO"]] = p;
          }
        });
      } else if (data && data["COD. PRODUTO"]) {
        prodMap[data["COD. PRODUTO"]] = data;
      }
    } catch (error) {
      console.error('Erro ao carregar produtos.json:', error);
      alert('Erro ao carregar produtos.json');
      return;
    }

    // Parsing da tabela de picking
    const pickArr = parseTabela(txtPicking.value),
          pickMap = {};
    pickArr.forEach(p => {
      if (p["LOCALIZAÇÃO"] && p["PRODUTO"]) {
        const key = p["LOCALIZAÇÃO"] + '|' + p["PRODUTO"];
        pickMap[key] = (pickMap[key] || 0) + parseNum(p["QTD ATUAL"]);
      }
    });

    // Parsing da prévia de pedidos
    const prevArr = parseTabela(txtPreview.value),
          palMap = {}, shelfReq = {};
    prevArr.forEach(p => {
      if (p["COD. PRODUTO"]) {
        const cod = p["COD. PRODUTO"];
        palMap[cod] = (palMap[cod] || 0) + parseNum(p["QTDE PALETE"]);
        shelfReq[cod] = parseNum(p["SHELF"]);
      }
    });

    // Parsing da pesquisa SKU
    const skuArr = parseTabela(txtSku.value),
          shelfReal = {};
    skuArr.forEach(s => {
      if (s["LOCALIZAÇÃO"] && s["COD. PRODUTO"]) {
        const key = s["LOCALIZAÇÃO"] + '|' + s["COD. PRODUTO"];
        shelfReal[key] = parseNum(s["SHELF LIFE"]);
      }
    });

    // Limpa listas anteriores
    ulRes.innerHTML = '';
    ulDyn.innerHTML = '';
    codRes = [];
    codDyn = [];

    // Regras de avaliação
    skuArr.forEach(s => {
      if (!s["LOCALIZAÇÃO"] || !s["COD. PRODUTO"]) return;
      
      const loc = s["LOCALIZAÇÃO"],
            cod = s["COD. PRODUTO"],
            key = loc + '|' + cod,
            fis = pickMap[key] || 0,
            liv = parseNum(s["QTD CX"]),
            pal = palMap[cod] || 0,
            cxP = parseNum(prodMap[cod]?.["CX/PALETE"] || 0),
            nec = pal * cxP,
            reqSh = shelfReq[cod] || 0,
            realSh = shelfReal[key] || 0;

      if (!(key in pickMap)) {
        // Picking em local não cadastrado
        codDyn.push(cod);
        const li = document.createElement('li');
        li.innerHTML = `<strong>${cod}</strong> – <span class="badge badge-warning">Picking em Local Não Cadastrado (${loc})</span>`;
        ulDyn.appendChild(li);

      } else if (liv === 0 || (liv > 0 && liv < nec)) {
        // Ressuprimento necessário
        const resupply = nec - liv,
              newFis = fis + resupply;
        codRes.push(cod);
        const li = document.createElement('li');
        li.innerHTML =
          `<strong>${cod}</strong>` +
          ` <span class="badge badge-info">Estoque: ${fis}</span>` +
          ` <span class="badge badge-success">Demanda: ${nec}</span>` +
          ` <span class="badge badge-warning">Ressuprimento: ${resupply}</span>` +
          ` <span class="badge badge-info">Pós-estoque: ${newFis}</span>`;
        if (fis >= cxP && cxP > 0) {
          li.innerHTML += ` <span class="badge badge-alert">Sobrecarga de Picking</span>`;
        }
        ulRes.appendChild(li);

      } else if (liv > 0 && realSh !== reqSh) {
        // Picking dinâmico
        codDyn.push(cod);
        const li = document.createElement('li');
        li.innerHTML = `<strong>${cod}</strong> – <span class="badge badge-warning">Shelf ${realSh.toFixed(3)} ≠ ${reqSh.toFixed(3)}</span>`;
        ulDyn.appendChild(li);
      }
    });

    // Salva dados no localStorage
    localStorage.setItem('dinamicostratados', JSON.stringify({
      pick: txtPicking.value,
      prev: txtPreview.value,
      sku: txtSku.value,
      resHTML: ulRes.innerHTML,
      dynHTML: ulDyn.innerHTML,
      codRes,
      codDyn
    }));
  }

  // Restaura dados se existirem
  const s = localStorage.getItem('dinamicostratados');
  if (s) {
    try {
      const o = JSON.parse(s);
      txtPicking.value = o.pick || '';
      txtPreview.value = o.prev || '';
      txtSku.value = o.sku || '';
      ulRes.innerHTML = o.resHTML || '';
      ulDyn.innerHTML = o.dynHTML || '';
      codRes = o.codRes || [];
      codDyn = o.codDyn || [];
      inputsEl.classList.add('hidden');
      resEl.style.display = 'block';
    } catch (error) {
      console.error('Erro ao restaurar dados:', error);
      localStorage.removeItem('dinamicostratados');
    }
  }

  // Eventos
  btnProcess.onclick = processar;
  copyResup.onclick = () => navigator.clipboard.writeText([...new Set(codRes)].join(','));
  copyDyn.onclick = () => navigator.clipboard.writeText([...new Set(codDyn)].join(','));
  btnReset.onclick = () => {
    localStorage.removeItem('dinamicostratados'); 
    location.reload();
  };

}); // fim do DOMContentLoaded