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
  async list(typeOrOptions = null) {
    const opts = typeof typeOrOptions === 'string'
      ? { type: typeOrOptions }
      : (typeOrOptions || {});
    const params = new URLSearchParams({
      page: opts.page || 1,
      page_size: opts.pageSize || 20
    });
    if (opts.type) params.set('type', opts.type);
    if (opts.keyword) params.set('keyword', opts.keyword);
    if (opts.favorite) params.set('favorite', '1');
    const res = await apiRequest(`/history?${params}`);
    return res.json();
  },
  async favorite(id, favorite) {
    const res = await apiRequest(`/history/${id}/favorite`, {
      method: 'PUT',
      body: JSON.stringify({ favorite })
    });
    return res.json();
  },
  async tags(id, tags) {
    const res = await apiRequest(`/history/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags })
    });
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

// 通用流式请求（SSE）
async function streamEndpoint(path, payload, onChunk, onResponse) {
  const token = Auth.getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `请求失败 ${response.status}`);
  }
  if (onResponse) onResponse(response);

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

function streamAI(messages, maxTokens, onChunk) {
  return streamEndpoint('/ai/proxy', {
    messages,
    max_tokens: maxTokens || 2000,
    temperature: 0.8
  }, onChunk);
}

function streamZodiacAnalysis(sign, birthDate, element, onChunk) {
  return streamEndpoint('/ai/zodiac', {
    sign,
    birth_date: birthDate,
    element
  }, onChunk);
}

function streamDreamAnalysis(dream, onChunk) {
  return streamEndpoint('/ai/dream', { dream }, onChunk);
}

function streamBaziAnalysis(prompt, onChunk) {
  return streamEndpoint('/ai/bazi', { prompt }, onChunk);
}

function streamZiweiAnalysis(prompt, onChunk) {
  return streamEndpoint('/ai/ziwei', { prompt }, onChunk);
}

function streamChat(message, conversationId, system, onChunk, onResponse, extra = {}) {
  return streamEndpoint('/ai/chat', {
    message,
    conversation_id: conversationId || null,
    system,
    ...extra
  }, onChunk, onResponse);
}

async function requestStructured(kind, input) {
  const res = await apiRequest('/ai/structured', {
    method: 'POST',
    body: JSON.stringify({ kind, input })
  });
  return res.json();
}

// 会话历史
const ChatAPI = {
  async history(conversationId) {
    const res = await apiRequest(`/chat/history?conversation_id=${conversationId}`);
    return res.json();
  },
  async conversations() {
    const res = await apiRequest('/chat/conversations');
    return res.json();
  }
};

// 解梦知识库
const DreamAPI = {
  async list(keyword = '', category = '', page = 1, pageSize = 12) {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (keyword) params.set('keyword', keyword);
    if (category) params.set('category', category);
    const res = await apiRequest(`/dreams?${params}`);
    return res.json();
  },
  async categories() {
    const res = await apiRequest('/dreams/categories');
    return res.json();
  },
  async rag(query) {
    const res = await apiRequest(`/dreams/rag?q=${encodeURIComponent(query)}`);
    return res.json();
  }
};

window.Auth = Auth;
window.UserAPI = UserAPI;
window.HistoryAPI = HistoryAPI;
window.DreamAPI = DreamAPI;
window.ChatAPI = ChatAPI;
window.streamAI = streamAI;
window.streamZodiacAnalysis = streamZodiacAnalysis;
window.streamDreamAnalysis = streamDreamAnalysis;
window.streamBaziAnalysis = streamBaziAnalysis;
window.streamZiweiAnalysis = streamZiweiAnalysis;
window.streamChat = streamChat;
window.requestStructured = requestStructured;
