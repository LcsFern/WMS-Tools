(function () {
  const originalFetch = window.fetch;
  const dominioPrincipal = 'https://labsuaideia.store';
  const dominioFallback  = 'https://dry-scene-2df7.tjslucasvl.workers.dev';

  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const precisaFallback = url.startsWith(dominioPrincipal);

    try {
      const response = await originalFetch(input, init);
      if (response.ok || !precisaFallback) 
        return response;

      console.warn(`[Intercept] Falha em ${url}, tentando fallback...`);
      return originalFetch(url.replace(dominioPrincipal, dominioFallback), init);
    } catch (err) {
      if (precisaFallback) {
        console.warn(`[Intercept] Erro primário em ${url}, fallback...`);
        return originalFetch(url.replace(dominioPrincipal, dominioFallback), init);
      }
      throw err;
    }
  };
})();
