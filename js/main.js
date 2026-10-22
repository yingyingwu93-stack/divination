function goTo(url) { window.location.href = url; }
function goBack() { if (window.history.length > 1) { window.history.back(); } else { window.location.href = 'index.html'; } }

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
      <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px;line-height:1.6;">${message}</p>
      <button onclick="${retryFn}" style="padding:10px 28px;border-radius:20px;background:linear-gradient(135deg,var(--primary),var(--primary-light));color:white;border:none;font-size:14px;cursor:pointer;">
        🔄 重试
      </button>
    </div>`;
}

// 更新底部导航的用户状态
function updateNavUserState() {
  const user = Auth.getUser();
  const navBazi = document.querySelector('.nav-item[onclick*="bazi.html"]');
  if (navBazi && user) {
    navBazi.innerHTML = '<span class="nav-icon">👤</span><span>' + user.username + '</span>';
    navBazi.onclick = null;
    navBazi.addEventListener('click', () => {
      if (confirm('确定要退出登录吗？')) {
        UserAPI.logout();
      }
    });
  }
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
  if (containerId === 'stars-home' || containerId === 'stars-zodiac' || containerId === 'stars-tarot' || containerId === 'stars-bazi') {
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

function renderZodiacScroll() {
  const container = document.getElementById('zodiac-scroll');
  if (!container) return;
  container.innerHTML = zodiacSigns.map(z => `
    <div class="zodiac-item" onclick="goTo('zodiac.html')">
      <div class="z-icon">${z.icon}</div>
      <div class="z-name">${z.name}</div>
      <div class="z-date">${z.date}</div>
      <div class="z-score"><span>${75 + Math.floor(Math.random() * 20)}</span>分</div>
    </div>
  `).join('');
}

function renderHomeArticles() {
  const container = document.getElementById('home-articles');
  if (!container) return;
  container.innerHTML = dreamData.slice(0, 3).map(d => `
    <div class="dream-item" onclick="this.classList.toggle('open')">
      <div class="dream-item-header">
        <span class="d-icon">${d.icon}</span>
        <span class="d-title">${d.title}</span>
        <span class="d-arrow">▼</span>
      </div>
      <div class="dream-item-body"><p>${d.content}</p></div>
    </div>
  `).join('');
}

let activeCategory = '全部';
function renderCategories() {
  const container = document.getElementById('cat-tags');
  if (!container) return;
  container.innerHTML = dreamCategories.map(c => `
    <span class="cat-tag ${c === activeCategory ? 'active' : ''}" onclick="selectCategory('${c}')">${c}</span>
  `).join('');
}
function selectCategory(cat) { activeCategory = cat; renderCategories(); renderDreamList(); }

function renderDreamList(filter) {
  const container = document.getElementById('dream-list');
  if (!container) return;
  let data = dreamData;
  if (activeCategory !== '全部') data = data.filter(d => d.cat === activeCategory);
  if (filter) data = data.filter(d => d.title.includes(filter) || d.content.includes(filter));
  if (data.length === 0) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">暂无相关梦境解读</div>'; return; }
  container.innerHTML = data.map(d => `
    <div class="dream-item" onclick="this.classList.toggle('open')">
      <div class="dream-item-header">
        <span class="d-icon">${d.icon}</span>
        <span class="d-title">${d.title}</span>
        <span class="d-arrow">▼</span>
      </div>
      <div class="dream-item-body"><p>${d.content}</p></div>
    </div>
  `).join('');
}
function filterDreams() {
  const keyword = document.getElementById('dream-search').value.trim();
  renderDreamList(keyword);
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

function analyzeZodiac() {
  const dateStr = document.getElementById('birth-date').value;
  if (!dateStr) return alert('请选择出生日期');
  const zodiac = getZodiacByDate(dateStr);
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
  document.getElementById('tab-fortune').innerHTML = `<div class="fortune-card"><h4>🌟 综合运势</h4><p>${fortune.fortune.desc}</p></div>`;
  document.getElementById('tab-love').innerHTML = `<div class="fortune-card"><h4>💕 桃花运势</h4><p>${fortune.love.desc}</p></div>`;
  document.getElementById('tab-career').innerHTML = `<div class="fortune-card"><h4>💼 事业运势</h4><p>${fortune.career.desc}</p></div>`;
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

function initZodiacPage() { createStars('stars-zodiac'); initTabs(); analyzeZodiac(); }

if (document.getElementById('page-home')) {
  createStars('stars-home');
  renderZodiacScroll();
  renderHomeArticles();
  requireLogin().then(valid => {
    if (valid) updateNavUserState();
  });
}
if (document.getElementById('page-dream')) { createStars('stars-dream'); }

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
const CHAT_SYSTEM = `你是一位温暖、有共情力的 AI 占卜助手。你的职责是帮助用户解答关于感情、运势、人际关系等方面的困惑。

要求：
1. 始终保持积极、正向的引导，给用户希望和力量
2. 语言温暖自然，像朋友在聊天，不要像机器人在念稿
3. 回答要有实用性，给出具体的建议和方法
4. 不要使用 markdown 格式（不用 **粗体** 等），用自然段落
5. 每次回答控制在 200-400 字，简洁有力
6. 用空行分段，结构清晰
7. 如果用户问的问题涉及占卜，可以结合星座、塔罗、八字等知识来回答`;

let chatHistory = [];

async function sendChat() {
  const input = document.getElementById('chat-input');
  const messagesEl = document.getElementById('chat-messages');
  const sendBtn = document.querySelector('.chat-send-btn');

  const text = input.value.trim();
  if (!text) return;

  // 添加用户消息
  const userMsg = document.createElement('div');
  userMsg.className = 'chat-msg user';
  userMsg.innerHTML = `<div class="chat-bubble">${text}</div>`;
  messagesEl.appendChild(userMsg);
  input.value = '';

  // 滚动到底部
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // 添加 AI 加载动画
  const aiMsg = document.createElement('div');
  aiMsg.className = 'chat-msg ai';
  aiMsg.innerHTML = `<div class="chat-bubble chat-loading">正在思考</div>`;
  messagesEl.appendChild(aiMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  sendBtn.disabled = true;

  try {
    chatHistory.push({ role: 'user', content: text });

    const messages = [
      { role: 'system', content: CHAT_SYSTEM },
      ...chatHistory.slice(-10)
    ];

    let aiReply = '';
    let frameRequested = false;
    const bubble = aiMsg.querySelector('.chat-bubble');
    bubble.className = 'chat-bubble';

    const doRender = () => {
      bubble.innerHTML = aiReply.replace(/\n/g, '<br>');
      frameRequested = false;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const fullReply = await streamAI(messages, 800, (fullText) => {
      aiReply = fullText;
      if (!frameRequested) {
        frameRequested = true;
        requestAnimationFrame(doRender);
      }
    });

    if (frameRequested) doRender();
    chatHistory.push({ role: 'assistant', content: fullReply });

    // 保存聊天记录
    try {
      await HistoryAPI.save('聊天', text, fullReply);
    } catch (e) {
      console.warn('保存聊天记录失败:', e.message);
    }

  } catch (error) {
    aiMsg.querySelector('.chat-bubble').innerHTML = '抱歉，连接失败了：' + error.message;
    aiMsg.querySelector('.chat-bubble').style.color = '#ef4444';
  }

  sendBtn.disabled = false;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
