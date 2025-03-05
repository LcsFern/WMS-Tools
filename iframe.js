window.onload = function() {
    var iframe = document.getElementById('contentFrame');

    function adjustIframeHeight() {
        iframe.style.height = iframe.contentWindow.document.body.scrollHeight + 'px';
    }

    iframe.onload = adjustIframeHeight;

    // Ajusta a altura inicial
    adjustIframeHeight();
};