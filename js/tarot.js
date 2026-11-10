/* ========== 塔罗牌：78 张牌库 + 三种牌阵 ========== */

let currentSpreadKey = 'three';
let currentSpread = TAROT_SPREADS.three;
let shuffledDeck = [];
let drawIndex = 0;
let flippedCount = 0;
let selectedCards = [];

function initTarot() {
  createStars('stars-tarot');
  renderSpreadSelector();
  resetTarot();
}

function renderSpreadSelector() {
  const el = document.getElementById('spread-selector');
  if (!el) return;
  el.innerHTML = Object.entries(TAROT_SPREADS).map(([key, s]) => `
    <button class="spread-option ${key === currentSpreadKey ? 'active' : ''}"
            data-key="${key}" onclick="selectSpread('${key}')">
      ${s.name}<small>${s.desc}</small>
    </button>`).join('');
}

function cryptoRandomInt(max) {
  if (window.crypto && window.crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffleDeck() {
  const deck = tarotDeck.map(c => ({
    ...c,
    isReversed: cryptoRandomInt(2) === 1
  }));
  // Fisher-Yates 洗牌，保证每张牌等概率
  for (let i = deck.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function selectSpread(key) {
  if (!TAROT_SPREADS[key]) return;
  currentSpreadKey = key;
  currentSpread = TAROT_SPREADS[key];
  renderSpreadSelector();
  resetTarot();
}

function resetTarot() {
  shuffledDeck = shuffleDeck();
  drawIndex = 0;
  flippedCount = 0;
  selectedCards = [];

  const result = document.getElementById('tarot-result');
  if (result) result.classList.remove('show');

  document.getElementById('spread-title').textContent = `✦ ${currentSpread.name} ✦`;
  const positions = currentSpread.positions;
  const row = document.getElementById('tarot-cards');
  row.className = 'cards-row' + (positions.length > 3 ? ' many' : '');
  row.innerHTML = positions.map((pos, i) => `
    <div class="card-position">
      <div class="card-position-label">${pos}</div>
      <div class="tarot-card ${i > 0 ? 'disabled' : ''}" id="card-${i}" onclick="flipCard(${i})">
        <div class="tarot-card-inner">
          <div class="tarot-card-back"><span class="back-pattern">✦</span><span class="back-text">点击翻开</span></div>
          <div class="tarot-card-front">
            <span class="card-icon"></span>
            <span class="card-name"></span>
            <span class="card-orientation"></span>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function flipCard(index) {
  if (flippedCount !== index) return;
  const cardEl = document.getElementById('card-' + index);
  if (!cardEl || cardEl.classList.contains('flipped')) return;
  if (drawIndex >= shuffledDeck.length) return;

  const card = shuffledDeck[drawIndex++];
  cardEl.querySelector('.card-icon').textContent = card.icon;
  cardEl.querySelector('.card-name').textContent = card.name;
  cardEl.querySelector('.card-orientation').textContent = card.isReversed ? '逆位' : '正位';
  if (card.isReversed) cardEl.classList.add('reversed');

  cardEl.classList.add('flipped');
  selectedCards.push({ ...card, position: currentSpread.positions[index] });
  flippedCount++;

  const total = currentSpread.positions.length;
  if (flippedCount < total) {
    document.getElementById('card-' + flippedCount).classList.remove('disabled');
  } else {
    setTimeout(showReading, 800);
  }
}

async function showReading() {
  const result = document.getElementById('tarot-result');
  const resultText = document.getElementById('result-text');
  const resultDetail = document.getElementById('result-detail');
  const question = document.getElementById('tarot-question')?.value?.trim() || '';

  resultText.innerHTML = '<div class="loading-text">🔮 正在连接塔罗智慧，请稍候...</div>';
  resultDetail.innerHTML = '';
  result.classList.add('show');
  result.scrollIntoView({ behavior: 'smooth' });

  try {
    let pendingText = '';
    let frameRequested = false;
    const readingContainer = document.createElement('div');
    readingContainer.className = 'ai-reading';
    resultText.innerHTML = '';
    resultText.appendChild(readingContainer);

    const doRender = () => {
      readingContainer.innerHTML = renderAIContent(pendingText);
      frameRequested = false;
    };

    const reading = await getLongCatReading(selectedCards, question, (fullText) => {
      pendingText = fullText;
      if (!frameRequested) {
        frameRequested = true;
        requestAnimationFrame(doRender);
      }
    });
    if (frameRequested) doRender();

    if (question) {
      const qEl = document.createElement('div');
      qEl.className = 'tarot-question-display';
      qEl.innerHTML = `<span class="tarot-q-label">❓ 你的问题</span><span class="tarot-q-text">${question}</span>`;
      resultText.appendChild(qEl);
    }

    resultDetail.innerHTML = selectedCards.map(c => {
      const orientation = c.isReversed ? '逆位' : '正位';
      const interpretation = c.isReversed ? c.reversed : c.upright;
      return `
      <div class="result-card-item">
        <div class="result-card-item-header">
          <span class="rc-icon">${c.icon}</span>
          <span class="rc-name">${c.name} (${orientation})</span>
          <span class="rc-pos">${c.position}</span>
        </div>
        <div class="rc-detail-section">
          <span class="rc-section-label">牌面含义</span>
          <p>${c.meaning}</p>
        </div>
        <div class="rc-detail-section">
          <span class="rc-section-label">${orientation}解读</span>
          <p>${interpretation}</p>
        </div>
      </div>`;
    }).join('');

    resultDetail.insertAdjacentHTML('beforeend', `
      <div id="tarot-structured"></div>
      <button class="structured-btn" id="tarot-struct-btn" onclick="showTarotStructured()">✨ 生成解读要点</button>
    `);

    const readingId = await saveTarotReading(question, selectedCards, reading);
    if (readingId && typeof initFollowup === 'function') {
      initFollowup(readingId, {
        system: '你是一位温暖、有共情力的塔罗牌解读师。用户正在追问刚才的塔罗解读，请结合上下文回答，保持自然段落，不要使用 markdown。',
        placeholder: '继续追问这次塔罗解读...'
      });
    }
    if (readingId && typeof Assistant !== 'undefined') {
      const cardText = selectedCards.map(c => `${c.name}${c.isReversed ? '（逆）' : ''}`).join('、');
      Assistant.pushResult({
        type: '塔罗',
        title: '塔罗解读完成',
        summary: `${question ? '问题：' + question + '。' : ''}抽到：${cardText}。${(reading || '').slice(0, 80)}`,
        readingId
      });
    }
  } catch (error) {
    console.warn('AI 解读失败:', error.message);
    renderError(resultText, `大模型连接失败：${error.message}`, 'showReading()');
  }
}

async function saveTarotReading(question, cards, result) {
  try {
    const input = {
      question,
      spread: currentSpread.name,
      cards: cards.map(c => `${c.position}:${c.name}${c.isReversed ? '(逆)' : ''}`)
    };
    const data = await HistoryAPI.save('塔罗', JSON.stringify(input), result);
    return data.reading_id || null;
  } catch (e) {
    console.warn('保存塔罗记录失败:', e.message);
    return null;
  }
}

async function showTarotStructured() {
  const btn = document.getElementById('tarot-struct-btn');
  const box = document.getElementById('tarot-structured');
  if (!btn || !box) return;

  btn.disabled = true;
  btn.textContent = '正在生成要点...';

  try {
    const input = {
      question: document.getElementById('tarot-question')?.value?.trim() || '',
      cards: selectedCards.map(c => ({
        position: c.position,
        name: c.name,
        orientation: c.isReversed ? '逆位' : '正位',
        meaning: c.meaning
      }))
    };
    const res = await requestStructured('tarot', input);

    if (res.success && res.structured) {
      const d = res.data;
      box.innerHTML = `
        <div class="structured-card">
          <h4>🔮 解读要点</h4>
          <p>${escapeHtml(d.summary)}</p>
          <div class="sc-cards">
            ${d.cards.map(c => `
              <div class="sc-card">
                <div class="sc-card-title">${escapeHtml(c.position)} · ${escapeHtml(c.card)}（${escapeHtml(c.orientation)}）</div>
                <p>${escapeHtml(c.interpretation)}</p>
              </div>`).join('')}
          </div>
          <div class="sc-advice">${d.advice.map(a => `<span>${escapeHtml(a)}</span>`).join('')}</div>
        </div>`;
      btn.style.display = 'none';
    } else if (res.success) {
      box.innerHTML = `<div class="structured-card"><h4>🔮 解读要点</h4><p>${escapeHtml(res.raw || '').replace(/\n/g, '<br>')}</p></div>`;
      btn.style.display = 'none';
    } else {
      throw new Error(res.error || '生成失败');
    }
  } catch (e) {
    box.innerHTML = `<div class="structured-card"><p>要点生成失败：${escapeHtml(e.message)}</p></div>`;
    btn.disabled = false;
    btn.textContent = '✨ 重试生成要点';
  }
}

if (document.getElementById('page-tarot')) {
  requireLogin().then(valid => { if (valid) initTarot(); });
}
