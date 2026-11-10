/* ========== 紫微斗数排盘（iztro 前端引擎 + 后端 AI 解读） ========== */

// iztro timeIndex 0-12 对应十二时辰
const ZIWEI_HOURS = [
  { label: '早子时(00:00-01:00)', index: 0 },
  { label: '丑时(01:00-03:00)', index: 1 },
  { label: '寅时(03:00-05:00)', index: 2 },
  { label: '卯时(05:00-07:00)', index: 3 },
  { label: '辰时(07:00-09:00)', index: 4 },
  { label: '巳时(09:00-11:00)', index: 5 },
  { label: '午时(11:00-13:00)', index: 6 },
  { label: '未时(13:00-15:00)', index: 7 },
  { label: '申时(15:00-17:00)', index: 8 },
  { label: '酉时(17:00-19:00)', index: 9 },
  { label: '戌时(19:00-21:00)', index: 10 },
  { label: '亥时(21:00-23:00)', index: 11 },
  { label: '晚子时(23:00-24:00)', index: 12 }
];

// 十二地支在 4x4 命盘中的固定位置（grid-area: row / col）
const BRANCH_POS = {
  '巳': '1/1', '午': '1/2', '未': '1/3', '申': '1/4',
  '辰': '2/1', '酉': '2/4',
  '卯': '3/1', '戌': '3/4',
  '寅': '4/1', '丑': '4/2', '子': '4/3', '亥': '4/4'
};

// 三方四正：本宫 + 对宫（+6）+ 三合两宫（+4 / +8）
const TRINE_OFFSETS = [0, 4, 8];
const OPPOSITE_OFFSET = 6;

function initZiwei() {
  createStars('stars-ziwei');
  fillZiweiForm();
}

function fillZiweiForm() {
  document.getElementById('ziwei-year').value = 1995;
  document.getElementById('ziwei-month').value = 6;
  document.getElementById('ziwei-day').value = 15;

  // 有保存过的出生日期时自动回填
  const saved = localStorage.getItem('zhanbu_birth_date') ||
    (Auth.getUser() && Auth.getUser().birth_date) || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(saved)) {
    const [y, m, d] = saved.split('-').map(Number);
    document.getElementById('ziwei-year').value = y;
    document.getElementById('ziwei-month').value = m;
    document.getElementById('ziwei-day').value = d;
  }

  const hourSel = document.getElementById('ziwei-hour');
  hourSel.innerHTML = ZIWEI_HOURS.map(h =>
    `<option value="${h.index}" ${h.index === 6 ? 'selected' : ''}>${h.label}</option>`
  ).join('');
}

// 校验 iztro 是否加载成功
function ensureIztro() {
  if (typeof iztro === 'undefined' || !iztro.astro) {
    throw new Error('排盘引擎未加载，请检查 js/iztro.min.js 是否存在');
  }
}

