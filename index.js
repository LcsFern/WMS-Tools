  // Verifica autenticação do usuário
  const username = localStorage.getItem('username');
  if (!username) {
    window.location.href = 'login.html';
  } else {
    // Preenche o avatar (se já estiver usando outro) e o nome na sidebar
    // Exibe o nome completo ou, se preferir, as iniciais
    document.getElementById('sidebarUserName').textContent = username;
    
    // Caso continue usando o avatar flutuante ou em outra área:
    const initials = username.split(' ').map(name => name.charAt(0)).join('').toUpperCase();
    const userInitialsElement = document.getElementById('userInitials');
    if(userInitialsElement) {
      userInitialsElement.textContent = initials;
    }
  }
  

    // Seleciona todos os botões de navegação
    const navButtons = document.querySelectorAll('.nav-btn');
    const contentFrame = document.getElementById('contentFrame');

    // Função para carregar a página e atualizar o botão ativo
    function loadPage(page, clickedButton) {
      contentFrame.src = page;
      navButtons.forEach(btn => btn.classList.remove('active'));
      clickedButton.classList.add('active');
    }

    // Configura event listeners para cada botão de navegação
    navButtons.forEach(button => {
      button.addEventListener('click', () => {
        loadPage(button.dataset.page, button);
      });
    });

    // Realiza logout
    document.querySelector('.logout-btn').addEventListener('click', () => {
      localStorage.removeItem('username');
      window.location.href = 'login.html';
    });

    // Opcional: Destaca o botão correspondente à página carregada inicialmente (se necessário)
    window.addEventListener('DOMContentLoaded', () => {
      const initialPage = contentFrame.src;
      navButtons.forEach(button => {
        if (button.dataset.page === initialPage) {
          button.classList.add('active');
        }
      });
    });