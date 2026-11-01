function goTo(url) { window.location.href = url; }
function goBack() { if (window.history.length > 1) { window.history.back(); } else { window.location.href = 'index.html'; } }

/* 导航栏「命理」入口：弹出八字 / 紫微选择 */
function openMingliMenu(event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }

  // 已在命理相关页面时不重复弹出
  if (document.querySelector('.mingli-mask')) return;

  const mask = document.createElement('div');
  mask.className = 'mingli-mask';
  mask.innerHTML = `
    <div class="mingli-sheet">
      <div class="mingli-sheet-title">选择命理方式</div>
      <div class="mingli-options">
        <div class="mingli-option" onclick="goTo('bazi.html')">
          <span class="mo-icon">☯️</span>
          <span>八字命理</span>
          <span class="mo-desc">四柱 · 五行 · 大运</span>
        </div>
        <div class="mingli-option" onclick="goTo('ziwei.html')">
          <span class="mo-icon">🔮</span>
          <span>紫微斗数</span>
          <span class="mo-desc">十二宫 · 星曜 · 四化</span>
        </div>
      </div>
      <button class="mingli-close" onclick="closeMingliMenu()">取消</button>
    </div>`;

  mask.addEventListener('click', (e) => {
    if (e.target === mask) closeMingliMenu();
  });
  document.body.appendChild(mask);
}

function closeMingliMenu() {
  const mask = document.querySelector('.mingli-mask');
  if (mask) mask.remove();
}

// 验证 Token 是否有效（后端校验）
async function validateToken() {
  if (!Auth.isLoggedIn()) return false;
  try {
    const res = await apiRequest('/user');
    const data = await res.json();
    return data.success && data.user;
  } catch {
    return false;
  }
}

// 登录检查 — 需要登录的页面调用
async function requireLogin() {
  const valid = await validateToken();
  if (!valid) {
    Auth.removeToken();
    goTo('auth.html');
    return false;
  }
  return true;
}

// 通用错误渲染（带重试按钮）
function renderError(container, message, retryFn) {
  if (typeof container === 'string') container = document.getElementById(container);
  if (!container) return;
  container.innerHTML = `
    <div class="error-box" style="text-align:center;padding:30px 20px;">
      <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
      <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;line-height:1.6;">${escapeHtml(message)}</p>
      <button onclick="${retryFn}" style="padding:10px 28px;border-radius:20px;background:linear-gradient(135deg,var(--primary),var(--primary-light));color:white;border:none;font-size:14px;cursor:pointer;">
        🔄 重试
      </button>
    </div>`;
}


function createStars(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // 星星
  for (let i = 0; i < 40; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--dur', (1.5 + Math.random() * 3) + 's');
    star.style.animationDelay = Math.random() * 3 + 's';
    star.style.width = star.style.height = (1 + Math.random() * 2) + 'px';
    container.appendChild(star);
  }

  // 流星（仅在大尺寸 header 中）
  if (containerId === 'stars-home' || containerId === 'stars-zodiac' || containerId === 'stars-tarot' || containerId === 'stars-bazi' || containerId === 'stars-ziwei') {
    for (let i = 0; i < 3; i++) {
      const meteor = document.createElement('div');
      meteor.className = 'meteor';
      meteor.style.left = Math.random() * 60 + '%';
      meteor.style.top = Math.random() * 50 + '%';
      meteor.style.setProperty('--meteor-dur', (2 + Math.random() * 3) + 's');
      meteor.style.animationDelay = (Math.random() * 5) + 's';
      container.appendChild(meteor);
    }
  }

  // 极光光晕
  const aurora1 = document.createElement('div');
  aurora1.className = 'aurora aurora-1';
  container.appendChild(aurora1);
  const aurora2 = document.createElement('div');
  aurora2.className = 'aurora aurora-2';
  container.appendChild(aurora2);
}

function zodiacCardHtml(zodiac, score) {
  return `
    <div class="zodiac-item" onclick="goTo('zodiac.html?sign=${encodeURIComponent(zodiac.name)}')">
      <div class="z-icon">${zodiac.icon}</div>
      <div class="z-name">${zodiac.name}</div>
      <div class="z-date">${zodiac.date}</div>
      <div class="z-score"><span>${score}</span>分</div>
    </div>`;
}

