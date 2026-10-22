/* ========== 设置页面逻辑 ========== */

function goTo(url) { window.location.href = url; }
function goBack() { if (window.history.length > 1) { window.history.back(); } else { window.location.href = 'index.html'; } }

function createStars(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  for (let i = 0; i < 40; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--dur', (1.5 + Math.random() * 3) + 's');
    star.style.animationDelay = Math.random() * 3 + 's';
    star.style.width = star.style.height = (1 + Math.random() * 2) + 'px';
    container.appendChild(star);
  }
  const aurora1 = document.createElement('div');
  aurora1.className = 'aurora aurora-1';
  container.appendChild(aurora1);
  const aurora2 = document.createElement('div');
  aurora2.className = 'aurora aurora-2';
  container.appendChild(aurora2);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// 加载用户信息
async function loadUserInfo() {
  const user = Auth.getUser();
  if (user) {
    document.getElementById('settings-username').textContent = user.username;
    document.getElementById('settings-userid').textContent = '用户ID: ' + (user.id || '—');
  }

  try {
    const res = await apiRequest('/user');
    const data = await res.json();
    if (data.success && data.user) {
      document.getElementById('settings-username').textContent = data.user.username;
      document.getElementById('settings-userid').textContent = '用户ID: ' + data.user.id;
    }
  } catch (e) {
    console.warn('获取用户信息失败:', e.message);
  }
}

// 退出登录
function handleLogout() {
  if (confirm('确定要退出登录吗？')) {
    Auth.removeToken();
    goTo('auth.html');
  }
}

// 修改密码
function showChangePassword() {
  document.getElementById('old-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
  document.getElementById('password-message').textContent = '';
  document.getElementById('password-message').className = 'auth-message';
  document.getElementById('modal-password').classList.add('show');
}

async function handleChangePassword() {
  const oldPwd = document.getElementById('old-password').value.trim();
  const newPwd = document.getElementById('new-password').value.trim();
  const confirmPwd = document.getElementById('confirm-password').value.trim();
  const msg = document.getElementById('password-message');

  if (!oldPwd || !newPwd || !confirmPwd) {
    msg.textContent = '请填写所有字段';
    msg.className = 'auth-message error';
    return;
  }

  if (newPwd.length < 6) {
    msg.textContent = '新密码至少6位';
    msg.className = 'auth-message error';
    return;
  }

  if (newPwd !== confirmPwd) {
    msg.textContent = '两次新密码不一致';
    msg.className = 'auth-message error';
    return;
  }

  msg.textContent = '修改中...';
  msg.className = 'auth-message info';

  try {
    const res = await apiRequest('/user/password', {
      method: 'PUT',
      body: JSON.stringify({ old_password: oldPwd, new_password: newPwd })
    });
    const data = await res.json();

    if (data.success) {
      msg.textContent = '密码修改成功！';
      msg.className = 'auth-message success';
      setTimeout(() => closeModal('modal-password'), 1000);
    } else {
      msg.textContent = data.error || '修改失败';
      msg.className = 'auth-message error';
    }
  } catch (e) {
    msg.textContent = '网络错误: ' + e.message;
    msg.className = 'auth-message error';
  }
}

// 注销账号
function showDeleteAccount() {
  document.getElementById('delete-password').value = '';
  document.getElementById('delete-message').textContent = '';
  document.getElementById('delete-message').className = 'auth-message';
  document.getElementById('modal-delete').classList.add('show');
}

async function handleDeleteAccount() {
  const password = document.getElementById('delete-password').value.trim();
  const msg = document.getElementById('delete-message');

  if (!password) {
    msg.textContent = '请输入密码确认身份';
    msg.className = 'auth-message error';
    return;
  }

  msg.textContent = '处理中...';
  msg.className = 'auth-message info';

  try {
    const res = await apiRequest('/user', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.success) {
      msg.textContent = '账号已注销';
      msg.className = 'auth-message success';
      setTimeout(() => {
        Auth.removeToken();
        goTo('auth.html');
      }, 1000);
    } else {
      msg.textContent = data.error || '注销失败';
      msg.className = 'auth-message error';
    }
  } catch (e) {
    msg.textContent = '网络错误: ' + e.message;
    msg.className = 'auth-message error';
  }
}

// 点击遮罩关闭弹窗
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('show');
  }
});

// 加载 AI 聊天记录
async function loadChatHistory() {
  const container = document.getElementById('chat-history-list');
  if (!container) return;

  try {
    const res = await apiRequest('/history?type=聊天');
    const data = await res.json();

    if (!data.success || !data.readings || data.readings.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:20px;font-size:13px;color:var(--text-muted);">还没有聊天记录，去首页和 AI 助手聊聊吧～</div>';
      return;
    }

    container.innerHTML = data.readings.map(r => {
      let question = '';
      try {
        question = JSON.parse(r.input_data);
      } catch {
        question = r.input_data.substring(0, 50);
      }
      const answer = r.result.substring(0, 100);
      const time = formatDate(r.created_at);

      return `
        <div class="chat-history-item">
          <div class="chat-history-q">
            <span class="chat-history-label">问</span>
            <span class="chat-history-text">${question}</span>
          </div>
          <div class="chat-history-a">
            <span class="chat-history-label">答</span>
            <span class="chat-history-text">${answer}${r.result.length > 100 ? '...' : ''}</span>
          </div>
          <div class="chat-history-time">${time}</div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;font-size:13px;color:var(--text-muted);">加载失败：' + e.message + '</div>';
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr.endsWith('Z') || dateStr.endsWith('UTC') ? dateStr : dateStr + ' UTC');
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// 初始化
if (document.getElementById('page-settings')) {
  createStars('stars-settings');
  if (!Auth.isLoggedIn()) {
    goTo('auth.html');
  } else {
    loadUserInfo();
    loadChatHistory();
  }
}
