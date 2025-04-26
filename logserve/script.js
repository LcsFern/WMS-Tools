// Simulação de dados para exemplo
const logs = [
  { chave: 'ondasdin', value: '{"data":"some-data"}', timestamp: Date.now() - 600000 },
  { chave: 'gradeCompleta', value: '{"grade":"complete"}', timestamp: Date.now() - 500000 },
  { chave: 'rankingArray', value: '[1,2,3]', timestamp: Date.now() - 400000 },
  { chave: 'movimentacoesProcessadas', value: '{"moves":"123"}', timestamp: Date.now() - 300000 },
  { chave: 'result_state_monitor', value: '{"state":"ok"}', timestamp: Date.now() - 200000 },
  { chave: 'dashboardHTML', value: '<div>Dashboard</div>', timestamp: Date.now() - 100000 }
];

const nomesPersonalizados = {
  ondasdin: 'Ondas Dinâmicas',
  gradeCompleta: 'Grade Completa',
  movimentacoesProcessadas: 'Movimentações Processadas',
  ondas: 'Ondas',
  result_state_monitor: 'Estado do Monitor',
  checkbox_state_monitor: 'Checkbox Monitor',
  dashboardHTML: 'Dashboard',
  rankingArray: 'Ranking',
  logHistoricoMudancas: 'Histórico de Mudanças',
  reaba: 'Reabastecimento'
};

const categorias = {
  ondasdin: 'ondas',
  gradeCompleta: 'ondas',
  movimentacoesProcessadas: 'movimentacoes',
  ondas: 'ondas',
  result_state_monitor: 'monitor',
  checkbox_state_monitor: 'monitor',
  dashboardHTML: 'dashboard',
  rankingArray: 'dashboard',
  logHistoricoMudancas: 'movimentacoes',
  reaba: 'movimentacoes'
};

const icones = {
  ondasdin: 'fa-water',
  gradeCompleta: 'fa-layer-group',
  movimentacoesProcessadas: 'fa-truck',
  ondas: 'fa-wave-square',
  result_state_monitor: 'fa-desktop',
  checkbox_state_monitor: 'fa-check-square',
  dashboardHTML: 'fa-chart-pie',
  rankingArray: 'fa-trophy',
  logHistoricoMudancas: 'fa-history',
  reaba: 'fa-boxes'
};

const logContainer = document.getElementById('logContainer');
const searchInput = document.getElementById('searchInput');
const categorySelect = document.getElementById('categorySelect');
const orderSelect = document.getElementById('orderSelect');
const toggleValuesBtn = document.getElementById('toggleValuesBtn');
const paginationDiv = document.getElementById('pagination');

let mostrarValores = JSON.parse(localStorage.getItem('mostrarValores')) || false;
let paginaAtual = 1;
const logsPorPagina = 20;

toggleValuesBtn.innerHTML = mostrarValores
  ? '<i class="fas fa-eye-slash"></i> Esconder Valores'
  : '<i class="fas fa-eye"></i> Mostrar Valores';

function renderizarLogs() {
  const filtro = searchInput.value.toLowerCase();
  const categoriaSelecionada = categorySelect.value;
  const ordem = orderSelect.value;

  let logsFiltrados = logs.filter(log => {
    const chaveLower = log.chave.toLowerCase();
    const categoriaLog = categorias[log.chave] || '';
    return chaveLower.includes(filtro) && (categoriaSelecionada === '' || categoriaLog === categoriaSelecionada);
  });

  logsFiltrados.sort((a, b) => {
    return ordem === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
  });

  const inicio = (paginaAtual - 1) * logsPorPagina;
  const fim = inicio + logsPorPagina;
  const logsPagina = logsFiltrados.slice(inicio, fim);

  logContainer.innerHTML = '';

  if (logsPagina.length === 0) {
    logContainer.innerHTML = '<p class="placeholder">Nenhum log encontrado.</p>';
    paginationDiv.innerHTML = '';
    return;
  }

  logsPagina.forEach(log => {
    const logDiv = document.createElement('div');
    logDiv.className = 'log-entry' + (mostrarValores ? ' show' : '');

    const nomeExibicao = nomesPersonalizados[log.chave] || log.chave;
    const iconeClasse = icones[log.chave] || 'fa-database';

    logDiv.innerHTML = `
      <div class="log-header">
        <i class="fas ${iconeClasse}"></i>
        <span>${nomeExibicao}</span>
      </div>
      <div class="timestamp">${new Date(log.timestamp).toLocaleString('pt-BR')}</div>
      <div class="log-value">${log.value}</div>
    `;
    logContainer.appendChild(logDiv);
  });

  renderizarPaginacao(logsFiltrados.length);
}

function renderizarPaginacao(totalLogs) {
  const totalPaginas = Math.ceil(totalLogs / logsPorPagina);
  paginationDiv.innerHTML = '';

  if (totalPaginas <= 1) return;

  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = i === paginaAtual ? 'active' : '';
    btn.onclick = () => {
      paginaAtual = i;
      renderizarLogs();
    };
    paginationDiv.appendChild(btn);
  }
}

// Eventos
searchInput.addEventListener('input', () => { paginaAtual = 1; renderizarLogs(); });
categorySelect.addEventListener('change', () => { paginaAtual = 1; renderizarLogs(); });
orderSelect.addEventListener('change', () => { paginaAtual = 1; renderizarLogs(); });

toggleValuesBtn.addEventListener('click', () => {
  mostrarValores = !mostrarValores;
  localStorage.setItem('mostrarValores', JSON.stringify(mostrarValores));
  toggleValuesBtn.innerHTML = mostrarValores
    ? '<i class="fas fa-eye-slash"></i> Esconder Valores'
    : '<i class="fas fa-eye"></i> Mostrar Valores';
  renderizarLogs();
});

// Primeira renderização
renderizarLogs();