async function renderZodiacScroll() {
  const container = document.getElementById('zodiac-scroll');
  if (!container) return;

  // 先占位，再拉取真实的今日运势，保证与详情页分数一致
  container.innerHTML = zodiacSigns.map(z => zodiacCardHtml(z, '—')).join('');

  try {
    const res = await apiRequest('/fortune/overview?period=day');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '加载失败');

    const scores = {};
    (data.items || []).forEach(item => { scores[item.sign] = item.overall; });
    container.innerHTML = zodiacSigns.map(z =>
      zodiacCardHtml(z, scores[z.name] !== undefined ? scores[z.name] : '—')
    ).join('');
  } catch (e) {
    console.warn('首页运势加载失败:', e.message);
  }
}

const DREAM_ICONS = {
  '动物': '🐾', '植物': '🌿', '人物': '👤', '情感': '💗',
  '场景': '🎬', '物品': '🎁', '自然': '🌦️', '身体': '🫀',
  '鬼神': '👻', '建筑': '🏛️', '交通': '🚗', '数字': '🔢', '其他': '✨'
};

function renderDreamItem(d) {
  const icon = DREAM_ICONS[d.category] || '🌙';
  return `
    <div class="dream-item" onclick="this.classList.toggle('open')">
      <div class="dream-item-header">
        <span class="d-icon">${icon}</span>
        <span class="d-title">${d.title}</span>
        <span class="d-arrow">▼</span>
      </div>
      <div class="dream-item-body">
        <p><strong>传统解梦：</strong>${d.traditional || ''}</p>
        <p style="margin-top:8px;"><strong>心理分析：</strong>${d.psychology || ''}</p>
      </div>
    </div>`;
}

async function renderHomeArticles() {
  const container = document.getElementById('home-articles');
  if (!container) return;
  try {
    const res = await DreamAPI.list('', '', 1, 3);
    container.innerHTML = (res.items || []).map(renderDreamItem).join('');
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">解梦内容加载失败</div>';
  }
}

const dreamState = {
  keyword: '', category: '', page: 1, pageSize: 12,
  total: 0, loading: false
};

async function initDreamPage() {
  createStars('stars-dream');
  await loadDreamCategories();
  await loadDreamList(true);
}

async function loadDreamCategories() {
  const container = document.getElementById('cat-tags');
  if (!container) return;
  try {
    const res = await DreamAPI.categories();
    const categories = [{ name: '全部', count: 0 }].concat(res.categories || []);
    container.innerHTML = categories.map(c => `
      <span class="cat-tag ${c.name === (dreamState.category || '全部') ? 'active' : ''}"
            onclick="selectCategory('${c.name}')">${c.name}</span>
    `).join('');
  } catch (e) {
    console.warn('加载解梦分类失败:', e.message);
  }
}

function selectCategory(cat) {
  dreamState.category = cat === '全部' ? '' : cat;
  document.querySelectorAll('#cat-tags .cat-tag').forEach(el => {
    el.classList.toggle('active', el.textContent.trim() === cat);
  });
  loadDreamList(true);
}

async function loadDreamList(reset = false) {
  const container = document.getElementById('dream-list');
  if (!container || dreamState.loading) return;

  dreamState.loading = true;
  if (reset) {
    dreamState.page = 1;
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">正在加载...</div>';
  }

  try {
    const res = await DreamAPI.list(
      dreamState.keyword, dreamState.category, dreamState.page, dreamState.pageSize
    );
    if (!res.success) throw new Error(res.error || '加载失败');

    dreamState.total = res.total;
    const items = res.items || [];

    if (reset) container.innerHTML = '';
    if (items.length === 0 && reset) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">暂无相关梦境解读</div>';
    } else {
      container.insertAdjacentHTML('beforeend', items.map(renderDreamItem).join(''));
    }

    if (items.length > 0) dreamState.page += 1;

    const moreBtn = document.getElementById('dream-load-more');
    if (moreBtn) {
      const shown = container.querySelectorAll('.dream-item').length;
      moreBtn.style.display = shown < dreamState.total ? 'block' : 'none';
      moreBtn.textContent = `加载更多（${shown}/${dreamState.total}）`;
    }
  } catch (e) {
    if (reset) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">加载失败：${e.message}</div>`;
    }
  } finally {
    dreamState.loading = false;
  }
}

