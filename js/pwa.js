(function() {
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  function showInstallBanner() {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-banner';
    banner.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:24px;">🔮</span>
      <span style="flex:1;font-size:13px;color:#e2e8f0;">将占卜添加到主屏幕，像App一样使用</span>
      <button id="pwa-install-btn" style="padding:8px 20px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;font-size:13px;font-weight:600;">添加</button>
      <button id="pwa-close-btn" style="font-size:20px;color:#64748b;padding:4px 8px;">×</button>
    </div>`;
    banner.style.cssText = 'position:fixed;bottom:80px;left:16px;right:16px;background:rgba(26,19,51,0.95);backdrop-filter:blur(12px);border:1px solid rgba(124,58,237,0.3);border-radius:14px;padding:14px 16px;z-index:999;';
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; }
      banner.remove();
    });
    document.getElementById('pwa-close-btn').addEventListener('click', () => banner.remove());
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 30000);
  }
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