async function calculateZiwei() {
  const payload = {
    year: parseInt(document.getElementById('ziwei-year').value),
    month: parseInt(document.getElementById('ziwei-month').value),
    day: parseInt(document.getElementById('ziwei-day').value),
    timeIndex: parseInt(document.getElementById('ziwei-hour').value),
    gender: document.getElementById('ziwei-gender').value,
    fixLeap: document.getElementById('ziwei-fixleap').checked
  };

  if (!payload.year || !payload.month || !payload.day) {
    alert('请填写完整的出生日期');
    return;
  }
  // 日期合法性校验（防止 iztro 崩溃）
  if (payload.year < 1900 || payload.year > 2100) {
    alert('年份需在 1900-2100 之间');
    return;
  }
  if (payload.month < 1 || payload.month > 12) {
    alert('月份需在 1-12 之间');
    return;
  }
  const daysInMonth = new Date(payload.year, payload.month, 0).getDate();
  if (payload.day < 1 || payload.day > daysInMonth) {
    alert(`${payload.year} 年 ${payload.month} 月只有 ${daysInMonth} 天，请检查日期`);
    return;
  }

  const btn = document.querySelector('.bazi-start-btn');
  btn.disabled = true;
  btn.textContent = '🔮 正在排盘...';

  try {
    ensureIztro();

    // 公历字符串：iztro 接受 YYYY-M-D
    const solarStr = `${payload.year}-${payload.month}-${payload.day}`;
    const astrolabe = iztro.astro.bySolar(
      solarStr, payload.timeIndex, payload.gender, payload.fixLeap, 'zh-CN'
    );

    if (!astrolabe || !astrolabe.palaces) {
      throw new Error('排盘结果为空，请检查出生信息');
    }

    renderZiwei(astrolabe, payload);

    const resultEl = document.getElementById('ziwei-result');
    resultEl.classList.add('show');
    resultEl.scrollIntoView({ behavior: 'smooth' });

    const birthDate = `${payload.year}-${String(payload.month).padStart(2, '0')}-${String(payload.day).padStart(2, '0')}`;
    await saveBirthDate(birthDate);

    runZiweiAI(astrolabe, payload)
      .then(text => saveZiweiReading(astrolabe, payload, text).then(readingId => ({ text, readingId })))
      .then(({ text, readingId }) => {
        if (readingId && typeof initFollowup === 'function') {
          initFollowup(readingId, {
            system: '你是一位精通紫微斗数的命理师。用户正在追问刚才的命盘解读，请结合命宫主星、三方四正、四化飞星等上下文回答，语言通俗易懂，不要使用 markdown。',
            placeholder: '继续追问这次命盘解读...'
          });
        }
        if (readingId && typeof Assistant !== 'undefined') {
          const soul = findSoulPalace(astrolabe);
          const stars = (soul.majorStars || []).map(s => s.name).join('、') || '空宫';
          Assistant.pushResult({
            type: '紫微斗数',
            title: '紫微排盘完成',
            summary: `命宫主星：${stars}。${(text || '').slice(0, 60)}`,
            readingId
          });
        }
      });
  } catch (error) {
    alert('排盘失败：' + error.message);
    console.error('紫微排盘错误:', error);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔮 开始排盘';
  }
}

/* ---------- 宫位工具 ---------- */

// iztro 2.6.x：palaces 按地支顺序排列，soulIndex/bodyIndex 已废弃（为 null）
// 命宫用 earthlyBranchOfSoulPalace 匹配，身宫用 isBodyPalace 判定
function findSoulPalace(astrolabe) {
  const palaces = astrolabe.palaces || [];
  const eb = astrolabe.earthlyBranchOfSoulPalace;
  if (eb) {
    const p = palaces.find(pl => pl.earthlyBranch === eb);
    if (p) return p;
  }
  return palaces.find(pl => pl.name === '命宫') || palaces[0];
}

function findBodyPalace(astrolabe) {
  const p = (astrolabe.palaces || []).find(pl => pl.isBodyPalace);
  return p || null;
}

// 星曜按类型分组，便于渲染与 prompt 构造（major/minor/adj 保留原始对象）
function groupStars(palace) {
  const major = palace.majorStars || [];
  const minor = palace.minorStars || [];
  const adj = palace.adjectiveStars || [];
  const mutagen = [];
  [...major, ...minor, ...adj].forEach(s => {
    if (s.mutagen) mutagen.push(`${s.name}${s.mutagen}`);
  });
  return { major, minor, adj, mutagen };
}

// 星曜显示文本（含庙旺利陷）
function starLabel(star) {
  let s = star.name || '';
  if (star.brightness) s += `(${star.brightness})`;
  return s;
}

// 虚岁（传统命理年龄：出生即 1 岁，每过一个春节加 1 岁）
function getVirtualAge(year) {
  return new Date().getFullYear() - year + 1;
}