let dreamSearchTimer = null;
function filterDreams() {
  clearTimeout(dreamSearchTimer);
  dreamSearchTimer = setTimeout(() => {
    dreamState.keyword = document.getElementById('dream-search').value.trim();
    loadDreamList(true);
  }, 300);
}

function loadMoreDreams() {
  loadDreamList(false);
}

function getZodiacByDate(dateStr) {
  const date = new Date(dateStr);
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const ranges = [[3,21,4,19,0],[4,20,5,20,1],[5,21,6,21,2],[6,22,7,22,3],[7,23,8,22,4],[8,23,9,22,5],[9,23,10,23,6],[10,24,11,22,7],[11,23,12,21,8],[12,22,1,19,9],[1,20,2,18,10],[2,19,3,20,11]];
  for (const [sm, sd, em, ed, idx] of ranges) {
    if ((m === sm && d >= sd) || (m === em && d <= ed)) return zodiacSigns[idx];
  }
  return zodiacSigns[0];
}

function analyzeZodiac(saveProfile = true) {
  const dateStr = document.getElementById('birth-date').value;
  if (!dateStr) return alert('请选择出生日期');
  const zodiac = getZodiacByDate(dateStr);
  localStorage.setItem('zhanbu_sign', zodiac.name);
  if (saveProfile) saveBirthDate(dateStr);
  renderZodiacDetail(zodiac);
}

async function saveBirthDate(dateStr) {
  if (!dateStr) return;
  localStorage.setItem('zhanbu_birth_date', dateStr);

  if (!Auth.isLoggedIn()) return;
  try {
    const res = await apiRequest('/user/birth', {
      method: 'PUT',
      body: JSON.stringify({ birth_date: dateStr })
    });
    const data = await res.json();
    if (data.success) {
      const user = Auth.getUser();
      if (user) {
        user.birth_date = dateStr;
        Auth.setUser(user);
      }
    }
  } catch (e) {
    console.warn('保存出生日期失败:', e.message);
  }
}

function showZodiacBySign(signName, savedBirthDate = '') {
  const zodiac = zodiacSigns.find(z => z.name === signName);
  if (!zodiac) return false;

  const dateInput = document.getElementById('birth-date');
  let displayDate = '';

  // 如果保存的生日正好属于该星座，优先显示用户上次输入的日期
  if (/^\d{4}-\d{2}-\d{2}$/.test(savedBirthDate)) {
    try {
      if (getZodiacByDate(savedBirthDate).name === zodiac.name) {
        displayDate = savedBirthDate;
      }
    } catch (e) {
      console.warn('出生日期解析失败:', e.message);
    }
  }

  // 否则使用该星座范围内的代表性日期，供 AI 分析使用
  if (!displayDate) {
    const [monthDay] = zodiac.date.split(' - ');
    const [month, day] = monthDay.split('.').map(Number);
    displayDate = `2000-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  if (dateInput) dateInput.value = displayDate;

  localStorage.setItem('zhanbu_sign', zodiac.name);
  renderZodiacDetail(zodiac);
  return true;
}

function renderZodiacDetail(zodiac) {
  document.getElementById('zodiac-result').style.display = 'block';
  document.getElementById('zr-icon').textContent = zodiac.icon;
  document.getElementById('zr-name').textContent = zodiac.name;
  document.getElementById('zr-date').textContent = zodiac.date;
  document.getElementById('zr-elem').textContent = zodiac.element;

  const traits = Object.entries(zodiac.traits).map(([name, val]) => `
    <div class="stat-row">
      <div class="stat-label"><span class="stat-name">${name}</span><span class="stat-val">${val}%</span></div>
      <div class="stat-bar"><div class="stat-fill" style="width:${val}%"></div></div>
    </div>
  `).join('');

  const fortune = getZodiacFortune(zodiac.name);
  document.getElementById('tab-personality').innerHTML = `
    <div class="fortune-card"><h4>🔍 性格概述</h4><p>${fortune.personality.desc}</p></div>
    <div class="fortune-card"><h4>📊 特质指数</h4>${traits}</div>`;
  document.getElementById('tab-love').innerHTML = `<div class="fortune-card"><h4>💕 桃花运势</h4><p>${fortune.love.desc}</p></div>`;
  document.getElementById('tab-career').innerHTML = `<div class="fortune-card"><h4>💼 事业运势</h4><p>${fortune.career.desc}</p></div>`;

  loadZodiacPeriods(zodiac.name);

  if (typeof aiZodiacAnalysis === 'function') {
    setTimeout(() => aiZodiacAnalysis(zodiac), 400);
  }
}

async function loadZodiacPeriods(sign) {
  const periods = [
    ['today', 'day', '今日'],
    ['week', 'week', '本周'],
    ['month', 'month', '本月'],
    ['year', 'year', '今年']
  ];

  periods.forEach(async ([tabKey, period, label]) => {
    const container = document.getElementById('tab-' + tabKey);
    if (!container) return;
    container.innerHTML = `<div class="loading-text">正在生成${label}运势...</div>`;
    try {
      const res = await apiRequest(`/fortune/period?sign=${encodeURIComponent(sign)}&period=${period}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '加载失败');
      renderPeriodFortune(container, data.data);
    } catch (e) {
      container.innerHTML = `<div class="fortune-card"><p>${label}运势加载失败：${escapeHtml(e.message)}</p></div>`;
    }
  });
}

