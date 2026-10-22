/* ========== 登录/注册页面逻辑 ========== */
function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabs = document.querySelectorAll('.auth-tab');

  tabs.forEach(t => t.classList.remove('active'));

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    tabs[0].classList.add('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    tabs[1].classList.add('active');
  }
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const msg = document.getElementById('login-message');

  if (!username || !password) {
    msg.textContent = '请输入用户名和密码';
    msg.className = 'auth-message error';
    return;
  }

  msg.textContent = '登录中...';
  msg.className = 'auth-message info';

  try {
    const result = await UserAPI.login(username, password);
    if (result.success) {
      msg.textContent = '登录成功！';
      msg.className = 'auth-message success';
      setTimeout(() => goTo('index.html'), 500);
    } else {
      msg.textContent = result.error || '登录失败';
      msg.className = 'auth-message error';
    }
  } catch (e) {
    msg.textContent = '网络错误：' + e.message;
    msg.className = 'auth-message error';
  }
}

async function handleRegister() {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value.trim();
  const confirm = document.getElementById('register-confirm').value.trim();
  const msg = document.getElementById('register-message');

  if (!username || !password || !confirm) {
    msg.textContent = '请填写所有字段';
    msg.className = 'auth-message error';
    return;
  }

  if (password !== confirm) {
    msg.textContent = '两次密码不一致';
    msg.className = 'auth-message error';
    return;
  }

  msg.textContent = '注册中...';
  msg.className = 'auth-message info';

  try {
    const result = await UserAPI.register(username, password);
    if (result.success) {
      msg.textContent = '注册成功！正在登录...';
      msg.className = 'auth-message success';
      setTimeout(async () => {
        const loginResult = await UserAPI.login(username, password);
        if (loginResult.success) {
          goTo('index.html');
        }
      }, 800);
    } else {
      msg.textContent = result.error || '注册失败';
      msg.className = 'auth-message error';
    }
  } catch (e) {
    msg.textContent = '网络错误：' + e.message;
    msg.className = 'auth-message error';
  }
}

// 注册/登录页不加自动跳转，避免干扰注册流程
