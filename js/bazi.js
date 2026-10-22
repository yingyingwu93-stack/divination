const heavenlyStems = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const earthlyBranches = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const stemElement = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
const branchElement = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
const stemYang = {'甲':true,'乙':false,'丙':true,'丁':false,'戊':true,'己':false,'庚':true,'辛':false,'壬':true,'癸':false};
const zodiacAnimals = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

function initBazi() {
  createStars('stars-bazi');
  fillBaziForm();
}

function fillBaziForm() {
  document.getElementById('bazi-year').value = 1995;
  document.getElementById('bazi-month').value = 6;
  document.getElementById('bazi-day').value = 15;

  const hourSel = document.getElementById('bazi-hour');
  const hours = ['子时(23-01)','丑时(01-03)','寅时(03-05)','卯时(05-07)','辰时(07-09)','巳时(09-11)','午时(11-13)','未时(13-15)','申时(15-17)','酉时(17-19)','戌时(19-21)','亥时(21-23)'];
  hours.forEach((h, i) => { hourSel.innerHTML += `<option value="${i}" ${i===6?'selected':''}>${h}</option>`; });
}

async function calculateBazi() {
  const year = parseInt(document.getElementById('bazi-year').value);
  const month = parseInt(document.getElementById('bazi-month').value);
  const day = parseInt(document.getElementById('bazi-day').value);
  const hour = parseInt(document.getElementById('bazi-hour').value);

  const yearStem = heavenlyStems[(year - 4) % 10];
  const yearBranch = earthlyBranches[(year - 4) % 12];

  const monthStemBase = [2,4,6,8,0,2,4,6,8,0];
  const yearStemIdx = heavenlyStems.indexOf(yearStem);
  const baseStem = monthStemBase[yearStemIdx];
  const monthStem = heavenlyStems[(baseStem + month - 1) % 10];
  const monthBranch = earthlyBranches[(month + 1) % 12];

  const baseDate = new Date(1900, 0, 1);
  const targetDate = new Date(year, month - 1, day);
  const dayDiff = Math.floor((targetDate - baseDate) / 86400000);
  const dayStem = heavenlyStems[(dayDiff + 10) % 10];
  const dayBranch = earthlyBranches[(dayDiff + 10) % 12];

  const hourStemBase = [8,0,2,4,6,8,0,2,4,6,8,0];
  const dayStemIdx = heavenlyStems.indexOf(dayStem);
  const hBase = hourStemBase[dayStemIdx % 10];
  const hourStem = heavenlyStems[(hBase + hour) % 10];
  const hourBranch = earthlyBranches[hour];

  const pillars = [
    { label: '年柱', heaven: yearStem, branch: yearBranch },
    { label: '月柱', heaven: monthStem, branch: monthBranch },
    { label: '日柱', heaven: dayStem, branch: dayBranch },
    { label: '时柱', heaven: hourStem, branch: hourBranch }
  ];

  const elemCount = {'木':0,'火':0,'土':0,'金':0,'水':0};
  pillars.forEach(p => { elemCount[stemElement[p.heaven]]++; elemCount[branchElement[p.branch]]++; });

  const dayMaster = dayStem;
  const element = stemElement[dayMaster];
  const isYang = stemYang[dayMaster];
  const animal = zodiacAnimals[(year - 4) % 12];
  const yinYang = isYang ? '阳' : '阴';

  const sorted = Object.entries(elemCount).sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0][0];
  const weakest = sorted[sorted.length - 1][0];

  document.getElementById('pillars').innerHTML = pillars.map(p => `
    <div class="pillar">
      <div class="pillar-label">${p.label}</div>
      <div class="pillar-heaven">${p.heaven}</div>
      <div class="pillar-earth">${p.branch}</div>
    </div>
  `).join('');

  const max = Math.max(...Object.values(elemCount));
  const elemIcons = {'木':'🌿','火':'🔥','土':'⛰️','金':'⚔️','水':'💧'};
  document.getElementById('elements-chart').innerHTML = Object.entries(elemCount).map(([name, count]) => `
    <div class="elem-row">
      <text class="elem-icon">${elemIcons[name]}</text>
      <view class="elem-bar-bg"><view class="elem-bar-fill" style="width:${(count/max)*100}%"></view></view>
      <text class="elem-count">${count}个</text>
    </div>
  `).join('');

  document.getElementById('bazi-analysis').innerHTML = `
    <div class="analysis-card"><h4>☯️ 命盘概览</h4><p>日主为<span class="highlight">${dayMaster}（${element}·${yinYang}）</span>，生肖属<span class="highlight">${animal}</span>。五行以<span class="highlight">${strongest}</span>最旺，<span class="highlight">${weakest}</span>偏弱。</p></div>
    <div class="analysis-card"><h4>💼 事业运势</h4><p>事业运势呈上升趋势，适合从事与${element}属性相关的工作。今年宜积极拓展人脉，把握合作机会。</p></div>
    <div class="analysis-card"><h4>💕 婚姻感情</h4><p>感情方面运势不错，单身者有望遇到心仪对象。已婚者夫妻感情和睦，但需多沟通。</p></div>
    <div class="analysis-card"><h4>💰 财运分析</h4><p>财运稳中有升，正财运不错。适合储蓄和稳健理财，不宜高风险投资。</p></div>
    <div class="analysis-card"><h4>🏥 健康提醒</h4><p>整体健康状况良好，但需注意与${element}相关脏腑的保养。规律饮食，适当运动。</p></div>
  `;

  document.getElementById('bazi-result').classList.add('show');
  document.getElementById('bazi-result').scrollIntoView({ behavior: 'smooth' });

  // AI 命理分析
  const aiSection = document.getElementById('bazi-ai-analysis');
  if (!aiSection) return;

  const pillarsText = pillars.map(p => `${p.label}: ${p.heaven}${p.branch}`).join('，');
  const elemText = Object.entries(elemCount).map(([k, v]) => `${k}${v}个`).join('、');

  const prompt = `请分析以下八字：
出生信息：${year}年${month}月${day}日，${['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][hour]}时
四柱：${pillarsText}
日主：${dayMaster}（${element}·${yinYang}）
生肖：${animal}
五行分布：${elemText}
五行最强：${strongest}，最弱：${weakest}

请从以下方面详细分析：
1. 日主强弱与格局特点
2. 性格特征与天赋潜能
3. 事业方向与财运走势
4. 婚姻感情与家庭关系
5. 健康注意事项
6. 五行开运建议（日常穿搭、方位、职业等）`;

  aiSection.innerHTML = '<div class="loading-text">☯️ 正在推演命局，请稍候...</div>';
  aiSection.style.display = 'block';

  try {
    let baziResult = '';
    let baziRenderTimer = null;
    let baziPendingText = '';
    const formatBrBazi = text => text.replace(/\n/g, '<br>');
    const doBaziRender = () => {
      baziContainer.innerHTML = formatBrBazi(baziPendingText);
      baziRenderTimer = null;
    };
    await getBaziAnalysis({ prompt }, (fullText) => {
      baziResult = fullText;
      baziPendingText = fullText;
      if (!baziRenderTimer) {
        baziRenderTimer = setTimeout(doBaziRender, 300);
      }
    });
    if (baziRenderTimer) {
      clearTimeout(baziRenderTimer);
      doBaziRender();
    }
    // 保存到历史记录
    saveBaziReading(year, month, day, hour, baziResult);
  } catch (error) {
    console.warn('八字 AI 分析失败:', error.message);
    const retry = `calculateBazi()`;
    renderError(aiSection, `AI 分析失败：${error.message}`, retry);
  }
}

if (document.getElementById('page-bazi')) {
  requireLogin().then(valid => { if (valid) initBazi(); });
}

// 八字分析完成后保存到历史
async function saveBaziReading(year, month, day, hour, result) {
  try {
    const input = JSON.stringify({ year, month, day, hour });
    await HistoryAPI.save('八字', input, result);
  } catch (e) {
    console.warn('保存八字记录失败:', e.message);
  }
}
