/* ========== 全局浮层 AI 助手 ========== */

(function () {
  const CONV_KEY = 'zhanbu_conversation';
  const RESULT_PAGES = {
    '塔罗': 'tarot.html',
    '八字': 'bazi.html',
    '紫微斗数': 'ziwei.html',
    '解梦': 'dream.html',
    '星座': 'zodiac.html'
  };

  let conversationId = Number(localStorage.getItem(CONV_KEY)) || null;
  let currentReadingId = null;
  let busy = false;
  let built = false;

  function isHomePage() {
    const path = location.pathname;
    return path === '/' || /\/index\.html$/.test(path);
  }

  function esc(text) {
    if (typeof escapeHtml === 'function') return escapeHtml(text);
    return String(text).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function setConversation(id) {
    conversationId = id ? Number(id) : null;
    if (conversationId) localStorage.setItem(CONV_KEY, conversationId);
    else localStorage.removeItem(CONV_KEY);
  }

  function chatSystem() {
    return window.CHAT_SYSTEM || '';
  }

  /* ---------- DOM ---------- */
  function build() {
    if (built || isHomePage()) return;
    if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) return;
    built = true;

    const fab = document.createElement('button');
    fab.id = 'assistant-fab';
    fab.setAttribute('aria-label', '打开 AI 观象助手');
    fab.innerHTML = '<span class="assistant-fab-icon">🔮</span>' +
      '<span class="assistant-badge" id="assistant-badge"></span>';
    fab.addEventListener('click', toggle);
    document.body.appendChild(fab);

    const panel = document.createElement('section');
    panel.id = 'assistant-panel';
    panel.innerHTML = `
      <header class="assistant-header">
        <div class="assistant-title">🔮 AI 观象助手</div>
        <div class="assistant-header-actions">
          <button id="assistant-new" title="新对话">＋</button>
          <button id="assistant-close" title="收起">✕</button>
        </div>
      </header>
      <div class="assistant-messages" id="assistant-messages"></div>
      <div class="assistant-quick">
        <button data-url="zodiac.html">⭐ 星座</button>
        <button data-url="tarot.html">🃏 塔罗</button>
        <button data-url="dream.html">🌙 解梦</button>
        <button data-url="bazi.html">☯️ 八字</button>
        <button data-url="ziwei.html">🔮 紫微</button>
      </div>
      <div class="assistant-input-bar">
        <input id="assistant-input" maxlength="500" placeholder="问点什么，或说“我想玩塔罗”...">
        <button id="assistant-send">发送</button>
      </div>`;
    document.body.appendChild(panel);

    document.getElementById('assistant-close').addEventListener('click', close);
    document.getElementById('assistant-new').addEventListener('click', newChat);
    document.getElementById('assistant-send').addEventListener('click', send);
    document.getElementById('assistant-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') send();
    });
    panel.querySelectorAll('.assistant-quick button').forEach(btn => {
      btn.addEventListener('click', () => goTo(btn.dataset.url));
    });

    restore();
  }

  function open() {
    build();
    const panel = document.getElementById('assistant-panel');
    const fab = document.getElementById('assistant-fab');
    if (!panel) return;
    panel.classList.add('show');
    if (fab) fab.classList.add('active');
    hideBadge();
    const input = document.getElementById('assistant-input');
    if (input) setTimeout(() => input.focus(), 120);
  }

  function close() {
    const panel = document.getElementById('assistant-panel');
    const fab = document.getElementById('assistant-fab');
    if (panel) panel.classList.remove('show');
    if (fab) fab.classList.remove('active');
  }

  function toggle() {
    const panel = document.getElementById('assistant-panel');
    if (panel && panel.classList.contains('show')) close();
    else open();
  }

  function showBadge() {
    const badge = document.getElementById('assistant-badge');
    if (badge) badge.classList.add('show');
  }

  function hideBadge() {
    const badge = document.getElementById('assistant-badge');
    if (badge) badge.classList.remove('show');
  }

  /* ---------- 消息渲染 ---------- */
  function parseResultMessage(text) {
    const m = String(text).match(/^\[\[RESULT:([^|\]]+)\|(\d*)\]\]\s*([\s\S]*)$/);
    if (!m) return null;
    return { type: m[1], readingId: m[2] ? Number(m[2]) : null, summary: m[3] };
  }

  function renderResultCard(container, result) {
    container.classList.add('assistant-result');
    container.innerHTML = `
      <div class="assistant-result-head">✅ ${esc(result.type)}解读已完成</div>
      <div class="assistant-result-text">${esc(result.summary)}</div>
      <div class="assistant-result-actions">
        <button data-role="detail">查看详情</button>
        <button class="primary" data-role="continue">继续聊</button>
      </div>`;
    const detailBtn = container.querySelector('[data-role="detail"]');
    const continueBtn = container.querySelector('[data-role="continue"]');
    if (detailBtn) {
      detailBtn.addEventListener('click', () => {
        const url = RESULT_PAGES[result.type];
        if (url) goTo(url);
      });
    }
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        currentReadingId = result.readingId || currentReadingId;
        const input = document.getElementById('assistant-input');
        if (input) input.focus();
      });
    }
  }

  function renderBubble(bubble, text) {
    const result = parseResultMessage(text);
    if (result) {
      renderResultCard(bubble, result);
      return;
    }
    bubble.innerHTML = esc(typeof cleanChatText === 'function'
      ? cleanChatText(text) : text).replace(/\n/g, '<br>');
    if (typeof parseChatAction === 'function' && typeof appendChatAction === 'function') {
      appendChatAction(bubble, parseChatAction(text));
    }
  }

  function scrollToBottom() {
    const box = document.getElementById('assistant-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function appendMessage(role, text, loading) {
    const box = document.getElementById('assistant-messages');
    if (!box) return null;
    const msg = document.createElement('div');
    msg.className = 'assistant-msg ' + role;
    const bubble = document.createElement('div');
    bubble.className = 'assistant-bubble' + (loading ? ' assistant-loading' : '');
    if (loading) bubble.textContent = '正在思考';
    else renderBubble(bubble, text);
    msg.appendChild(bubble);
    box.appendChild(msg);
    scrollToBottom();
    return bubble;
  }

  function greet() {
    appendMessage('ai', '你好，我是 AI 观象助手 🔮 可以问我运势、感情问题，也可以直接说“我想玩塔罗”。');
  }

  /* ---------- 会话恢复 ---------- */
  async function restore() {
    if (!conversationId) { greet(); return; }
    try {
      const data = await ChatAPI.history(conversationId);
      if (!data.success) throw new Error(data.error || '会话不存在');
      const box = document.getElementById('assistant-messages');
      box.innerHTML = '';
      const messages = data.messages || [];
      messages.forEach(m => appendMessage(m.role, m.content));
      if (data.conversation && data.conversation.context_id) {
        currentReadingId = Number(data.conversation.context_id) || null;
      }
      if (!messages.length) greet();
    } catch (e) {
      setConversation(null);
      greet();
    }
  }

  function newChat() {
    setConversation(null);
    currentReadingId = null;
    const box = document.getElementById('assistant-messages');
    if (box) box.innerHTML = '';
    greet();
  }

  /* ---------- 发送 ---------- */
  async function send() {
    if (busy) return;
    const input = document.getElementById('assistant-input');
    const text = (input.value || '').trim();
    if (!text) return;
    if (typeof Auth === 'undefined' || !Auth.isLoggedIn()) {
      goTo('auth.html');
      return;
    }

    input.value = '';
    busy = true;
    const sendBtn = document.getElementById('assistant-send');
    if (sendBtn) sendBtn.disabled = true;

    appendMessage('user', text);
    const bubble = appendMessage('ai', '', true);

    try {
      let pending = '';
      let frameRequested = false;
      const render = () => {
        frameRequested = false;
        renderBubble(bubble, pending);
        scrollToBottom();
      };

      await streamChat(text, conversationId, chatSystem(), (fullText) => {
        pending = fullText;
        if (!frameRequested) {
          frameRequested = true;
          requestAnimationFrame(render);
        }
      }, (response) => {
        const id = response.headers.get('X-Conversation-Id');
        if (id) setConversation(id);
      }, currentReadingId ? { reading_id: currentReadingId } : {});

      if (frameRequested) render();
      bubble.classList.remove('assistant-loading');
      if (typeof appendChatAction === 'function') {
        const fallback = typeof detectChatIntent === 'function' ? detectChatIntent(text) : null;
        appendChatAction(bubble, parseChatAction(pending) || fallback);
      }
    } catch (e) {
      bubble.classList.remove('assistant-loading');
      bubble.textContent = '连接失败：' + e.message;
      bubble.classList.add('assistant-error');
    }

    busy = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }

  /* ---------- 功能结果回流 ---------- */
  function pushResult(info) {
    if (!info || typeof Auth === 'undefined' || !Auth.isLoggedIn()) return;
    const type = info.type || '解读';
    const summary = info.summary || '';
    const readingId = info.readingId || null;
    const content = `[[RESULT:${type}|${readingId || ''}]]${summary}`;

    apiRequest('/chat/inject', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        context_type: type,
        reading_id: readingId,
        title: info.title || `${type}解读`,
        content
      })
    }).then(res => res.json()).then(data => {
      if (data.success && data.conversation_id) setConversation(data.conversation_id);
      if (readingId) currentReadingId = Number(readingId);
    }).catch(e => console.warn('结果回流失败:', e.message));

    if (!built) return;
    appendMessage('ai', content);
    const panel = document.getElementById('assistant-panel');
    if (!panel || !panel.classList.contains('show')) showBadge();
  }

  window.Assistant = {
    open,
    close,
    toggle,
    pushResult,
    send,
    newChat
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
