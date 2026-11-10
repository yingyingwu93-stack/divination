/* ========== 八字排盘（后端引擎 + AI 解读） ========== */

const BAZI_HOURS = [
  { label: '早子时(00-01)', hour: 0 }, { label: '丑时(01-03)', hour: 1 },
  { label: '寅时(03-05)', hour: 3 }, { label: '卯时(05-07)', hour: 5 },
  { label: '辰时(07-09)', hour: 7 }, { label: '巳时(09-11)', hour: 9 },
  { label: '午时(11-13)', hour: 12 }, { label: '未时(13-15)', hour: 13 },
  { label: '申时(15-17)', hour: 15 }, { label: '酉时(17-19)', hour: 17 },
  { label: '戌时(19-21)', hour: 19 }, { label: '亥时(21-23)', hour: 21 },
  { label: '晚子时(23-24)', hour: 23 }
];

function initBazi() {
  createStars('stars-bazi');
  fillBaziForm();
}

function fillBaziForm() {
  document.getElementById('bazi-year').value = 1995;
  document.getElementById('bazi-month').value = 6;
  document.getElementById('bazi-day').value = 15;
  document.getElementById('bazi-minute').value = 0;
  document.getElementById('bazi-gender').value = 'male';

  // 有保存过的出生日期时自动回填
  const saved = localStorage.getItem('zhanbu_birth_date') ||
    (Auth.getUser() && Auth.getUser().birth_date) || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(saved)) {
    const [y, m, d] = saved.split('-').map(Number);
    document.getElementById('bazi-year').value = y;
    document.getElementById('bazi-month').value = m;
    document.getElementById('bazi-day').value = d;
  }

  const hourSel = document.getElementById('bazi-hour');
  hourSel.innerHTML = BAZI_HOURS.map(h =>
    `<option value="${h.hour}" ${h.hour === 12 ? 'selected' : ''}>${h.label}</option>`
  ).join('');

  const provinceSel = document.getElementById('bazi-province');
  provinceSel.innerHTML = BAZI_REGIONS.map((r, i) =>
    `<option value="${r.name}" ${i === 0 ? 'selected' : ''}>${r.name}</option>`
  ).join('');
  updateCityOptions(BAZI_REGIONS[0].name);

  provinceSel.addEventListener('change', () => updateCityOptions(provinceSel.value));
  document.getElementById('bazi-city').addEventListener('change', () => {
    const lng = parseFloat(document.getElementById('bazi-city').value);
    if (!isNaN(lng)) document.getElementById('bazi-longitude').value = lng;
  });
}

function updateCityOptions(provinceName) {
  const region = BAZI_REGIONS.find(r => r.name === provinceName) || BAZI_REGIONS[0];
  const citySel = document.getElementById('bazi-city');
  citySel.innerHTML = region.cities.map(([name, lng]) =>
    `<option value="${lng}">${name}</option>`
  ).join('');
  document.getElementById('bazi-longitude').value = region.cities[0][1];
}

function getCityName() {
  const province = document.getElementById('bazi-province');
  const city = document.getElementById('bazi-city');
  return `${province.value}·${city.options[city.selectedIndex].textContent}`;
}

