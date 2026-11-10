/* ========== AI 调用（通过后端代理，流式输出） ========== */

async function getLongCatReading(cards, question, onChunk) {
  const orient = c => c.isReversed ? '逆位' : '正位';

  const systemPrompt = `你是一位温暖、有共情力的塔罗牌解读师。请根据用户的问题、牌阵位置和抽到的塔罗牌，给出详细、人性化的解读。

要求：
1. 先共情用户的处境，让他感觉被理解
2. 按牌阵位置逐一解读每张牌，把牌面含义和用户的具体问题、所在位置关联起来
3. 最后给出整体分析和可操作的建议
4. 语言要温暖自然，像朋友在聊天，不要像机器人在念稿
5. 使用简洁的 Markdown 排版（## 标题、**重点**、- 列表）增强可读性

格式要求：
- 用空行分段
- 每张牌的解读先用【位置·牌名】标出
- 最后用---分隔，给出整体分析和建议`;

  const cardsText = cards.map((c, i) => `${i + 1}. 【${c.position}】${c.name}（${orient(c)}）
   牌面含义：${c.meaning}
   ${c.isReversed ? c.reversed : c.upright}`).join('\n\n');

  const userPrompt = `用户的问题：${question || '没有具体问题，请综合解读'}

抽到的牌（共 ${cards.length} 张）：
${cardsText}

请给出详细的塔罗解读。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  return streamAI(messages, cards.length > 5 ? 3200 : 2000, onChunk);
}

/* ========== 八字命理 AI 分析（后端 RAG 增强） ========== */
function getBaziAnalysis(baziInfo, onChunk) {
  return streamBaziAnalysis(baziInfo.prompt, onChunk);
}

/* ========== 紫微斗数 AI 分析（后端 RAG 增强） ========== */
function getZiweiAnalysis(ziweiInfo, onChunk) {
  return streamZiweiAnalysis(ziweiInfo.prompt, onChunk);
}

/* ========== 解梦 AI 分析（后端 RAG 增强） ========== */
function getDreamAnalysis(dreamContent, onChunk) {
  return streamDreamAnalysis(dreamContent, onChunk);
}

window.getLongCatReading = getLongCatReading;
window.getBaziAnalysis = getBaziAnalysis;
window.getZiweiAnalysis = getZiweiAnalysis;
window.getDreamAnalysis = getDreamAnalysis;
