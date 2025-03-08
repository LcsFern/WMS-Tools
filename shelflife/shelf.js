// Função para formatar uma data no formato dd/mm/aaaa
  function formatDate(date) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  
    // Função de autocompletar com preenchimento automático do nome
    function autocompleteProduct() {
      const input = document.getElementById("productCode");
      const filter = input.value.toLowerCase();
      const autocompleteList = document.getElementById("autocomplete-list");
      autocompleteList.innerHTML = "";
  
      if (!filter) return;
  
      products.forEach(product => {
        // Filtra por código ou nome
        if (product.code.toLowerCase().includes(filter) || product.name.toLowerCase().includes(filter)) {
          const item = document.createElement("div");
          item.className = "autocomplete-item";
          // Exibe código e nome para facilitar a identificação
          item.textContent = product.code + " - " + product.name;
          item.onclick = function() {
            input.value = product.code;
            autocompleteList.innerHTML = "";
            document.getElementById("productName").textContent = product.name;
          };
          autocompleteList.appendChild(item);
        }
      });
    }
  
    // Função para calcular o Shelf Life, a porcentagem de shelf consumido e exibir a data de vencimento
    function calculateShelfLife() {
      const productCode = document.getElementById("productCode").value.trim();
      const manufactureDateInput = document.getElementById("manufactureDate").value;
  
      if (!productCode || !manufactureDateInput) {
        alert("Por favor, preencha todos os campos.");
        return;
      }
  
      const product = products.find(p => p.code === productCode);
      if (!product) {
        alert("Produto não encontrado.");
        return;
      }
  
      const manufactureDate = new Date(manufactureDateInput);
      const expirationDate = new Date(manufactureDate);
      expirationDate.setDate(expirationDate.getDate() + product.validity);
  
      const today = new Date();
      const timeLeft = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
  
      // Calcula a porcentagem de shelf consumido (quanto da validade foi utilizada)
      let usedShelfPercentage = ((product.validity - timeLeft) / product.validity) * 100;
      if (usedShelfPercentage < 0) usedShelfPercentage = 0;
      if (usedShelfPercentage > 100) usedShelfPercentage = 100;
      usedShelfPercentage = usedShelfPercentage.toFixed(1);
  
      let statusClass = "";
      let statusText = "";
  
      // Intervalos de shelf consumido:
      // 0% a 32%: verde (produto novo)
      // 32% a 60%: amarelo
      // 60% a 80%: laranja
      // 80% a 100%: vermelho
      if (usedShelfPercentage < 32) {
        statusClass = "green";
        statusText = "Válido (Verde)";
      } else if (usedShelfPercentage < 60) {
        statusClass = "yellow";
        statusText = "Próximo da Validade (Amarelo)";
      } else if (usedShelfPercentage < 80) {
        statusClass = "orange";
        statusText = "Perto de Expirar (Laranja)";
      } else if (usedShelfPercentage < 100) {
        statusClass = "red";
        statusText = "DATA CRITICA!!! (Vermelho)";
      } else {
        statusClass = "red";
        statusText = "Produto Vencido (Vermelho)";
      }
  
      // Atualiza os elementos com os resultados
      document.getElementById("productName").textContent = product.name;
      document.getElementById("displayManufactureDate").textContent = manufactureDateInput;
      document.getElementById("expirationDate").textContent = formatDate(expirationDate);
      document.getElementById("totalValidity").textContent = product.validity + " dias";
      document.getElementById("timeLeft").textContent = timeLeft + " dias";
      document.getElementById("shelfPercentage").textContent = usedShelfPercentage + "%";
      const statusElem = document.getElementById("status");
      statusElem.textContent = statusText;
      statusElem.className = statusClass;
  
      document.getElementById("result").style.display = "block";
    }