async function calculateBazi() {
  const payload = {
    year: parseInt(document.getElementById('bazi-year').value),
    month: parseInt(document.getElementById('bazi-month').value),
    day: parseInt(document.getElementById('bazi-day').value),
    hour: parseInt(document.getElementById('bazi-hour').value),
    minute: parseInt(document.getElementById('bazi-minute').value) || 0,
    longitude: parseFloat(document.getElementById('bazi-longitude').value),
    gender: document.getElementById('bazi-gender').value,
    location: getCityName()
  };

  if (!payload.year || !payload.month || !payload.day) {
    alert('请填写完整的出生日期');
    return;
  }
  if (isNaN(payload.longitude) || payload.longitude < 70 || payload.longitude > 140) {
    alert('请输入有效的出生地经度（70-140）');
    return;
  }

  const btn = document.querySelector('.bazi-start-btn');
  btn.disabled = true;
  btn.textContent = '☯️ 正在排盘...';

  try {
    const res = await apiRequest('/bazi/calc', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '排盘失败');

    renderBazi(json.data);
    document.getElementById('bazi-result').classList.add('show');
    document.getElementById('bazi-result').scrollIntoView({ behavior: 'smooth' });

    // 保存出生日期，供首页和星座页默认使用
    const birthDate = `${payload.year}-${String(payload.month).padStart(2, '0')}-${String(payload.day).padStart(2, '0')}`;
    saveBirthDate(birthDate);

    runBaziAI(json.data)
      .then(text => saveBaziReading(json.data, text).then(readingId => ({ text, readingId })))
      .then(({ text, readingId }) => {
        if (readingId && typeof initFollowup === 'function') {
          initFollowup(readingId, {
            system: '你是一位精通八字命理的命理师。用户正在追问刚才的命盘解读，请结合上下文回答，语言通俗易懂，不要使用 markdown。',
            placeholder: '继续追问这次命盘解读...'
          });
        }
        if (readingId && typeof Assistant !== 'undefined') {
          const dm = json.data.day_master;
          Assistant.pushResult({
            type: '八字',
            title: '八字排盘完成',
            summary: `日主 ${dm.stem}${dm.element}，五行${json.data.strongest}最旺、${json.data.weakest}偏弱。${(text || '').slice(0, 60)}`,
            readingId
          });
        }
      });
  } catch (error) {
    alert('排盘失败：' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '☯️ 开始排盘';
  }
}

function renderBazi(data) {
  const st = data.solar_time;
  document.getElementById('bazi-solar-info').innerHTML =
    `🕐 北京时间 ${st.local} ｜ 真太阳时 ${st.true_solar}` +
    `<br>经度校正 ${st.longitude_correction_min} 分钟 · 均时差 ${st.equation_of_time_min} 分钟`;

  document.getElementById('pillars').innerHTML = data.pillars.map(p => `
    <div class="pillar">
      <div class="pillar-label">${p.label}</div>
      <div class="pillar-ten-god">${p.ten_god}</div>
      <div class="pillar-heaven">${p.stem}</div>
      <div class="pillar-earth">${p.branch}</div>
      <div class="pillar-nayin">${p.nayin}</div>
      <div class="pillar-hidden">
        ${p.hidden.map(h => `<span class="hidden-stem">${h.stem}·${h.ten_god}</span>`).join('')}
      </div>
    </div>
  `).join('');

  const max = Math.max(...Object.values(data.five_elements).map(e => e.score));
  const elemIcons = { '木': '🌿', '火': '🔥', '土': '⛰️', '金': '⚔️', '水': '💧' };
  document.getElementById('elements-chart').innerHTML = `
    <h4>🌊 五行力量分布</h4>
    ${Object.entries(data.five_elements).map(([name, v]) => `
      <div class="elem-row">
        <span class="elem-icon">${elemIcons[name]}</span>
        <div class="elem-bar-bg"><div class="elem-bar-fill" style="width:${max ? (v.score / max) * 100 : 0}%"></div></div>
        <span class="elem-count">${v.percent}%</span>
      </div>`).join('')}
  `;

  const tenGods = Object.entries(data.ten_gods)
    .map(([name, count]) => `<span class="ten-god-chip">${name} × ${count}</span>`).join('');
  const shensha = data.shensha.length
    ? data.shensha.map(s => `<span class="shensha-chip">${s.name}·${s.pillar}</span>`).join('')
    : '<span class="ten-god-chip">无常用神煞</span>';

  const dm = data.day_master;
  const luck = data.luck;
  const currentAge = new Date().getFullYear() - data.input.year;

  document.getElementById('bazi-analysis').innerHTML = `
    <div class="analysis-card">
      <h4>☯️ 命盘概览</h4>
      <p>日主为<span class="highlight">${dm.stem}（${dm.element}·${dm.yin_yang}）</span>，
      生肖属<span class="highlight">${data.zodiac}</span>。
      五行以<span class="highlight">${data.strongest}</span>最旺，
      <span class="highlight">${data.weakest}</span>偏弱。</p>
    </div>
    <div class="analysis-card">
      <h4>🏷️ 十神分布</h4>
      <div class="ten-god-list">${tenGods}</div>
    </div>
    <div class="analysis-card">
      <h4>✨ 神煞</h4>
      <div class="shensha-list">${shensha}</div>
    </div>
    <div class="luck-section">
      <h4>🚀 大运（${luck.direction}）</h4>
      <div class="luck-sub">起运：${luck.start_age.years} 岁 ${luck.start_age.months} 个月 ${luck.start_age.days} 天（${luck.start_year} 年）</div>
      <div class="luck-scroll">
        ${luck.cycles.map(c => `
          <div class="luck-item ${currentAge >= c.start_age && currentAge < c.start_age + 10 ? 'current' : ''}">
            <div class="luck-pillar">${c.pillar}</div>
            <div class="luck-age">${c.start_age} 岁起</div>
            <div class="luck-year">${c.start_year}</div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

function buildBaziPrompt(data) {
  const pillars = data.pillars.map(p =>
    `${p.label}：${p.stem}${p.branch}（${p.ten_god}，纳音${p.nayin}，藏干${p.hidden.map(h => h.stem).join('/')}）`
  ).join('\n');
  const elements = Object.entries(data.five_elements)
    .map(([k, v]) => `${k}${v.percent}%`).join('、');
  const luck = data.luck.cycles.map(c => `${c.start_age}岁 ${c.pillar}`).join('，');
  const shensha = data.shensha.length
    ? data.shensha.map(s => `${s.name}(${s.pillar})`).join('、') : '无';

  return `请分析以下八字命盘：
出生：${data.input.year}年${data.input.month}月${data.input.day}日 ${data.input.hour}时${data.input.minute}分，${data.input.location || ''}，${data.input.gender === 'male' ? '男' : '女'}
真太阳时：${data.solar_time.true_solar}
四柱：
${pillars}
日主：${data.day_master.stem}（${data.day_master.element}·${data.day_master.yin_yang}）
生肖：${data.zodiac}
五行力量：${elements}（${data.strongest}最旺，${data.weakest}最弱）
十神：${Object.entries(data.ten_gods).map(([k, v]) => k + v + '个').join('、')}
大运：${data.luck.direction}，${data.luck.start_age.years}岁起运；${luck}
神煞：${shensha}

请从以下方面详细分析：
1. 日主强弱与格局特点
2. 性格特征与天赋潜能
3. 事业方向与财运走势
4. 婚姻感情与家庭关系
5. 健康注意事项
6. 五行开运建议（日常穿搭、方位、职业等）`;
}

async function runBaziAI(data) {
  const aiSection = document.getElementById('bazi-ai-analysis');
  if (!aiSection) return;

  aiSection.innerHTML = '<div class="loading-text">☯️ 正在推演命局，请稍候...</div>';
  aiSection.style.display = 'block';

  try {
    let pending = '';
    let textEl = null;
    let timer = null;

    const doRender = () => {
      timer = null;
      if (!textEl) {
        aiSection.innerHTML = '';
        textEl = document.createElement('div');
        textEl.className = 'ai-reading bazi-ai-text';
        aiSection.appendChild(textEl);
      }

      // 仅当用户停留在页面底部附近时才跟随滚动，向上翻看时不打扰
      const nearBottom = window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 160;

      // 使用统一 Markdown 渲染
      textEl.innerHTML = renderAIContent(pending);

      if (nearBottom) window.scrollTo(0, document.documentElement.scrollHeight);
    };

    const text = await getBaziAnalysis({ prompt: buildBaziPrompt(data) }, (fullText) => {
      pending = fullText;
      if (!timer) timer = setTimeout(doRender, 120);
    }, null, () => {
      // 输出被 max_tokens 截断时给出提示
      if (textEl && !textEl.querySelector('.truncate-hint')) {
        const hint = document.createElement('div');
        hint.className = 'truncate-hint';
        hint.style.cssText = 'margin-top:12px;padding:10px 12px;border-radius:8px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:13px;';
        hint.textContent = '⚠️ 分析内容较长，已自动截断。可点击"重新排盘"再次生成。';
        textEl.appendChild(hint);
      }
    });
    if (timer) { clearTimeout(timer); }
    doRender();
    return text;
  } catch (error) {
    console.warn('八字 AI 分析失败:', error.message);
    renderError(aiSection, `AI 分析失败：${error.message}`, 'calculateBazi()');
    return data.pillars.map(p => `${p.label} ${p.stem}${p.branch}（${p.ten_god}）`).join('，');
  }
}

async function saveBaziReading(data, aiText) {
  try {
    const input = {
      year: data.input.year, month: data.input.month, day: data.input.day,
      hour: data.input.hour, minute: data.input.minute,
      gender: data.input.gender, location: data.input.location,
      pillars: data.pillars.map(p => p.stem + p.branch).join(' ')
    };
    const data = await HistoryAPI.save('八字', JSON.stringify(input), aiText || '');
    return data.reading_id || null;
  } catch (e) {
    console.warn('保存八字记录失败:', e.message);
    return null;
  }
}

if (document.getElementById('page-bazi')) {
  requireLogin().then(valid => { if (valid) initBazi(); });
}