// 周岁
function getFullAge(year, month, day) {
  const now = new Date();
  let age = now.getFullYear() - year;
  const hasBirthday = now.getMonth() + 1 > month ||
    (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hasBirthday) age -= 1;
  return age;
}

/* ---------- 渲染 ---------- */

// 获取指定日期的流年/大限/小限信息（iztro horoscope）
function getHoroscope(astrolabe, date) {
  try {
    const d = date || new Date();
    const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return astrolabe.horoscope(dateStr) || null;
  } catch (e) {
    console.warn('获取流年信息失败:', e.message);
    return null;
  }
}

// 从 horoscope 的宫位数组反查：某地支对应的原始宫位名
function branchToPalaceName(astrolabe, branch) {
  if (!branch) return '';
  const p = astrolabe.palaces.find(pl => pl.earthlyBranch === branch);
  return p ? p.name : '';
}

// 四化文案：mutagen 顺序为 [化禄, 化权, 化科, 化忌]
const MUTAGEN_LABELS = ['化禄', '化权', '化科', '化忌'];
function formatMutagen(mutagen) {
  if (!mutagen || !mutagen.length) return '—';
  return mutagen.map((s, i) => `${MUTAGEN_LABELS[i] || '化'}·${s}`).join('　');
}

// 自动识别常见格局（基于命宫主星 + 三方四正会照）
function detectPatterns(astrolabe) {
  const soul = findSoulPalace(astrolabe);
  const soulStars = new Set((soul.majorStars || []).map(s => s.name));
  const idx = astrolabe.palaces.indexOf(soul);
  if (idx < 0) return [];

  // 三方四正（本宫 + 三合 + 对宫）主星
  const trineIdx = [idx, (idx + 4) % 12, (idx + 8) % 12, (idx + 6) % 12];
  const trineStars = new Set();
  trineIdx.forEach(i => {
    (astrolabe.palaces[i].majorStars || []).forEach(s => trineStars.add(s.name));
  });

  const patterns = [];
  const allStars = (p) => [...(p.majorStars || []), ...(p.minorStars || []), ...(p.adjectiveStars || [])].map(s => s.name);

  // 紫府同宫 / 朝垣
  if (soulStars.has('紫微') && soulStars.has('天府')) patterns.push('紫府同宫格');
  else if ((soulStars.has('紫微') && trineStars.has('天府')) ||
           (soulStars.has('天府') && trineStars.has('紫微'))) patterns.push('紫府朝垣格');

  // 机月同梁
  if (['天机', '太阴', '天同', '天梁'].every(s => trineStars.has(s))) patterns.push('机月同梁格');

  // 杀破狼
  if (['七杀', '破军', '贪狼'].every(s => trineStars.has(s))) patterns.push('杀破狼格');

  // 日月同宫
  if (soulStars.has('太阳') && soulStars.has('太阴')) patterns.push('日月同宫格');

  // 武贪格
  if (soulStars.has('武曲') && soulStars.has('贪狼')) patterns.push('武贪格');

  // 禄马交驰（禄存与天马同宫或对宫）
  const lucunPalace = astrolabe.palaces.find(p => allStars(p).includes('禄存'));
  if (lucunPalace) {
    const liIdx = astrolabe.palaces.indexOf(lucunPalace);
    const oppo = astrolabe.palaces[(liIdx + 6) % 12];
    const hasTianma = allStars(lucunPalace).includes('天马') || allStars(oppo).includes('天马');
    if (hasTianma) patterns.push('禄马交驰格');
  }

  return patterns;
}

function renderZiwei(astrolabe, payload) {
  const metaEl = document.getElementById('ziwei-meta');
  const lunar = astrolabe.lunarDate || '';
  metaEl.innerHTML = `
    <div class="ziwei-meta-row">
      <span>🌐 公历 ${astrolabe.solarDate || '-'}</span>
      <span>🌙 农历 ${lunar}</span>
    </div>
    <div class="ziwei-meta-row">
      <span>🕐 时辰 ${ZIWEI_HOURS[payload.timeIndex].label}</span>
      <span>⚧ ${payload.gender}</span>
      <span>🏷️ 五行局：${astrolabe.fiveElementsClass || '-'}</span>
    </div>
  `;

  renderZiweiChart(astrolabe);
  renderZiweiSummary(astrolabe, payload);
  renderZiweiHoroscope(astrolabe, payload);
}

