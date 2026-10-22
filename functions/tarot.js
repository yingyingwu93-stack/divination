const https = require('https');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { prompt, max_tokens = 2000 } = JSON.parse(event.body);
    if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: '缺少 prompt' }) };

    const content = await callLongCat(prompt, max_tokens);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, content }) };
  } catch (error) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
  }
};

function callLongCat(prompt, maxTokens) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model: 'LongCat-2.0', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0.8 });
    const options = { hostname: 'api.longcat.chat', path: '/openai/v1/chat/completions', method: 'POST', headers: { 'Authorization': `Bearer ${process.env.LONGCAT_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) reject(new Error(json.error.message));
          else if (json.choices && json.choices[0]) resolve(json.choices[0].message.content || json.choices[0].message.reasoning_content || '无回复');
          else reject(new Error('未知响应'));
        } catch (e) { reject(new Error('响应解析失败')); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
