// Variáveis globais
let selectedProduct = null;
let selectedOption = null;

// Função para formatar uma data no formato dd/mm/aaaa
function formatDate(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Função para navegar entre etapas
function goToStep(step) {
  // Esconde todas as etapas
  document.querySelectorAll('.step').forEach(el => {
    el.classList.remove('active');
  });
  
  // Mostra a etapa selecionada
  document.getElementById('step'+step).classList.add('active');
  
  // Se for voltar para a etapa 2, redefine as opções
  if (step === 2) {
    document.getElementById('dateOption').style.display = 'none';
    document.getElementById('percentOption').style.display = 'none';
    selectedOption = null;
  }
}

// Função para reiniciar o processo
function resetAndGoToStep(step) {
  // Limpa os dados
  document.getElementById('productCode').value = '';
  document.getElementById('productPreview').style.display = 'none';
  document.getElementById('btnNextToStep2').disabled = true;
  selectedProduct = null;
  selectedOption = null;
  
  // Volta para a etapa inicial
  goToStep(step);
}

// Função para selecionar a opção (data ou porcentagem)
function selectOption(option) {
  selectedOption = option;
  
  // Esconde ambas as opções
  document.getElementById('dateOption').style.display = 'none';
  document.getElementById('percentOption').style.display = 'none';
  
  // Mostra a opção selecionada
  if (option === 'date') {
    document.getElementById('dateOption').style.display = 'block';
    
    // Define a data de hoje como padrão
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('manufactureDate').value = formattedDate;
  } else {
    document.getElementById('percentOption').style.display = 'block';
    updatePercentValue();
  }
}

// Atualiza o valor exibido do slider de porcentagem
function updatePercentValue() {
  const percent = document.getElementById('shelfPercent').value;
  document.getElementById('percentValue').textContent = percent + '%';
}

// Função de autocompletar com preenchimento automático do nome
function autocompleteProduct() {
  const input = document.getElementById("productCode");
  const filter = input.value.toLowerCase();
  const autocompleteList = document.getElementById("autocomplete-list");
  autocompleteList.innerHTML = "";
  
  // Desabilita o botão de continuar
  document.getElementById('btnNextToStep2').disabled = true;
  document.getElementById('productPreview').style.display = 'none';
  selectedProduct = null;

  if (!filter) return;

  const matchedProducts = products.filter(product => 
    product.code.toLowerCase().includes(filter) || 
    product.name.toLowerCase().includes(filter)
  ).slice(0, 6); // Limita a 6 resultados para melhor usabilidade

  if (matchedProducts.length > 0) {
    matchedProducts.forEach(product => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      
      // Formata para exibir código e nome
      const displayText = `${product.code} - ${product.name}`;
      
      item.innerHTML = displayText;
      item.onclick = function() {
        // Seleciona o produto
        selectedProduct = product;
        input.value = product.code;
        
        // Atualiza e mostra a pré-visualização do produto
        document.getElementById("previewProductName").textContent = product.name;
        document.getElementById("previewProductCode").textContent = "Código: " + product.code;
        document.getElementById("previewValidity").textContent = "Validade: " + product.validity + " dias";
        document.getElementById("productPreview").style.display = "flex";
        
        // Limpa a lista de autocompletar
        autocompleteList.innerHTML = "";
        
        // Habilita o botão de continuar
        document.getElementById('btnNextToStep2').disabled = false;
      };
      autocompleteList.appendChild(item);
    });
  } else {
    const noMatch = document.createElement("div");
    noMatch.className = "autocomplete-item no-match";
    noMatch.textContent = "Nenhum produto encontrado";
    autocompleteList.appendChild(noMatch);
  }
}

// Fecha a lista de autocompletar quando clicar fora
document.addEventListener('click', function(e) {
  if (e.target.id !== 'productCode') {
    document.getElementById('autocomplete-list').innerHTML = '';
  }
});

