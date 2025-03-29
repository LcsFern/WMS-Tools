// Função que verifica a data de acesso e reseta os dados após 24 horas, ou se não houver o 'firstVisit'
function checkAndReset() {
  const firstVisit = localStorage.getItem('firstVisit');
  
  // Se o 'firstVisit' não existir no localStorage
  if (!firstVisit) {
    // Limpa todos os dados armazenados
    localStorage.clear();  // Limpa o localStorage
    sessionStorage.clear(); // Limpa o sessionStorage (se necessário)
    
    // Define o 'firstVisit' como a data e hora atual
    localStorage.setItem('firstVisit', new Date().toISOString());
  } else {
    // Se 'firstVisit' existir, verifica se passaram 24 horas
    const firstVisitDate = new Date(firstVisit);
    const currentTime = new Date();
    
    // Calcula a diferença em milissegundos
    const timeDifference = currentTime - firstVisitDate;
    const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000;
    
    // Se passaram 24 horas, reseta os dados
    if (timeDifference >= twentyFourHoursInMilliseconds) {
      // Limpa os dados após 24 horas
      localStorage.clear();  // Limpa o localStorage
      sessionStorage.clear(); // Limpa o sessionStorage (se necessário)
      
      // Atualiza a data e hora do 'firstVisit'
      localStorage.setItem('firstVisit', new Date().toISOString());
    }
  }
}

// Executa a função quando a página é carregada
window.onload = checkAndReset;