// 流年 / 大限 / 小限区块
function renderZiweiHoroscope(astrolabe, payload) {
  const box = document.getElementById('ziwei-horoscope');
  if (!box) return;

  const h = getHoroscope(astrolabe);
  if (!h) {
    box.innerHTML = '<div class="analysis-card"><h4>🚀 流年运势</h4><p>流年信息暂不可用</p></div>';
    return;
  }

  const now = new Date();
  const year = now.getFullYear();

  // 流年命宫（落在原命盘的哪个宫）
  const yearlyBranch = h.yearly ? h.yearly.earthlyBranch : '';
  const yearlyPalace = branchToPalaceName(astrolabe, yearlyBranch);
  const decadalBranch = h.decadal ? h.decadal.earthlyBranch : '';
  const decadalPalace = branchToPalaceName(astrolabe, decadalBranch);
  const ageBranch = h.age ? h.age.earthlyBranch : '';
  const agePalace = branchToPalaceName(astrolabe, ageBranch);

  const virtualAge = getVirtualAge(payload.year);

  box.innerHTML = `
    <div class="analysis-card">
      <h4>🚀 ${year} 流年运势</h4>
      <div class="horoscope-grid">
        <div class="horo-item">
          <div class="horo-label">流年命宫</div>
          <div class="horo-value">${yearlyBranch ? `${yearlyBranch}（原${yearlyPalace}）` : '—'}</div>
          <div class="horo-mutagen">${h.yearly ? formatMutagen(h.yearly.mutagen) : ''}</div>
        </div>
        <div class="horo-item">
          <div class="horo-label">大限命宫</div>
          <div class="horo-value">${decadalBranch ? `${decadalBranch}（原${decadalPalace}）` : '—'}</div>
          <div class="horo-mutagen">${h.decadal ? formatMutagen(h.decadal.mutagen) : ''}</div>
        </div>
        <div class="horo-item">
          <div class="horo-label">小限（虚岁 ${h.age ? h.age.nominalAge : virtualAge}）</div>
          <div class="horo-value">${ageBranch ? `${ageBranch}（原${agePalace}）` : '—'}</div>
          <div class="horo-mutagen">${h.age ? formatMutagen(h.age.mutagen) : ''}</div>
        </div>
      </div>
      <p class="horo-hint">流年/大限四化按「化禄·化权·化科·化忌」排列，四化飞星是紫微论命的重要依据</p>
    </div>
  `;
}