function renderPeriodFortune(container, data) {
  const labels = { love: '爱情', career: '事业', wealth: '财运', health: '健康' };
  const scoreRows = Object.entries(data.scores).map(([key, val]) => `
    <div class="stat-row">
      <div class="stat-label"><span class="stat-name">${labels[key] || key}</span><span class="stat-val">${val}%</span></div>
      <div class="stat-bar"><div class="stat-fill" style="width:${val}%"></div></div>
    </div>`).join('');

  container.innerHTML = `
    <div class="fortune-card period-card">
      <div class="period-head">
        <div>
          <div class="period-title">${data.period_label}运势</div>
          <div class="period-range">${data.range}</div>
        </div>
        <div class="period-score"><span>${data.overall}</span><small>分</small></div>
      </div>
      <p>${escapeHtml(data.summary)}</p>
      <div class="period-scores">${scoreRows}</div>
      <div class="period-lucky">🍀 幸运色：${data.lucky_color}　🔢 幸运数字：${data.lucky_number}</div>
      <ul class="period-advice">${data.advice.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
    </div>`;
}

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const target = document.getElementById('tab-' + tabName);
      if (target) target.classList.add('active');
    });
  });
}

async function initZodiacPage() {
  createStars('stars-zodiac');
  initTabs();

  // 先读取已保存的出生日期
  let saved = localStorage.getItem('zhanbu_birth_date') ||
    (Auth.getUser() && Auth.getUser().birth_date) || '';

  if (!saved && Auth.isLoggedIn()) {
    try {
      const res = await apiRequest('/user');
      const data = await res.json();
      if (data.success && data.user.birth_date) {
        saved = data.user.birth_date;
      }
    } catch (e) {
      console.warn('读取出生日期失败:', e.message);
    }
  }

  if (saved) localStorage.setItem('zhanbu_birth_date', saved);

  const sign = new URLSearchParams(window.location.search).get('sign');
  if (sign && showZodiacBySign(sign, saved)) {
    // 从首页星座卡片进入时，默认展示今日运势
    const todayTab = document.querySelector('.tab[data-tab="today"]');
    if (todayTab) todayTab.click();
    return;
  }

  const dateInput = document.getElementById('birth-date');
  if (saved && dateInput) dateInput.value = saved;

  analyzeZodiac(false);
}