// Calcular a partir da data de fabricação
function calculateFromDate() {
  if (!selectedProduct) {
    showToast("Por favor, selecione um produto primeiro");
    return;
  }
  
  const manufactureDateInput = document.getElementById("manufactureDate").value;
  
  if (!manufactureDateInput) {
    showToast("Por favor, informe a data de fabricação");
    return;
  }

  const manufactureDate = new Date(manufactureDateInput);
  const expirationDate = new Date(manufactureDate);
  expirationDate.setDate(expirationDate.getDate() + selectedProduct.validity);

  const today = new Date();
  const timeLeft = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));

  // Calcula a porcentagem de shelf consumido
  let usedShelfPercentage = ((selectedProduct.validity - timeLeft) / selectedProduct.validity) * 100;
  if (usedShelfPercentage < 0) usedShelfPercentage = 0;
  if (usedShelfPercentage > 100) usedShelfPercentage = 100;
  
  displayResults(selectedProduct, manufactureDate, expirationDate, selectedProduct.validity, timeLeft, usedShelfPercentage);
  goToStep(3);
}

// Calcular a partir da porcentagem de shelf
function calculateFromPercent() {
  if (!selectedProduct) {
    showToast("Por favor, selecione um produto primeiro");
    return;
  }

  const shelfPercent = parseInt(document.getElementById("shelfPercent").value);

  // Calcula a data de fabricação baseada na porcentagem 
  const today = new Date();
  const usedDays = Math.round((shelfPercent / 100) * selectedProduct.validity);
  const remainingDays = selectedProduct.validity - usedDays;
  
  const expirationDate = new Date(today);
  expirationDate.setDate(expirationDate.getDate() + remainingDays);
  
  const manufactureDate = new Date(expirationDate);
  manufactureDate.setDate(manufactureDate.getDate() - selectedProduct.validity);

  displayResults(selectedProduct, manufactureDate, expirationDate, selectedProduct.validity, remainingDays, shelfPercent);
  goToStep(3);
}

// Função para exibir os resultados no painel
function displayResults(product, manufactureDate, expirationDate, totalValidity, timeLeft, usedShelfPercentage) {
  // Arredonda a porcentagem para 1 casa decimal
  usedShelfPercentage = parseFloat(usedShelfPercentage.toFixed(1));
  
  let statusClass = "";
  let statusText = "";
  let statusColor = "";

  // Intervalos de shelf consumido e status
  if (usedShelfPercentage < 32) {
    statusClass = "green";
    statusText = "Válido";
    statusColor = "#34c759"; // Verde acento
  } else if (usedShelfPercentage < 60) {
    statusClass = "yellow";
    statusText = "Próximo da Validade";
    statusColor = "#ffe600"; // Amarelo
  } else if (usedShelfPercentage < 80) {
    statusClass = "orange";
    statusText = "Perto de Expirar";
    statusColor = "#ff9100"; // Laranja
  } else if (usedShelfPercentage < 100) {
    statusClass = "red";
    statusText = "DATA CRÍTICA!!!";
    statusColor = "#ff4444"; // Vermelho
  } else {
    statusClass = "red";
    statusText = "Produto Vencido";
    statusColor = "#ff4444"; // Vermelho
  }

  // Atualiza os elementos com os resultados
  document.getElementById("resultProductName").textContent = product.name;
  document.getElementById("resultProductCode").textContent = "Código: " + product.code;
  document.getElementById("displayManufactureDate").textContent = formatDate(manufactureDate);
  document.getElementById("expirationDate").textContent = formatDate(expirationDate);
  document.getElementById("totalValidity").textContent = totalValidity + " dias";
  document.getElementById("timeLeft").textContent = timeLeft + " dias";
  document.getElementById("shelfPercentage").textContent = usedShelfPercentage + "%";
  
  // Atualiza a badge de status
  const statusBadge = document.getElementById("statusBadge");
  statusBadge.textContent = statusText;
  statusBadge.className = "status-badge " + statusClass;
  
  // Atualiza a barra de progresso
  const progressFill = document.getElementById("progressFill");
  progressFill.style.width = usedShelfPercentage + "%";
  progressFill.style.backgroundColor = statusColor;
}

// Função para exibir toast (notificação)
function showToast(message) {
  // Verifica se já existe um toast e remove
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Cria um novo toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Adiciona classe para animar entrada
  setTimeout(() => {
    toast.classList.add('show');
    
    // Remove o toast após 3 segundos
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }, 100);
}

// Inicializa a aplicação
document.addEventListener('DOMContentLoaded', function() {
  // Define a data de hoje como padrão no campo de data
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  document.getElementById('manufactureDate').value = formattedDate;
  
  // Inicializa o valor do percentual
  updatePercentValue();
});