function renderZiweiChart(astrolabe) {
  const grid = document.getElementById('ziwei-grid');
  const soulPalace = findSoulPalace(astrolabe);
  const bodyPalace = findBodyPalace(astrolabe);

  // 先按地支定位所有宫位
  const cells = astrolabe.palaces.map(palace => {
    const pos = BRANCH_POS[palace.earthlyBranch] || 'auto';
    const g = groupStars(palace);
    const isSoul = palace === soulPalace;
    const isBody = bodyPalace && palace === bodyPalace;

    const cls = [
      'ziwei-cell',
      isSoul ? 'is-soul' : '',
      isBody ? 'is-body' : '',
      g.mutagen.length ? 'has-mutagen' : ''
    ].filter(Boolean).join(' ');

    // 主星放最上，四化高亮（直接遍历星曜对象，避免字符串匹配歧义）
    // 空宫提示借对宫主星
    const oppoPalace = astrolabe.palaces[(palace.index + OPPOSITE_OFFSET) % 12];
    const oppoStars = (oppoPalace && oppoPalace.majorStars || []).map(s => s.name).join('、');
    const majorHtml = g.major.length
      ? `<div class="zw-stars zw-major">${g.major.map(s =>
          `<span class="${s.mutagen ? 'star-mutagen' : ''}">${starLabel(s)}</span>`
        ).join('')}</div>`
      : `<div class="zw-stars zw-major zw-empty" title="本宫无主星，借对宫${oppoPalace ? oppoPalace.name : ''}星曜">借${oppoStars || '对宫'}</div>`;

    const minorHtml = (g.minor.length || g.adj.length)
      ? `<div class="zw-stars zw-minor">${[...g.minor, ...g.adj].map(starLabel).join(' ')}</div>`
      : '';

    const mutagenHtml = g.mutagen.length
      ? `<div class="zw-mutagen">${g.mutagen.join(' ')}</div>`
      : '';

    const tagHtml = [
      palace.name,
      isSoul ? '<i class="zw-tag">命</i>' : '',
      isBody ? '<i class="zw-tag zw-tag-body">身</i>' : ''
    ].join(' ');

    return `
      <div class="${cls}" style="grid-area:${pos}">
        <div class="zw-head">
          <span class="zw-branch">${palace.earthlyBranch}</span>
          <span class="zw-palace-name">${tagHtml}</span>
        </div>
        ${majorHtml}
        ${minorHtml}
        ${mutagenHtml}
        <div class="zw-decadal">${palace.decadal ? palace.decadal.range.join('-') + '岁' : ''}</div>
      </div>`;
  });

  // 中间 4 格：显示命宫主星概览
  const soulStars = (soulPalace.majorStars || []).map(s => s.name).join('、') || '空宫';
  const centerHtml = `
    <div class="zw-center" style="grid-area:2/2/4/4">
      <div class="zw-center-label">命宫</div>
      <div class="zw-center-stars">${soulStars}</div>
      <div class="zw-center-hint">${soulPalace.earthlyBranch || ''}</div>
    </div>`;

  grid.innerHTML = cells.join('') + centerHtml;
}

