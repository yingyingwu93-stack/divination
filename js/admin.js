/* ========== 管理后台 ========== */

const adminState = {
  users: { page: 1, total: 0 },
  readings: { page: 1, total: 0 },
  dreams: { page: 1, total: 0 },
  dreamCache: {},
  charts: {}
};

async function initAdmin() {
  createStars('stars-admin');

  document.getElementById('admin-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.admin-tab');
    if (!tab) return;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tab.dataset.panel).classList.add('active');

    const panel = tab.dataset.panel;
    if (panel === 'dashboard') loadDashboard();
    if (panel === 'users') loadUsers(1);
    if (panel === 'readings') loadReadings(1);
    if (panel === 'dreams') loadDreams(1);
  });

  try {
    const res = await apiRequest('/user');
    const data = await res.json();
    if (!data.success || !data.user || data.user.role !== 'admin') {
      document.getElementById('admin-forbidden').style.display = 'block';
      return;
    }
    document.getElementById('admin-main').style.display = 'block';
    loadDashboard();
  } catch (e) {
    document.getElementById('admin-forbidden').style.display = 'block';
  }
}

/* ---------- 数据看板 ---------- */
async function loadDashboard() {
  try {
    const res = await apiRequest('/admin/stats');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '加载失败');
    const s = data.stats;

    document.getElementById('stat-grid').innerHTML = `
      <div class="stat-card"><div class="stat-value">${s.total_users}</div><div class="stat-label">注册用户</div></div>
      <div class="stat-card"><div class="stat-value">${s.today_active}</div><div class="stat-label">今日活跃</div></div>
      <div class="stat-card"><div class="stat-value">${s.total_readings}</div><div class="stat-label">解读记录</div></div>
      <div class="stat-card"><div class="stat-value">${s.today_ai}</div><div class="stat-label">今日 AI 调用</div></div>
    `;

    renderTrendChart(s.daily);
    renderTypeChart(s.by_type);
    renderAiChart(s.ai_endpoints);
  } catch (e) {
    document.getElementById('stat-grid').innerHTML =
      `<div class="stat-card" style="grid-column:1/-1;">加载失败：${escapeHtml(e.message)}</div>`;
  }
}

function chartOrFallback(id, message) {
  const el = document.getElementById(id);
  if (!window.echarts) {
    el.innerHTML = `<div style="padding:40px 10px;text-align:center;color:var(--text-muted);font-size:12px;">${message}<br>（ECharts 未加载，请检查 js/echarts.min.js）</div>`;
    return null;
  }
  if (adminState.charts[id]) adminState.charts[id].dispose();
  const chart = echarts.init(el, null, { renderer: 'canvas' });
  adminState.charts[id] = chart;
  return chart;
}

function renderTrendChart(daily) {
  const chart = chartOrFallback('chart-trend', '趋势数据');
  if (!chart) return;
  const days = daily.map(d => d.day.slice(5));
  const counts = daily.map(d => d.count);
  chart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 34, right: 16, top: 20, bottom: 26 },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: '#475569' } }, axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(124,58,237,0.12)' } }, axisLabel: { color: '#94a3b8' } },
    tooltip: { trigger: 'axis' },
    series: [{
      type: 'line', data: counts, smooth: true, symbolSize: 6,
      itemStyle: { color: '#a78bfa' },
      areaStyle: { color: 'rgba(124,58,237,0.25)' }
    }]
  });
}

function renderTypeChart(byType) {
  const chart = chartOrFallback('chart-type', '类型分布');
  if (!chart) return;
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#94a3b8' } },
    series: [{
      type: 'pie', radius: ['42%', '68%'],
      data: byType.map(t => ({ name: t.type, value: t.count })),
      label: { color: '#e2e8f0' },
      itemStyle: { borderColor: '#1a1333', borderWidth: 2 }
    }],
    color: ['#a78bfa', '#f59e0b', '#22d3ee', '#34d399', '#f472b6', '#60a5fa']
  });
}

