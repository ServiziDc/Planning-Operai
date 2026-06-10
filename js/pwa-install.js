// Installazione PWA - Planning Operai
(function () {
  var deferredPrompt = null;

  // Registra il service worker (percorso assoluto per GitHub Pages)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/Planning-Operai/sw.js', { scope: '/Planning-Operai/' })
      .catch(function (e) { console.warn('SW non registrato:', e); });
  }

  function creaBottone() {
    if (document.getElementById('pwaInstallBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'pwaInstallBtn';
    btn.textContent = '📲 Installa app';
    btn.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:999;background:#f59014;color:#fff;border:none;border-radius:24px;padding:12px 18px;font-size:14px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.3);cursor:pointer;';
    btn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        btn.remove();
      });
    });
    document.body.appendChild(btn);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    creaBottone();
  });

  window.addEventListener('appinstalled', function () {
    var b = document.getElementById('pwaInstallBtn');
    if (b) b.remove();
  });

  // iPhone/iPad: niente beforeinstallprompt, mostra istruzioni una volta
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isIOS && !standalone && !localStorage.getItem('pwaIosHintVisto')) {
    var hint = document.createElement('div');
    hint.style.cssText = 'position:fixed;bottom:14px;left:14px;right:14px;z-index:999;background:#2e3036;color:#fff;border-radius:12px;padding:14px;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.4);';
    hint.innerHTML = '📲 Per installare l\'app: tocca <b>Condividi</b> (quadrato con freccia) e poi <b>"Aggiungi a schermata Home"</b>. <span id="pwaIosOk" style="float:right;font-weight:700;color:#f59014;cursor:pointer;">OK</span>';
    document.body.appendChild(hint);
    document.getElementById('pwaIosOk').addEventListener('click', function () {
      localStorage.setItem('pwaIosHintVisto', '1');
      hint.remove();
    });
  }
})();
