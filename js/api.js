/* ========== 后端 API 封装 ========== */
// 默认使用相对路径（Flask 同域部署），开发时可改为绝对路径
const API_BASE = '/api';

// Token 管理
const Auth = {
  getToken() {
    return localStorage.getItem('zhanbu_token');
  },
  setToken(token) {
    localStorage.setItem('zhanbu_token', token);
  },
  removeToken() {
    localStorage.removeItem('zhanbu_token');
    localStorage.removeItem('zhanbu_user');
  },
  getUser() {
    const data = localStorage.getItem('zhanbu_user');
    return data ? JSON.parse(data) : null;
  },
  setUser(user) {
    localStorage.setItem('zhanbu_user', JSON.stringify(user));
  },
  isLoggedIn() {
    return !!this.getToken();
  }
};

// 通用请求封装
async function apiRequest(url, options = {}) {
  const token = Auth.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  return response;
}

// 用户认证
const UserAPI = {
  async register(username, password) {
    const res = await apiRequest('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },
  async login(username, password) {
    const res = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      Auth.setToken(data.token);
      Auth.setUser(data.user);
    }
    return data;
  },
  logout() {
    Auth.removeToken();
    goTo('auth.html');
  }
};

// 历史记录
const HistoryAPI = {
  async list(type = null) {
    const url = type ? `/history?type=${type}` : '/history';
    const res = await apiRequest(url);
    return res.json();
  },
  async save(type, inputData, result) {
    const res = await apiRequest('/history', {
      method: 'POST',
      body: JSON.stringify({
        type,
        input_data: typeof inputData === 'string' ? inputData : JSON.stringify(inputData),
        result: typeof result === 'string' ? result : JSON.stringify(result)
      })
    });
    return res.json();
  },
  async delete(id) {
    const res = await apiRequest(`/history/${id}`, { method: 'DELETE' });
    return res.json();
  }
};

// AI 代理（流式）
async function streamAI(messages, maxTokens, onChunk) {
  const token = Auth.getToken();
  const response = await fetch(`${API_BASE}/ai/proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      messages,
      max_tokens: maxTokens || 2000,
      temperature: 0.8
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `请求失败 ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') break;

      try {
        const json = JSON.parse(data);
        if (json.error) throw new Error(json.error);
        const delta = json.content || '';
        if (delta) {
          fullContent += delta;
          if (onChunk) onChunk(fullContent, delta);
        }
      } catch (e) {
        if (e.message && !e.message.includes('JSON')) throw e;
      }
    }
  }

  if (!fullContent) throw new Error('模型无回复');
  return fullContent;
}

// 星座 AI 分析（流式）
async function streamZodiacAnalysis(sign, birthDate, element, onChunk) {
  const token = Auth.getToken();
  const response = await fetch(`${API_BASE}/ai/zodiac`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      sign,
      birth_date: birthDate,
      element: element
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `请求失败 ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') break;

      try {
        const json = JSON.parse(data);
        if (json.error) throw new Error(json.error);
        const delta = json.content || '';
        if (delta) {
          fullContent += delta;
          if (onChunk) onChunk(fullContent, delta);
        }
      } catch (e) {
        if (e.message && !e.message.includes('JSON')) throw e;
      }
    }
  }

  if (!fullContent) throw new Error('模型无回复');
  return fullContent;
}

window.Auth = Auth;
window.UserAPI = UserAPI;
window.HistoryAPI = HistoryAPI;
window.streamAI = streamAI;
window.streamZodiacAnalysis = streamZodiacAnalysis;
