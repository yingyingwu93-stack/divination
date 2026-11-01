(function() {
  const SUPPRESS_KEY = 'zhanbu_pwa_suppress_until';
  const DAY = 86400000;
  let deferredPrompt;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function isSuppressed() {
    return Number(localStorage.getItem(SUPPRESS_KEY) || 0) > Date.now();
  }

  function suppress(days) {
    localStorage.setItem(SUPPRESS_KEY, String(Date.now() + days * DAY));
  }

  function removeBanner() {
    const el = document.getElementById('pwa-banner');
    if (el) el.remove();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    suppress(3650);
    removeBanner();
    deferredPrompt = null;
  });

  function showInstallBanner() {
    if (isStandalone() || isSuppressed() || document.getElementById('pwa-banner')) return;

    // 展示一次后 7 天内不再打扰；主动关闭则 30 天内不再出现
    suppress(7);

    const banner = document.createElement('div');
    banner.id = 'pwa-banner';
    banner.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:24px;">🔮</span>
      <span style="flex:1;font-size:13px;color:#e2e8f0;">将观象添加到主屏幕，像App一样使用</span>
      <button id="pwa-install-btn" style="padding:8px 20px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;font-size:13px;font-weight:600;">添加</button>
      <button id="pwa-close-btn" title="30 天内不再提示" style="font-size:20px;color:#64748b;padding:4px 8px;">×</button>
    </div>`;
    banner.style.cssText = 'position:fixed;bottom:80px;left:16px;right:16px;background:rgba(26,19,51,0.95);backdrop-filter:blur(12px);border:1px solid rgba(124,58,237,0.3);border-radius:14px;padding:14px 16px;z-index:999;';
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        suppress(choice && choice.outcome === 'accepted' ? 3650 : 7);
      }
      removeBanner();
    });

    document.getElementById('pwa-close-btn').addEventListener('click', () => {
      suppress(30);
      removeBanner();
    });

    // 用户不操作时自动收起，本次已记录 7 天抑制
    setTimeout(removeBanner, 20000);
  }
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ========== 每日运势本地通知 ========== */
function chinaToday() {
  return new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

async function notifyDailyFortune(force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;

  const sign = localStorage.getItem('zhanbu_sign');
  if (!sign) return false;

  const today = chinaToday();
  if (!force && localStorage.getItem('zhanbu_fortune_notified') === today) return false;

  try {
    const res = await apiRequest(`/fortune/daily?sign=${encodeURIComponent(sign)}`);
    const data = await res.json();
    if (!data.success) return false;

    const f = data.data;
    const title = `${sign}今日运势 ${f.overall} 分`;
    const body = `${f.summary} 幸运色：${f.lucky_color}，幸运数字：${f.lucky_number}`;
    const options = { body, icon: 'icons/icon.svg', tag: 'daily-fortune' };

    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    localStorage.setItem('zhanbu_fortune_notified', today);
    return true;
  } catch (e) {
    console.warn('每日运势通知失败:', e.message);
    return false;
  }
}

async function enableDailyFortune() {
  if (!('Notification' in window)) {
    alert('当前浏览器不支持通知功能');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('通知权限未开启，可在浏览器设置中允许通知');
    return;
  }
  if (!localStorage.getItem('zhanbu_sign')) {
    alert('请先在星座页面分析一次，确定你的星座后再开启提醒');
    return;
  }
  await notifyDailyFortune(true);
  alert('已开启每日运势提醒');
}

window.enableDailyFortune = enableDailyFortune;

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => notifyDailyFortune(false), 1500);
});