function renderAiChart(endpoints) {
  const chart = chartOrFallback('chart-ai', 'AI 调用统计');
  if (!chart) return;
  chart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 70, right: 20, top: 16, bottom: 24 },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(124,58,237,0.12)' } }, axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'category', data: endpoints.map(e => e.endpoint), axisLabel: { color: '#94a3b8' } },
    tooltip: { trigger: 'axis' },
    series: [{ type: 'bar', data: endpoints.map(e => e.count), itemStyle: { color: '#f59e0b', borderRadius: 6 } }]
  });
}

/* ---------- 用户管理 ---------- */
async function loadUsers(page = 1) {
  adminState.users.page = page;
  const keyword = document.getElementById('user-search').value.trim();
  const params = new URLSearchParams({ page, page_size: 10 });
  if (keyword) params.set('keyword', keyword);

  const res = await apiRequest(`/admin/users?${params}`);
  const data = await res.json();
  if (!data.success) return alert(data.error || '加载失败');

  adminState.users.total = data.total;
  const table = document.getElementById('user-table');
  table.innerHTML = `
    <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead>
    <tbody>${data.users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.username)}</td>
        <td><span class="badge ${u.role}">${u.role === 'admin' ? '管理员' : '用户'}</span></td>
        <td><span class="badge ${u.status}">${u.status === 'active' ? '正常' : '禁用'}</span></td>
        <td>${formatAdminDate(u.created_at)}</td>
        <td>
          <button class="admin-btn ghost" onclick="toggleUserStatus(${u.id}, '${u.status === 'active' ? 'disabled' : 'active'}')">${u.status === 'active' ? '禁用' : '启用'}</button>
          <button class="admin-btn ghost" onclick="toggleUserRole(${u.id}, '${u.role === 'admin' ? 'user' : 'admin'}')">${u.role === 'admin' ? '降为用户' : '设为管理员'}</button>
          <button class="admin-btn ghost" onclick="resetUserPassword(${u.id})">重置密码</button>
        </td>
      </tr>`).join('')}</tbody>`;
  renderPager('user-pager', adminState.users, loadUsers);
}

async function toggleUserStatus(id, status) {
  if (!confirm(`确定要${status === 'active' ? '启用' : '禁用'}该用户吗？`)) return;
  const res = await apiRequest(`/admin/users/${id}/status`, {
    method: 'PUT', body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (!data.success) return alert(data.error || '操作失败');
  loadUsers(adminState.users.page);
}

async function toggleUserRole(id, role) {
  if (!confirm(`确定要将其设为${role === 'admin' ? '管理员' : '普通用户'}吗？`)) return;
  const res = await apiRequest(`/admin/users/${id}/role`, {
    method: 'PUT', body: JSON.stringify({ role })
  });
  const data = await res.json();
  if (!data.success) return alert(data.error || '操作失败');
  loadUsers(adminState.users.page);
}

async function resetUserPassword(id) {
  const password = prompt('请输入新密码（至少 6 位）');
  if (!password) return;
  const res = await apiRequest(`/admin/users/${id}/password`, {
    method: 'PUT', body: JSON.stringify({ password })
  });
  const data = await res.json();
  alert(data.success ? '密码已重置' : (data.error || '操作失败'));
}

/* ---------- 记录管理 ---------- */
async function loadReadings(page = 1) {
  adminState.readings.page = page;
  const type = document.getElementById('reading-type').value;
  const keyword = document.getElementById('reading-search').value.trim();
  const params = new URLSearchParams({ page, page_size: 10 });
  if (type) params.set('type', type);
  if (keyword) params.set('keyword', keyword);

  const res = await apiRequest(`/admin/readings?${params}`);
  const data = await res.json();
  if (!data.success) return alert(data.error || '加载失败');

  adminState.readings.total = data.total;
  const table = document.getElementById('reading-table');
  table.innerHTML = `
    <thead><tr><th>ID</th><th>用户</th><th>类型</th><th>内容预览</th><th>时间</th><th>操作</th></tr></thead>
    <tbody>${data.readings.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${escapeHtml(r.username)}</td>
        <td>${escapeHtml(r.type)}</td>
        <td class="cell-preview" title="${escapeHtml(r.input_data).slice(0, 200)}">${escapeHtml(r.input_data).slice(0, 60)}</td>
        <td>${formatAdminDate(r.created_at)}</td>
        <td><button class="admin-btn danger" onclick="deleteReading(${r.id})">删除</button></td>
      </tr>`).join('')}</tbody>`;
  renderPager('reading-pager', adminState.readings, loadReadings);
}

