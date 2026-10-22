/* ========== AI 调用（通过后端代理，流式输出） ========== */

async function getLongCatReading(cards, question, onChunk) {
  const [past, present, future] = cards;
  const orient = c => c.isReversed ? '逆位' : '正位';

  const systemPrompt = `你是一位温暖、有共情力的塔罗牌解读师。请根据用户的问题和抽到的塔罗牌，给出详细、人性化的解读。

要求：
1. 先共情用户的处境，让他感觉被理解
2. 按照"过去→现在→未来"的顺序，逐一解读每张牌，要把牌面含义和用户的具体问题关联起来
3. 最后给出整体分析和可操作的建议
4. 语言要温暖自然，像朋友在聊天，不要像机器人在念稿
5. 不要使用 markdown 格式（不用 **粗体** 等），用自然段落

格式要求：
- 用空行分段
- 每张牌的解读先用【牌名】标出
- 最后用---分隔，给出整体分析和建议`;

  const userPrompt = `用户的问题：${question || '没有具体问题，请综合解读'}

抽到的三张牌：
1. 【过去】${past.name}（${orient(past)}）
   牌面含义：${past.meaning}
   ${past.isReversed ? past.reversed : past.upright}

2. 【现在】${present.name}（${orient(present)}）
   牌面含义：${present.meaning}
   ${present.isReversed ? present.reversed : present.upright}

3. 【未来】${future.name}（${orient(future)}）
   牌面含义：${future.meaning}
   ${future.isReversed ? future.reversed : future.upright}

请给出详细的塔罗解读。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  return streamAI(messages, 2000, onChunk);
}

/* ========== 八字命理 AI 分析 ========== */
async function getBaziAnalysis(baziInfo, onChunk) {
  const messages = [
    {
      role: 'system',
      content: `你是一位精通八字命理的命理师，拥有三十年命理研究经验。请根据用户提供的八字信息，给出详细、专业且易懂的命理分析。

要求：
1. 分析要有针对性，结合具体的八字组合
2. 语言通俗易懂，深入浅出，不要过于晦涩
3. 既要专业又要有实用性，给出具体建议
4. 不要使用 markdown 格式，用自然段落
5. 用空行分段，结构清晰`
    },
    {
      role: 'user',
      content: baziInfo.prompt
    }
  ];

  return streamAI(messages, 3000, onChunk);
}

/* ========== 解梦 AI 分析 ========== */
async function getDreamAnalysis(dreamContent, onChunk) {
  const prompt = `用户梦境：${dreamContent}

请从以下方面专业解读这个梦境：
1. 梦境中的关键意象及其象征意义
2. 梦境反映的潜意识心理状态
3. 对近期生活的启示和建议`;

  const messages = [
    {
      role: 'system',
      content: `你是一位精通解梦的心理学家，熟悉周公解梦、弗洛伊德梦境分析等理论。请根据用户描述的梦境，给出专业且易懂的解读。

要求：
1. 结合梦境中的具体意象进行分析
2. 从心理学角度解释梦境反映的内心状态
3. 给出实用的生活建议
4. 不要使用 markdown 格式，用自然段落
5. 语言温和有共情力，用空行分段`
    },
    { role: 'user', content: prompt }
  ];

  return streamAI(messages, 2000, onChunk);
}

window.getLongCatReading = getLongCatReading;
window.getBaziAnalysis = getBaziAnalysis;
window.getDreamAnalysis = getDreamAnalysis;
