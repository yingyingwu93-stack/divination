const tarotDeck = [
  { icon:'🌅', name:'愚者', meaning:'愚者代表新的起点、无限的可能性与纯真的精神。', upright:'新的开始即将来临，保持纯真和开放的心态，勇敢迈出第一步。不要害怕犯错，每一次尝试都是成长。此刻的你拥有无限可能，不要被过去的经验所束缚。', reversed:'你可能正在做出鲁莽的决定，提醒你要脚踏实地，不要过于理想化。' },
  { icon:'⚡', name:'魔术师', meaning:'魔术师代表创造力、意志力和实现目标的能力。', upright:'你拥有实现目标所需的能力和资源，现在是行动的好时机。适合开始新项目或学习新技能。', reversed:'你可能没有充分发挥自己的才能，或者有人在欺骗你。审视自己的动机和方法。' },
  { icon:'🌙', name:'女祭司', meaning:'女祭司代表直觉、神秘与内在的智慧。', upright:'相信你的直觉，它们正在引导你走向正确的方向。适合冥想、内省和精神追求。', reversed:'你可能忽略了内心的声音，提醒你深入探索真相，不要只看表面。' },
  { icon:'👑', name:'女皇', meaning:'女皇代表丰收、母性、创造与丰饶。', upright:'财运和感情运势都非常好，创造力旺盛，适合进行艺术创作。感情甜蜜温馨。', reversed:'你可能感到创造力受阻，或者过度依赖他人。找回自己的独立性。' },
  { icon:'💕', name:'恋人', meaning:'恋人牌代表爱情、和谐与选择。', upright:'感情运势极佳，单身者可能遇到灵魂伴侣。也是一个需要做出重要选择的时期。', reversed:'感情中可能出现不和谐，价值观冲突导致关系紧张。审视自己的真实需求。' },
  { icon:'💀', name:'死神', meaning:'死神代表结束、转变与新生。很少代表真正的死亡。', upright:'一个重要阶段即将结束，新的阶段即将开始。放下过去，为新的机会腾出空间。', reversed:'你可能在抗拒必要的改变，提醒你放下不再服务于你的东西。' },
  { icon:'⭐', name:'星星', meaning:'星星代表希望、灵感与疗愈。', upright:'希望正在照亮你的道路，灵感和创造力正在涌现。这是疗愈和恢复的时期。', reversed:'你可能感到失去信心，提醒你重新连接内心的光芒，希望从未消失。' },
  { icon:'☀️', name:'太阳', meaning:'太阳代表成功、快乐与活力。', upright:'最美好的时期之一，成功、快乐和活力正在围绕你。一切都在顺利进行。', reversed:'你可能经历暂时的挫折，但这是短暂的。阳光总在风雨后。' },
  { icon:'🌍', name:'世界', meaning:'世界代表完成、整合与成就。', upright:'一个重要目标即将完成，你付出的努力将得到回报。这是庆祝成就的时刻。', reversed:'你可能感到某个方面还未完成，审视是否有未完成的事情需要处理。' },
  { icon:'🗼', name:'塔', meaning:'塔代表突变、崩塌与启示。', upright:'突然的变化可能打乱计划，但这是必要的。旧有结构需要崩塌才能建立更好的。', reversed:'你可能在延迟不可避免的变化，主动面对变化比被动接受要好。' },
  { icon:'🎡', name:'命运之轮', meaning:'命运之轮代表转变、机遇与命运的循环。', upright:'命运正在转向你，可能迎来意想不到的好运或变化。把握当前的机会。', reversed:'你可能正在经历一段困难时期，提醒你接受变化是生活的常态。' },
  { icon:'😈', name:'恶魔', meaning:'恶魔代表束缚、诱惑、物质与阴暗面。', upright:'你可能被某些事物所束缚，提醒你审视自己的依赖，勇敢地打破枷锁。', reversed:'你正在摆脱某种束缚或限制，走向觉醒和自由。' },
  { icon:'🏔️', name:'隐士', meaning:'隐士代表内省、寻求与智慧。', upright:'这是一个需要独处和内省的时期，远离喧嚣，倾听内心的声音。', reversed:'你可能过于孤立自己，提醒你在内省和社交之间找到平衡。' },
  { icon:'🙃', name:'倒吊人', meaning:'倒吊人代表牺牲、等待与新的视角。', upright:'这是一个需要耐心等待的时期，不要急于行动。从不同的角度看问题。', reversed:'你可能在不值得的事情上浪费时间和精力，是时候结束等待了。' },
  { icon:'⚖️', name:'正义', meaning:'正义代表公平、真相、因果与平衡。', upright:'公平和正义将得到伸张，你的努力会得到应有的回报。做正确的事。', reversed:'你可能遭遇了不公平的待遇，提醒你审视自己的行为。' },
  { icon:'🏺', name:'节制', meaning:'节制代表平衡、耐心、调和与融合。', upright:'你正在找到生活的平衡，保持耐心，好事需要时间。', reversed:'你可能感到生活失去了平衡，提醒你重新审视自己的优先级。' },
  { icon:'🌕', name:'月亮', meaning:'月亮代表幻觉、直觉、潜意识与未知。', upright:'有些事情可能不像表面看起来那样，需要深入探索真相。相信你的直觉。', reversed:'你可能被恐惧或欺骗所困扰，提醒你面对真相。' },
  { icon:'📯', name:'审判', meaning:'审判代表觉醒、重生与召唤。', upright:'一个重要的觉醒正在发生，这是重新开始的机会。听从内心的召唤。', reversed:'你可能对自己过于苛责，提醒你放下对自己的批判。' },
  { icon:'🏎️', name:'战车', meaning:'战车代表胜利、意志、决心与前进的动力。', upright:'你即将取得重要的胜利，你的决心和自律正在带领你前进。', reversed:'你可能感到失控，提醒你检查自己的目标和方法。' },
  { icon:'💪', name:'力量', meaning:'力量代表勇气、耐心、内在的力量与以柔克刚的智慧。', upright:'你拥有克服任何困难的内在力量，用温柔和耐心来解决问题。', reversed:'你可能对自己的能力产生怀疑，提醒你重新连接内心的力量。' },
  { icon:'🦁', name:'皇帝', meaning:'皇帝代表权威、结构、领导与稳定。', upright:'你的事业和地位正在稳步提升，可能获得升职或承担更多责任。', reversed:'你可能感到被权威所压制，提醒你审视自己对他人的控制欲。' },
  { icon:'⛪', name:'教皇', meaning:'教皇代表传统、信仰、指导与精神智慧。', upright:'你可能会遇到一位重要的导师或贵人，他们的指导将帮助你突破困境。', reversed:'你可能正在质疑传统的规则，渴望走出自己的路。' }
];