function renderZiweiSummary(astrolabe, payload) {
  // palaces 按地支顺序排列，命宫索引 = 命宫在数组中的位置
  const soulIndex = astrolabe.palaces.findIndex(p => p.name === '命宫');
  const safeSoulIndex = soulIndex >= 0 ? soulIndex : 0;
  const soul = astrolabe.palaces[safeSoulIndex];
  const opposite = astrolabe.palaces[(safeSoulIndex + OPPOSITE_OFFSET) % 12];
  const bodyPalace = findBodyPalace(astrolabe);

  // 年龄（虚岁用于匹配大限，周岁供参考）
  const virtualAge = getVirtualAge(payload.year);
  const fullAge = getFullAge(payload.year, payload.month, payload.day);
  const luckPalace = astrolabe.palaces.find(p =>
    p.decadal && p.decadal.range[0] <= virtualAge && virtualAge < p.decadal.range[1]
  );
  const currentLuckPalace = luckPalace ? luckPalace.name : '—';

  // 三方四正的所有星曜（去重）
  const trineIndexes = TRINE_OFFSETS.map(o => (safeSoulIndex + o) % 12);
  const trinePalaces = trineIndexes.map(i => astrolabe.palaces[i]);
  const allStars = new Set();
  trinePalaces.forEach(p => {
    [...(p.majorStars || []), ...(p.minorStars || [])].forEach(s => allStars.add(s.name));
  });

  const soulMajor = (soul.majorStars || []).map(s => s.name).join('、');
  const oppoMajor = (opposite.majorStars || []).map(s => s.name).join('、') || '无';
  // 空宫时改说"借对宫"，避免"主星为无主星"的别扭表述
  const soulText = soulMajor
    ? `主星为<span class="highlight">${soulMajor}</span>；对宫（迁移）主星<span class="highlight">${oppoMajor}</span>`
    : `<span class="highlight">空宫</span>，借对宫<span class="highlight">${oppoMajor}</span>论`;

  const patterns = detectPatterns(astrolabe);

  document.getElementById('ziwei-analysis').innerHTML = `
    <div class="analysis-card">
      <h4>🔮 命宫概览</h4>
      <p>命宫在<span class="highlight">${soul.earthlyBranch || ''}</span>，
      ${soulText}。
      身宫在<span class="highlight">${bodyPalace ? bodyPalace.name : '命身同宫'}</span>。</p>
      ${patterns.length ? `
        <div class="ziwei-patterns">
          <span class="pattern-label">命盘格局：</span>
          ${patterns.map(p => `<span class="pattern-chip">${p}</span>`).join('')}
        </div>` : ''}
    </div>
    <div class="analysis-card">
      <h4>🌟 三方四正星曜</h4>
      <div class="ziwei-star-list">${[...allStars].map(s => `<span class="star-chip">${s}</span>`).join('') || '—'}</div>
      <div class="ziwei-trine">
        ${trinePalaces.map(p => `<span class="trine-item">${p.name}·${(p.majorStars || []).map(s => s.name).join('') || '—'}</span>`).join('')}
      </div>
    </div>
    <div class="analysis-card">
      <h4>🚀 大限（虚岁）</h4>
      <div class="ziwei-luck-hint">
        你今年 <span class="highlight">${virtualAge} 岁（虚岁）</span> /
        ${fullAge} 岁（周岁），当前走<span class="highlight">${currentLuckPalace}</span>大限
      </div>
      <div class="ziwei-luck">
        ${astrolabe.palaces.map(p => {
          const cur = p.decadal && p.decadal.range[0] <= virtualAge && virtualAge < p.decadal.range[1];
          return `<span class="luck-item ${cur ? 'current' : ''}">
            <span class="luck-palace">${p.name}</span>
            <span class="luck-range">${p.decadal ? p.decadal.range.join('-') : ''}</span>
          </span>`;
        }).join('')}
      </div>
    </div>
  `;
}

/* ---------- AI 解读 ---------- */