async function deleteReading(id) {
  if (!confirm('确定删除这条记录吗？')) return;
  const res = await apiRequest(`/admin/readings/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) return alert(data.error || '删除失败');
  loadReadings(adminState.readings.page);
}

/* ---------- 词条管理 ---------- */
async function loadDreams(page = 1) {
  adminState.dreams.page = page;
  const keyword = document.getElementById('dream-search').value.trim();
  const params = new URLSearchParams({ page, page_size: 10 });
  if (keyword) params.set('keyword', keyword);

  const res = await apiRequest(`/admin/dreams?${params}`);
  const data = await res.json();
  if (!data.success) return alert(data.error || '加载失败');

  adminState.dreams.total = data.total;
  adminState.dreamCache = {};
  data.items.forEach(item => { adminState.dreamCache[item.id] = item; });

  const table = document.getElementById('dream-table');
  table.innerHTML = `
    <thead><tr><th>ID</th><th>标题</th><th>分类</th><th>关键词</th><th>操作</th></tr></thead>
    <tbody>${data.items.map(item => `
      <tr>
        <td>${item.id}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td class="cell-preview">${escapeHtml((item.keywords || []).join('、'))}</td>
        <td>
          <button class="admin-btn ghost" onclick="openDreamModal('${item.id}')">编辑</button>
          <button class="admin-btn danger" onclick="deleteDream('${item.id}')">删除</button>
        </td>
      </tr>`).join('')}</tbody>`;
  renderPager('dream-pager', adminState.dreams, loadDreams);
}

function openDreamModal(id) {
  const item = id ? adminState.dreamCache[id] : null;
  document.getElementById('dream-modal-title').textContent = item ? '编辑词条' : '新增词条';
  document.getElementById('dream-id').value = item ? item.id : '';
  document.getElementById('dream-title').value = item ? item.title : '';
  document.getElementById('dream-category').value = item ? item.category : '动物';
  document.getElementById('dream-keywords').value = item ? (item.keywords || []).join(',') : '';
  document.getElementById('dream-traditional').value = item ? item.traditional : '';
  document.getElementById('dream-psychology').value = item ? item.psychology : '';
  document.getElementById('dream-modal').classList.add('show');
}

function closeDreamModal() {
  document.getElementById('dream-modal').classList.remove('show');
}

async function saveDream() {
  const id = document.getElementById('dream-id').value;
  const payload = {
    title: document.getElementById('dream-title').value.trim(),
    category: document.getElementById('dream-category').value,
    keywords: document.getElementById('dream-keywords').value.trim(),
    traditional: document.getElementById('dream-traditional').value.trim(),
    psychology: document.getElementById('dream-psychology').value.trim()
  };
  if (!payload.title || !payload.traditional || !payload.psychology) {
    return alert('标题、传统解梦、心理分析都不能为空');
  }

  const res = await apiRequest(id ? `/admin/dreams/${id}` : '/admin/dreams', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!data.success) return alert(data.error || '保存失败');
  closeDreamModal();
  loadDreams(adminState.dreams.page);
}

async function deleteDream(id) {
  if (!confirm('确定删除这个词条吗？删除后不可恢复。')) return;
  const res = await apiRequest(`/admin/dreams/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) return alert(data.error || '删除失败');
  loadDreams(adminState.dreams.page);
}

/* ---------- 通用 ---------- */
function renderPager(id, state, loader) {
  const totalPages = Math.max(1, Math.ceil(state.total / 10));
  document.getElementById(id).innerHTML = `
    <button onclick="${loader.name}(${Math.max(1, state.page - 1)})" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
    <span>第 ${state.page} / ${totalPages} 页，共 ${state.total} 条</span>
    <button onclick="${loader.name}(${Math.min(totalPages, state.page + 1)})" ${state.page >= totalPages ? 'disabled' : ''}>下一页</button>`;
}

function formatAdminDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + ' UTC');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

window.addEventListener('resize', () => {
  Object.values(adminState.charts).forEach(c => c.resize());
});

if (document.getElementById('page-admin')) {
  initAdmin();
}