const positionMeanings = ['过去的影响', '当前的状况', '未来的指引'];
let flippedCount = 0;
let selectedCards = [];

function initTarot() { createStars('stars-tarot'); resetTarot(); }

function flipCard(index) {
  if (flippedCount !== index) return;
  const card = document.getElementById('card-' + index);
  if (card.classList.contains('flipped')) return;

  const deckIndex = Math.floor(Math.random() * tarotDeck.length);
  const cardData = tarotDeck[deckIndex];
  const isReversed = Math.random() < 0.3;

  card.querySelector('.card-icon').textContent = cardData.icon;
  card.querySelector('.card-name').textContent = cardData.name;
  card.querySelector('.card-orientation').textContent = isReversed ? '逆位' : '正位';
  if (isReversed) card.classList.add('reversed');

  card.classList.add('flipped');
  selectedCards.push({ ...cardData, isReversed });
  flippedCount++;

  if (flippedCount < 3) document.getElementById('card-' + flippedCount).classList.remove('disabled');
  if (flippedCount === 3) setTimeout(showReading, 800);
}

async function showReading() {
  const result = document.getElementById('tarot-result');
  const resultText = document.getElementById('result-text');
  const resultDetail = document.getElementById('result-detail');

  const question = document.getElementById('tarot-question')?.value?.trim() || '';

  resultText.innerHTML = '<div class="loading-text">🔮 正在连接塔罗智慧，请稍候...</div>';
  resultDetail.innerHTML = '';
  result.classList.add('show');

  try {
    // 流式渲染：requestAnimationFrame + textContent，零跳动
    let pendingText = '';
    let frameRequested = false;
    const readingContainer = document.createElement('div');
    readingContainer.className = 'ai-reading';
    resultText.innerHTML = '';
    resultText.appendChild(readingContainer);

    const formatBr = text => text.replace(/\n/g, '<br>');
    const doRender = () => {
      readingContainer.innerHTML = formatBr(pendingText);
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

    // 显示问题
    if (question) {
      const qEl = document.createElement('div');
      qEl.className = 'tarot-question-display';
      qEl.innerHTML = `<span class="tarot-q-label">❓ 你的问题</span><span class="tarot-q-text">${question}</span>`;
      resultText.appendChild(qEl);
    }

    resultDetail.innerHTML = selectedCards.map((c, i) => {
      const orientation = c.isReversed ? '逆位' : '正位';
      const interpretation = c.isReversed ? c.reversed : c.upright;
      return `
      <div class="result-card-item">
        <div class="result-card-item-header">
          <span class="rc-icon">${c.icon}</span>
          <span class="rc-name">${c.name} (${orientation})</span>
          <span class="rc-pos">${positionMeanings[i]}</span>
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

    // 保存到历史记录
    await saveTarotReading(question, selectedCards, reading);
  } catch (error) {
    console.warn('AI 解读失败:', error.message);
    renderError(resultText, `大模型连接失败：${error.message}`, 'showReading()');
  }
}

function resetTarot() {
  flippedCount = 0;
  selectedCards = [];
  for (let i = 0; i < 3; i++) {
    const card = document.getElementById('card-' + i);
    card.classList.remove('flipped', 'reversed');
    card.querySelector('.card-icon').textContent = '';
    card.querySelector('.card-name').textContent = '';
    card.querySelector('.card-orientation').textContent = '';
    if (i > 0) card.classList.add('disabled');
  }
  document.getElementById('tarot-result').classList.remove('show');
}

if (document.getElementById('page-tarot')) {
  requireLogin().then(valid => { if (valid) initTarot(); });
}

// 塔罗解读完成后保存到历史
async function saveTarotReading(question, cards, result) {
  try {
    const input = JSON.stringify({ question, cards: cards.map(c => c.name + (c.isReversed ? '(逆)' : '')) });
    await HistoryAPI.save('塔罗', input, result);
  } catch (e) {
    console.warn('保存塔罗记录失败:', e.message);
  }
}