function buildZiweiPrompt(astrolabe, payload) {
  const soul = findSoulPalace(astrolabe);

  // 逐宫整理
  const palaceLines = astrolabe.palaces.map(p => {
    const g = groupStars(p);
    const stars = [
      g.major.length ? `主星:${g.major.map(starLabel).join('、')}` : '主星:无',
      g.minor.length ? `辅星:${g.minor.map(starLabel).join('、')}` : '',
      g.adj.length ? `杂耀:${g.adj.map(starLabel).join('、')}` : '',
      g.mutagen.length ? `四化:${g.mutagen.join('、')}` : '',
      p.decadal ? `大限:${p.decadal.range.join('-')}岁` : ''
    ].filter(Boolean).join('，');
    const tags = [
      p.name,
      p.isBodyPalace ? '(身宫)' : ''
    ].filter(Boolean).join('');
    return `${tags} ${p.heavenlyStem || ''}${p.earthlyBranch || ''}　${stars}`;
  }).join('\n');

  // 当前年龄与大限（务必准确告知 AI，否则它会瞎猜）
  const virtualAge = getVirtualAge(payload.year);
  const fullAge = getFullAge(payload.year, payload.month, payload.day);
  const luckPalace = astrolabe.palaces.find(p =>
    p.decadal && p.decadal.range[0] <= virtualAge && virtualAge < p.decadal.range[1]
  );
  const luckText = luckPalace && luckPalace.decadal
    ? `${luckPalace.name}（${luckPalace.decadal.range.join('-')}岁，${luckPalace.decadal.heavenlyStem}${luckPalace.decadal.earthlyBranch}）`
    : '未知';

  // 流年/大限/小限四化（iztro horoscope）
  const h = getHoroscope(astrolabe);
  const horoText = h ? `
流年命宫：${h.yearly && h.yearly.earthlyBranch ? h.yearly.earthlyBranch + '（原' + (branchToPalaceName(astrolabe, h.yearly.earthlyBranch) || '') + '宫）' : '-'}
流年四化：${h.yearly ? formatMutagen(h.yearly.mutagen) : '-'}
大限四化：${h.decadal ? formatMutagen(h.decadal.mutagen) : '-'}
小限宫位：${h.age && h.age.earthlyBranch ? h.age.earthlyBranch + '（原' + (branchToPalaceName(astrolabe, h.age.earthlyBranch) || '') + '宫）' : '-'}` : '';

  return `请分析以下紫微斗数命盘：
出生：${payload.year}年${payload.month}月${payload.day}日，${ZIWEI_HOURS[payload.timeIndex].label}，${payload.gender}
农历：${astrolabe.lunarDate || '-'}
五行局：${astrolabe.fiveElementsClass || '-'}

【重要】当前时间：${new Date().getFullYear()}年${new Date().getMonth() + 1}月
命主年龄：虚岁 ${virtualAge} 岁，周岁 ${fullAge} 岁
当前大限：${luckText}
（大限年龄按虚岁计算，请以此为准判断命主所处的大限阶段）
${horoText}

十二宫命盘（按地支顺序）：
${palaceLines}

命宫主星：${(soul.majorStars || []).map(s => s.name).join('、') || '空宫（借对宫星曜论）'}

请从以下方面详细分析：
1. 命宫格局与性格特质（主星、庙旺利陷、四化影响）
2. 事业方向与官禄宫分析
3. 财富状况与财帛宫分析
4. 婚姻感情与夫妻宫分析
5. 健康状况与疾厄宫分析
6. 当前大限走势 + 今年流年运势（结合流年四化飞星，说明流年命宫落宫及吉凶倾向）
7. 开运建议（方位、颜色、行业、贵人方位等）

注意：
- 空宫要说明"借对宫星曜"的影响
- 四化飞星是论命重点，化禄主财禄机遇、化权主权柄专业、化科主声名考试、化忌主困扰执着
- 语言通俗易懂，避免堆砌术语`;
}

async function runZiweiAI(astrolabe, payload) {
  const aiSection = document.getElementById('ziwei-ai-analysis');
  if (!aiSection) return;

  aiSection.innerHTML = '<div class="loading-text">🔮 正在推演命盘，请稍候...</div>';
  aiSection.style.display = 'block';

  try {
    let pending = '';
    let timer = null;
    const doRender = () => {
      aiSection.innerHTML = `<div class="ai-reading ziwei-ai-text">${renderAIContent(pending)}</div>`;
      timer = null;
    };
    const text = await getZiweiAnalysis({ prompt: buildZiweiPrompt(astrolabe, payload) }, (fullText) => {
      pending = fullText;
      if (!timer) timer = setTimeout(doRender, 300);
    });
    if (timer) { clearTimeout(timer); doRender(); }
    return text;
  } catch (error) {
    console.warn('紫微 AI 分析失败:', error.message);
    renderError(aiSection, `AI 分析失败：${error.message}`, 'calculateZiwei()');
    return 'AI 分析暂不可用，请查看上方命盘信息。';
  }
}

async function saveZiweiReading(astrolabe, payload, aiText) {
  try {
    const soul = findSoulPalace(astrolabe);
    const input = {
      year: payload.year, month: payload.month, day: payload.day,
      timeIndex: payload.timeIndex, gender: payload.gender,
      lunarDate: astrolabe.lunarDate || '',
      soulPalace: soul.name || '',
      soulStars: (soul.majorStars || []).map(s => s.name).join('、')
    };
    const data = await HistoryAPI.save('紫微斗数', JSON.stringify(input), aiText || '');
    return data.reading_id || null;
  } catch (e) {
    console.warn('保存紫微记录失败:', e.message);
    return null;
  }
}

if (document.getElementById('page-ziwei')) {
  requireLogin().then(valid => { if (valid) initZiwei(); });
}