/* ========== 首页：我的今日运势 + 最近记录 ========== */
async function renderMyFortune() {
  const container = document.getElementById('my-fortune');
  if (!container) return;

  // 出生日期优先：只要用户填过生日，就默认按生日计算星座
  let birthDate = localStorage.getItem('zhanbu_birth_date') ||
    (Auth.getUser() && Auth.getUser().birth_date) || '';

  if (!birthDate && Auth.isLoggedIn()) {
    try {
      const res = await apiRequest('/user');
      const data = await res.json();
      if (data.success && data.user.birth_date) {
        birthDate = data.user.birth_date;
        localStorage.setItem('zhanbu_birth_date', birthDate);
      }
    } catch (e) {
      console.warn('读取出生日期失败:', e.message);
    }
  }

  let signName = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    try {
      const zodiacByBirth = getZodiacByDate(birthDate);
      if (zodiacByBirth) {
        signName = zodiacByBirth.name;
        localStorage.setItem('zhanbu_sign', signName);
      }
    } catch (e) {
      console.warn('出生日期解析失败:', e.message);
    }
  }

  if (!signName) signName = localStorage.getItem('zhanbu_sign') || '';

  if (!signName) {
    container.innerHTML = `
      <div class="my-fortune-setup" onclick="goTo('zodiac.html')">
        <div class="my-fortune-icon">✨</div>
        <div class="my-fortune-info">
          <div class="my-fortune-name">设置你的星座</div>
          <div class="my-fortune-date">输入出生日期，查看专属今日运势</div>
        </div>
        <span class="my-fortune-arrow">›</span>
      </div>`;
    return;
  }

  const zodiac = zodiacSigns.find(z => z.name === signName);
  if (!zodiac) return;

  container.innerHTML = '<div class="my-fortune-loading">正在获取今日运势...</div>';
  try {
    const res = await apiRequest(`/fortune/period?sign=${encodeURIComponent(signName)}&period=day`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '加载失败');
    const f = data.data;

    container.innerHTML = `
      <div class="my-fortune-main" onclick="goTo('zodiac.html?sign=${encodeURIComponent(signName)}')">
        <div class="my-fortune-head">
          <div class="my-fortune-icon">${zodiac.icon}</div>
          <div class="my-fortune-info">
            <div class="my-fortune-name">${signName}<small>今日运势</small></div>
            <div class="my-fortune-date">${f.range}</div>
          </div>
          <div class="my-fortune-score"><span>${f.overall}</span><small>分</small></div>
        </div>
        <p class="my-fortune-summary">${escapeHtml(f.summary)}</p>
        <div class="my-fortune-meta">🍀 幸运色 ${f.lucky_color}　🔢 幸运数字 ${f.lucky_number}</div>
      </div>`;
  } catch (e) {
    container.innerHTML = `
      <div class="my-fortune-setup" onclick="renderMyFortune()">
        <div class="my-fortune-icon">⚠️</div>
        <div class="my-fortune-info">
          <div class="my-fortune-name">今日运势加载失败</div>
          <div class="my-fortune-date">点击重试</div>
        </div>
      </div>`;
  }
}

function getRecordPreview(r) {
  try {
    const obj = JSON.parse(r.input_data);
    if (r.type === '八字') {
      return `出生 ${obj.year || ''}年${obj.month || ''}月${obj.day || ''}日`;
    }
    if (r.type === '紫微斗数') {
      const parts = [`${obj.year || ''}年${obj.month || ''}月${obj.day || ''}日`];
      if (obj.soulPalace) parts.push(obj.soulPalace);
      if (obj.soulStars) parts.push(obj.soulStars);
      return parts.join(' · ');
    }
    if (r.type === '塔罗') {
      return [obj.spread, obj.question].filter(Boolean).join(' · ') || '塔罗解读';
    }
    if (r.type === '解梦') {
      return typeof obj === 'string' ? obj : (obj.dream || '');
    }
    if (r.type === '星座') {
      return obj.sign || '星座分析';
    }
  } catch (e) {
    return (r.input_data || '').slice(0, 40);
  }
  return (r.input_data || '').slice(0, 40);
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + ' UTC');
  const diff = Date.now() - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

async function renderRecentRecords() {
  const container = document.getElementById('recent-list');
  if (!container) return;

  container.innerHTML = '<div class="recent-empty">正在加载...</div>';
  try {
    const data = await HistoryAPI.list({ page: 1, pageSize: 3 });
    if (!data.success) throw new Error(data.error || '加载失败');

    const items = data.readings || [];
    if (!items.length) {
      container.innerHTML = '<div class="recent-empty">还没有记录，去体验一次吧</div>';
      return;
    }

    const icons = { '聊天': '💬', '八字': '☯️', '紫微斗数': '🔮', '塔罗': '🃏', '解梦': '🌙', '星座': '⭐' };
    container.innerHTML = items.map(r => `
      <div class="recent-item" onclick="goTo('history.html')">
        <span class="recent-icon">${icons[r.type] || '🔮'}</span>
        <div class="recent-main">
          <div class="recent-title">${escapeHtml(r.type)} · ${escapeHtml(getRecordPreview(r))}</div>
          <div class="recent-time">${formatRelativeTime(r.created_at)}</div>
        </div>
        ${r.is_favorite ? '<span class="recent-fav">★</span>' : '<span class="recent-arrow">›</span>'}
      </div>`).join('');
  } catch (e) {
    container.innerHTML = `<div class="recent-empty">记录加载失败：${escapeHtml(e.message)}</div>`;
  }
}

