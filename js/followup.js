/* ========== 解读结果「继续追问」组件 ========== */

(function() {
  let state = {
    readingId: null,
    conversationId: null,
    system: '',
    busy: false
  };

  function esc(text) {
    if (typeof escapeHtml === 'function') return escapeHtml(text);
    return String(text).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function initFollowup(readingId, options = {}) {
    const root = document.getElementById('followup-root');
    if (!root) return;

    if (!readingId) {
      root.innerHTML = '';
      return;
    }

    state = {
      readingId,
      conversationId: null,
      system: options.system || '',
      busy: false
    };

    root.innerHTML = `
      <div class="followup">
        <button class="followup-toggle" id="followup-toggle" onclick="toggleFollowup()">💬 继续追问</button>
        <div class="followup-panel" id="followup-panel">
          <div class="followup-messages" id="followup-messages">
            <div class="followup-hint">可以继续追问这次解读的细节，AI 会结合上面的结果回答。</div>
          </div>
          <div class="followup-input-bar">
            <input id="followup-input" maxlength="500"
                   placeholder="${esc(options.placeholder || '继续问点什么...')}"
                   onkeydown="if(event.key==='Enter')sendFollowup()">
            <button id="followup-send" onclick="sendFollowup()">发送</button>
          </div>
        </div>
      </div>`;
  }

  function toggleFollowup() {
    const panel = document.getElementById('followup-panel');
    if (!panel) return;
    const show = !panel.classList.contains('show');
    panel.classList.toggle('show', show);
    if (show) {
      const input = document.getElementById('followup-input');
      if (input) input.focus();
    }
  }

  function appendBubble(role, text, loading = false) {
    const container = document.getElementById('followup-messages');
    if (!container) return null;
    const msg = document.createElement('div');
    msg.className = 'followup-msg ' + role;
    msg.innerHTML = `<div class="followup-bubble${loading ? ' followup-loading' : ''}">${
      loading ? '正在思考' : esc(text).replace(/\n/g, '<br>')
    }</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  async function sendFollowup() {
    if (state.busy || !state.readingId) return;

    const input = document.getElementById('followup-input');
    const sendBtn = document.getElementById('followup-send');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    state.busy = true;
    if (sendBtn) sendBtn.disabled = true;

    appendBubble('user', text);
    const aiMsg = appendBubble('ai', '', true);
    const bubble = aiMsg.querySelector('.followup-bubble');

    try {
      let pending = '';
      let frameRequested = false;
      const doRender = () => {
        bubble.innerHTML = esc(pending).replace(/\n/g, '<br>');
        frameRequested = false;
        const container = document.getElementById('followup-messages');
        if (container) container.scrollTop = container.scrollHeight;
      };

      await streamChat(
        text,
        state.conversationId,
        state.system,
        (fullText) => {
          pending = fullText;
          if (!frameRequested) {
            frameRequested = true;
            requestAnimationFrame(doRender);
          }
        },
        (response) => {
          const id = response.headers.get('X-Conversation-Id');
          if (id) state.conversationId = Number(id);
        },
        { reading_id: state.readingId }
      );

      if (frameRequested) doRender();
      bubble.classList.remove('followup-loading');
    } catch (error) {
      bubble.classList.remove('followup-loading');
      bubble.textContent = '追问失败：' + error.message;
      bubble.style.color = '#ef4444';
    }

    state.busy = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }

  window.initFollowup = initFollowup;
  window.toggleFollowup = toggleFollowup;
  window.sendFollowup = sendFollowup;
})();
