const app = document.querySelector('#app');
const kinds = { question: '使用问题', feature: '功能建议', service: '服务支持' };

function projectSlug() {
  const segments = location.pathname.split('/').filter(Boolean);
  const supportIndex = segments.indexOf('support');
  const fromPath = supportIndex >= 0 ? segments[supportIndex + 1] : null;
  return normalizeProjectSlug(fromPath || new URLSearchParams(location.search).get('project') || 'obsidian-media-claim');
}

function normalizeProjectSlug(value) {
  return decodeURIComponent(String(value)).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function renderLoading() {
  app.innerHTML = '<section class="shell"><p class="loading">正在加载项目支持信息...</p></section>';
}

function renderError() {
  app.innerHTML = '<section class="shell"><h1>项目支持页不可用</h1><p>请检查访问链接是否完整，或稍后再试。</p></section>';
}

let adminState = { project: '', status: 'pending' };
const adminHeaders = () => ({ 'Content-Type': 'application/json' });

function adminRecord(record) {
  const choices = [['pending', '待审核'], ['published', '公开'], ['resolved', '已解决'], ['hidden', '隐藏']];
  return `<article class="admin-record" data-id="${escapeHtml(record.id)}"><div class="record-meta"><span class="type">${kinds[record.kind]}</span><span>${escapeHtml(record.status)}</span><time>${dateLabel(record.created_at)}</time></div><h3>${escapeHtml(record.title)}</h3><p>${escapeHtml(record.content)}</p><p class="contact"><strong>联系方式：</strong>${escapeHtml(record.contact || '未提供')}</p><form class="admin-form"><label>状态<select name="status">${choices.map(([value, label]) => `<option value="${value}" ${record.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>管理员回复<textarea name="reply" rows="3" maxlength="4000">${escapeHtml(record.reply)}</textarea></label><div class="admin-actions"><button>保存处理结果</button><p class="form-status"></p></div></form></article>`;
}

function renderAdmin(projects, records) {
  app.innerHTML = `<div class="shell admin-shell"><header class="admin-head"><div><p class="kicker">管理员审核</p><h1>项目反馈处理台</h1></div></header><section class="admin-filters"><label>项目<select id="admin-project"><option value="">全部项目</option>${projects.map((project) => `<option value="${project.slug}" ${adminState.project === project.slug ? 'selected' : ''}>${escapeHtml(project.name)}</option>`).join('')}</select></label><label>状态<select id="admin-status">${[['pending', '待审核'], ['published', '已公开'], ['resolved', '已解决'], ['hidden', '已隐藏']].map(([value, label]) => `<option value="${value}" ${adminState.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><span>${records.length} 条记录</span></section><section class="admin-records">${records.length ? records.map(adminRecord).join('') : '<p class="empty">当前筛选条件下没有记录。</p>'}</section></div>`;
  document.querySelector('#admin-project').onchange = (event) => { adminState.project = event.target.value; bootAdmin(); };
  document.querySelector('#admin-status').onchange = (event) => { adminState.status = event.target.value; bootAdmin(); };
  document.querySelectorAll('.admin-form').forEach((form) => form.addEventListener('submit', async (event) => { event.preventDefault(); const button = form.querySelector('button'); const note = form.querySelector('.form-status'); button.disabled = true; note.textContent = '正在保存...'; try { const response = await fetch(`/api/admin/feedback/${form.closest('.admin-record').dataset.id}`, { method: 'PATCH', headers: adminHeaders(), body: JSON.stringify(Object.fromEntries(new FormData(form))) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); note.textContent = '已保存。'; setTimeout(bootAdmin, 300); } catch (error) { note.textContent = error.message || '保存失败。'; button.disabled = false; } }));
}

async function bootAdmin() {
  app.innerHTML = '<section class="shell"><p class="loading">正在加载审核记录...</p></section>';
  try {
    const query = `status=${encodeURIComponent(adminState.status)}${adminState.project ? `&project=${encodeURIComponent(adminState.project)}` : ''}`;
    const [projectsResponse, feedbackResponse] = await Promise.all([fetch('/api/admin/projects', { headers: adminHeaders() }), fetch(`/api/admin/feedback?${query}`, { headers: adminHeaders() })]);
    if (!projectsResponse.ok || !feedbackResponse.ok) throw new Error(projectsResponse.status === 401 ? '登录令牌无效，请重新输入。' : '审核数据加载失败。');
    renderAdmin((await projectsResponse.json()).items, (await feedbackResponse.json()).items);
  } catch (error) { app.innerHTML = `<section class="shell"><h1>管理员验证失败</h1><p>${escapeHtml(error.message || '请检查管理员令牌。')}</p></section>`; }
}

function recordMarkup(record) {
  const status = record.status === 'resolved' ? '已解决' : '已公开';
  return `<article class="record">
    <div class="record-meta"><span class="type">${kinds[record.kind]}</span><span>${status}</span><time datetime="${record.updated_at}">${dateLabel(record.updated_at)}</time></div>
    <h3>${escapeHtml(record.title)}</h3>
    <p>${escapeHtml(record.content)}</p>
    ${record.reply ? `<div class="reply"><strong>回复</strong><p>${escapeHtml(record.reply)}</p></div>` : ''}
  </article>`;
}

function render(project, records) {
  document.title = `${project.name} - 项目支持`;
  app.innerHTML = `<div class="shell">
    <section class="support-panel">
      <header class="intro">
        <p class="kicker">项目支持</p>
        <h1>感谢你的支持。</h1>
        <p>你的支持将用于后续维护与迭代。</p>
      </header>
      <div class="payments" aria-label="支付方式">
        <article><img src="/support-assets/weixin.png" alt="微信支付二维码" /><h2>微信支付</h2></article>
        <article><img src="/support-assets/zanshangma.png" alt="微信赞赏码" /><h2>微信赞赏码</h2></article>
        <article><img src="/support-assets/zhifubao.png" alt="支付宝二维码" /><h2>支付宝</h2></article>
      </div>
    </section>

    <section class="feedback-layout" aria-labelledby="feedback-title">
      <div class="feedback-intro">
        <p class="kicker">${escapeHtml(project.name)}</p>
        <h2 id="feedback-title">使用问题、功能建议和服务支持</h2>
        <p>提交内容会先进入审核。公开页面仅展示已审核记录和处理结果。</p>
      </div>
      <form id="feedback-form" class="feedback-form">
        <fieldset><legend>记录类型</legend><div class="kind-options">
          ${Object.entries(kinds).map(([key, label], index) => `<label><input type="radio" name="kind" value="${key}" ${index === 0 ? 'checked' : ''} /><span>${label}</span></label>`).join('')}
        </div></fieldset>
        <label>标题<input name="title" required minlength="3" maxlength="120" placeholder="一句话描述你的问题或建议" /></label>
        <label>详细说明<textarea name="content" required minlength="5" maxlength="4000" rows="5" placeholder="请尽量描述使用场景、预期结果和已尝试的方法。"></textarea></label>
        <label>联系方式（可选）<input name="contact" maxlength="200" placeholder="邮箱、GitHub 或其他方便回复的方式" /></label>
        <label class="honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off" /></label>
        <button type="submit">提交记录</button>
        <p id="form-status" class="form-status" role="status"></p>
      </form>
    </section>

    <section class="records" aria-labelledby="records-title">
      <div class="section-title"><div><p class="kicker">公开记录</p><h2 id="records-title">${escapeHtml(project.name)} 的处理记录</h2></div><span>${records.length} 条</span></div>
      <div id="record-list">${records.length ? records.map(recordMarkup).join('') : '<p class="empty">暂时没有已审核的公开记录。</p>'}</div>
    </section>
  </div>`;

  document.querySelector('#feedback-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    const status = form.querySelector('#form-status');
    const data = Object.fromEntries(new FormData(form));
    button.disabled = true;
    status.textContent = '正在提交...';
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.slug)}/feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '提交失败');
      form.reset();
      status.textContent = `已提交，追踪编号：${result.trackingId.slice(0, 8)}。审核后可能会出现在公开记录中。`;
    } catch (error) {
      status.textContent = error.message || '提交失败，请稍后重试。';
    } finally {
      button.disabled = false;
    }
  });
}

async function boot() {
  if (location.pathname.startsWith('/support/admin/')) return bootAdmin();
  renderLoading();
  const slug = projectSlug();
  try {
    const [projectResponse, recordsResponse] = await Promise.all([
      fetch(`/api/projects/${encodeURIComponent(slug)}`),
      fetch(`/api/projects/${encodeURIComponent(slug)}/feedback`)
    ]);
    if (!projectResponse.ok || !recordsResponse.ok) throw new Error('Project not found');
    const project = await projectResponse.json();
    const records = (await recordsResponse.json()).items;
    render(project, records);
  } catch {
    renderError();
  }
}

boot();