if (document.getElementById('page-home')) {
  createStars('stars-home');
  requireLogin().then(valid => {
    if (valid) {
      renderMyFortune();
      renderZodiacScroll();
      renderHomeArticles();
      renderRecentRecords();
      restoreChat();
    }
  });
}
/* ========== 滚动入场动画 ========== */
function initScrollReveal() {
  const elements = document.querySelectorAll('.feature-card, .section-title, .zodiac-selector, .dream-describe, .bazi-form, .tarot-intro, .tarot-spread');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  elements.forEach(el => {
    el.classList.add('scroll-reveal');
    observer.observe(el);
  });
}

/* ========== Ripple 波纹效果 ========== */
function initRipple() {
  document.addEventListener('click', function(e) {
    const target = e.target.closest('.feature-card, .cat-tag, .zodiac-item, .confirm-btn, .describe-btn, .bazi-start-btn, .reset-btn');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    target.style.position = 'relative';
    target.style.overflow = 'hidden';
    target.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

/* ========== 数字滚动动画 ========== */
function animateNumber(el, target, duration) {
  const start = 0;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// 初始化全局动效
document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initRipple();
});

/* ========== AI 聊天 ========== */
const CHAT_SYSTEM = `你是一位温暖、有共情力的 AI 观象助手。你的职责是帮助用户解答关于感情、运势、人际关系等方面的困惑。

要求：
1. 始终保持积极、正向的引导，给用户希望和力量
2. 语言温暖自然，像朋友在聊天，不要像机器人在念稿
3. 回答要有实用性，给出具体的建议和方法
4. 不要使用 markdown 格式（不用 **粗体** 等），用自然段落
5. 每次回答控制在 200-400 字，简洁有力
6. 用空行分段，结构清晰
7. 如果用户问的问题涉及命理，可以结合星座、塔罗、八字等知识来回答

你可以引导用户使用站内功能。当用户想使用某个功能时，先正常回应用户，然后在回复的最后单独一行输出对应标记（只输出一个标记，不要解释标记本身）：
[[ACTION:zodiac]] 星座运势
[[ACTION:tarot]] 塔罗占卜
[[ACTION:dream]] 解梦
[[ACTION:bazi]] 八字命理
[[ACTION:ziwei]] 紫微斗数
例如用户说“我想玩塔罗牌”，就正常回应，最后一行写 [[ACTION:tarot]]。`;

window.CHAT_SYSTEM = CHAT_SYSTEM;

const CHAT_GREETING = '你好！我是你的 AI 观象助手 🔮 你可以问我关于感情、运势、人际关系等问题，我会为你提供积极的指引和建议～';
let currentConversationId = Number(localStorage.getItem('zhanbu_conversation')) || null;

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

/* ---------- 聊天中的功能跳转标记 ---------- */
const CHAT_ACTION_MAP = {
  zodiac: { label: '星座运势', icon: '⭐', url: 'zodiac.html' },
  tarot: { label: '塔罗占卜', icon: '🃏', url: 'tarot.html' },
  dream: { label: '解梦', icon: '🌙', url: 'dream.html' },
  bazi: { label: '八字命理', icon: '☯️', url: 'bazi.html' },
  ziwei: { label: '紫微斗数', icon: '🔮', url: 'ziwei.html' }
};

function parseChatAction(text) {
  const match = String(text).match(/\[\[ACTION:([a-z]+)\]\]/);
  return match && CHAT_ACTION_MAP[match[1]] ? match[1] : null;
}

/* 模型偶尔不输出标记，用用户原话做兜底识别 */
const CHAT_INTENT_RULES = [
  { key: 'tarot', words: ['塔罗', '抽牌', '牌阵', '抽张牌'] },
  { key: 'ziwei', words: ['紫微', '斗数'] },
  { key: 'bazi', words: ['八字', '四柱', '排盘', '生辰', '算命'] },
  { key: 'dream', words: ['解梦', '梦见', '做梦', '梦到', '解个梦', '解一下梦', '解解梦', '看看梦', '分析梦'] },
  { key: 'zodiac', words: ['星座', '今日运势', '本周运势', '本月运势'] }
];

function detectChatIntent(text) {
  const content = String(text || '');
  for (const rule of CHAT_INTENT_RULES) {
    if (rule.words.some(word => content.includes(word))) return rule.key;
  }
  return null;
}

function cleanChatText(text) {
  return String(text)
    .replace(/\[\[ACTION:[a-z]+\]\]/g, '')
    .replace(/\[\[RESULT:[^\]]*\]\]/g, '')
    .trim();
}

function appendChatAction(container, actionKey) {
  const action = CHAT_ACTION_MAP[actionKey];
  if (!action || !container || container.querySelector('.chat-action')) return;
  const wrap = document.createElement('div');
  wrap.className = 'chat-action';
  const btn = document.createElement('button');
  btn.className = 'chat-action-btn';
  btn.textContent = `${action.icon} 前往${action.label} →`;
  btn.addEventListener('click', () => goTo(action.url));
  wrap.appendChild(btn);
  container.appendChild(wrap);
}

function appendChatBubble(role, text) {
  const messagesEl = document.getElementById('chat-messages');
  if (!messagesEl) return;
  const msg = document.createElement('div');
  msg.className = 'chat-msg ' + (role === 'user' ? 'user' : 'ai');
  msg.innerHTML = `<div class="chat-bubble">${escapeHtml(cleanChatText(text)).replace(/\n/g, '<br>')}</div>`;
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function restoreChat() {
  if (!currentConversationId) return;
  try {
    const data = await ChatAPI.history(currentConversationId);
    if (!data.success) throw new Error(data.error || '会话不存在');
    const messagesEl = document.getElementById('chat-messages');
    messagesEl.innerHTML = '';
    (data.messages || []).forEach(m => appendChatBubble(m.role, m.content));
  } catch (e) {
    console.warn('恢复对话失败:', e.message);
    currentConversationId = null;
    localStorage.removeItem('zhanbu_conversation');
  }
}

function newChat() {
  currentConversationId = null;
  localStorage.removeItem('zhanbu_conversation');
  const messagesEl = document.getElementById('chat-messages');
  if (messagesEl) {
    messagesEl.innerHTML = `<div class="chat-msg ai"><div class="chat-bubble">${CHAT_GREETING}</div></div>`;
  }
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const messagesEl = document.getElementById('chat-messages');
  const sendBtn = document.querySelector('.chat-send-btn');

  const text = input.value.trim();
  if (!text) return;

  appendChatBubble('user', text);
  input.value = '';

  const aiMsg = document.createElement('div');
  aiMsg.className = 'chat-msg ai';
  aiMsg.innerHTML = '<div class="chat-bubble chat-loading">正在思考</div>';
  messagesEl.appendChild(aiMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  sendBtn.disabled = true;

  try {
    let aiReply = '';
    let frameRequested = false;
    const bubble = aiMsg.querySelector('.chat-bubble');
    bubble.className = 'chat-bubble';

    const doRender = () => {
      bubble.innerHTML = escapeHtml(cleanChatText(aiReply)).replace(/\n/g, '<br>');
      frameRequested = false;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    await streamChat(text, currentConversationId, CHAT_SYSTEM, (fullText) => {
      aiReply = fullText;
      if (!frameRequested) {
        frameRequested = true;
        requestAnimationFrame(doRender);
      }
    }, (response) => {
      const id = response.headers.get('X-Conversation-Id');
      if (id) {
        currentConversationId = Number(id);
        localStorage.setItem('zhanbu_conversation', id);
      }
    });

    if (frameRequested) doRender();
    appendChatAction(bubble, parseChatAction(aiReply) || detectChatIntent(text));
  } catch (error) {
    aiMsg.querySelector('.chat-bubble').innerHTML = '抱歉，连接失败了：' + escapeHtml(error.message);
    aiMsg.querySelector('.chat-bubble').style.color = '#ef4444';
  }

  sendBtn.disabled = false;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

/* ---------- 免责声明 ---------- */
function injectDisclaimer() {
  if (/admin\.html$/.test(location.pathname)) return;
  if (document.querySelector('.app-disclaimer')) return;

  const el = document.createElement('div');
  el.className = 'app-disclaimer';
  el.textContent = '⚠️ 免责声明：本平台所有命理、星座、塔罗、解梦内容均由 AI 生成，仅供娱乐与自我探索参考，请理性看待，勿作为医疗、法律、投资或人生决策依据。';

  const nav = document.querySelector('.bottom-nav');
  if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav);
  else document.body.appendChild(el);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectDisclaimer);
} else {
  injectDisclaimer();
}
