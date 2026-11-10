/* ========== 统一 AI 输出渲染（轻量 Markdown） ========== */

(function () {
  function esc(text) {
    return String(text).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  /** 行内样式：粗体、斜体 */
  function inline(text) {
    let html = esc(text);
    html = html
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="ai-strong">$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    return html;
  }

  /**
   * 渲染 AI 输出文本为带样式的 HTML
   * 支持：## 标题、**粗体**、*斜体*、- 列表、1. 有序列表、--- 分隔线、> 引用
   */
  function renderAIContent(text) {
    if (!text) return '';

    const blocks = String(text).split(/\n{2,}/);

    return blocks.map(block => {
      const lines = block.split('\n').map(l => l.trimEnd());

      // 单行：标题 / 分隔线 / 引用
      if (lines.length === 1) {
        const line = lines[0].trim();
        if (line.startsWith('### ')) return `<h4 class="ai-h4">${inline(line.slice(4))}</h4>`;
        if (line.startsWith('## ')) return `<h3 class="ai-h3">${inline(line.slice(3))}</h3>`;
        if (line.startsWith('# ')) return `<h2 class="ai-h2">${inline(line.slice(2))}</h2>`;
        if (/^---+$/.test(line)) return '<hr class="ai-hr">';
        if (line.startsWith('> ')) return `<blockquote class="ai-quote">${inline(line.slice(2))}</blockquote>`;
      }

      // 无序列表
      if (lines.every(l => l.trim().startsWith('- ') || !l.trim())) {
        const items = lines.filter(l => l.trim())
          .map(l => `<li>${inline(l.trim().slice(2))}</li>`).join('');
        if (items) return `<ul class="ai-ul">${items}</ul>`;
      }

      // 有序列表
      if (lines.every(l => /^\d+\. /.test(l.trim()) || !l.trim())) {
        const items = lines.filter(l => l.trim())
          .map(l => `<li>${inline(l.trim().replace(/^\d+\. /, ''))}</li>`).join('');
        if (items) return `<ol class="ai-ol">${items}</ol>`;
      }

      // 普通段落
      const content = lines.map(l => inline(l)).join('<br>');
      return `<p class="ai-p">${content}</p>`;
    }).join('');
  }

  window.renderAIContent = renderAIContent;
})();
