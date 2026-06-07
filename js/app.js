let currentRole = null;
let currentUser = null;
let currentPage = 'dashboard';
let currentDocId = null;
let currentFilters = {};
let currentArchiveFilters = {};
let currentSupervisionFilters = {};
let isArchiveDetail = false;

function init() {
    updateUserSelect(ROLES.OFFICE);
    const savedRole = sessionStorage.getItem('doc_flow_role');
    const savedUserId = sessionStorage.getItem('doc_flow_userid');
    if (savedRole && savedUserId) {
        const users = USERS[savedRole] || [];
        const user = users.find(u => u.id === savedUserId);
        if (user) {
            currentRole = savedRole;
            currentUser = user;
            showMainApp();
        }
    }
}

function updateUserSelect(role) {
    const select = document.getElementById('userSelect');
    const users = USERS[role] || [];
    select.innerHTML = users.map(u =>
        `<option value="${u.id}">${u.name}（${u.dept}）</option>`
    ).join('');
}

function login(role) {
    currentRole = role;
    updateUserSelect(role);
    const select = document.getElementById('userSelect');
    const userId = select.value;
    const users = USERS[role] || [];
    currentUser = users.find(u => u.id === userId) || users[0];

    sessionStorage.setItem('doc_flow_role', role);
    sessionStorage.setItem('doc_flow_userid', currentUser.id);

    showMainApp();
    showToast(`欢迎，${currentUser.name}！`);
}

function logout() {
    currentRole = null;
    currentUser = null;
    currentPage = 'dashboard';
    sessionStorage.removeItem('doc_flow_role');
    sessionStorage.removeItem('doc_flow_userid');

    document.getElementById('header').classList.add('hidden');
    document.getElementById('contentArea').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
}

function showMainApp() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('header').classList.remove('hidden');
    document.getElementById('contentArea').classList.remove('hidden');

    document.getElementById('userRoleLabel').textContent = ROLE_LABELS[currentRole];
    document.getElementById('userNameLabel').textContent = currentUser.name;

    renderNav();
    renderDashboard();
}

function renderNav() {
    const nav = document.getElementById('navMenu');
    let menuItems = [];

    menuItems.push({ key: 'dashboard', label: '工作台', icon: '🏠' });
    menuItems.push({ key: 'list', label: '公文列表', icon: '📋' });
    menuItems.push({ key: 'supervision', label: '督办预警中心', icon: '⚠️' });

    if (currentRole === ROLES.OFFICE) {
        menuItems.push({ key: 'register', label: '收文登记', icon: '✍️' });
        menuItems.push({ key: 'archive', label: '归档库', icon: '📦' });
    }

    if (currentRole === ROLES.LEADER || currentRole === ROLES.STAFF) {
        menuItems.push({ key: 'templates', label: '常用意见模板', icon: '📝' });
    }

    const unreadCount = messageStore.getUnreadCount(currentRole, currentUser);
    const unreadBadge = unreadCount > 0 ? `<span class="nav-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : '';
    menuItems.push({ key: 'messages', label: '消息中心', icon: '🔔', badge: unreadBadge });

    nav.innerHTML = `<div class="nav-menu-inner">
        ${menuItems.map(item => `
            <div class="nav-item ${currentPage === item.key ? 'active' : ''}"
                 onclick="navigateTo('${item.key}')">
                <span class="nav-icon">${item.icon}</span>
                <span class="nav-label">${item.label}</span>
                ${item.badge || ''}
            </div>
        `).join('')}
    </div>`;
}

function navigateTo(page, params = {}) {
    currentPage = page;
    renderNav();
    const content = document.getElementById('contentArea');

    switch (page) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'list':
            renderDocList();
            break;
        case 'supervision':
            renderSupervisionCenter();
            break;
        case 'register':
            renderRegisterForm();
            break;
        case 'archive':
            renderArchiveList();
            break;
        case 'templates':
            renderTemplateList();
            break;
        case 'messages':
            renderMessageList();
            break;
        case 'detail':
            currentDocId = params.id;
            isArchiveDetail = params.fromArchive || false;
            renderDocDetail();
            break;
    }
}

function renderDashboard() {
    const stats = dataStore.getStats(currentRole, currentUser);
    const supStats = dataStore.getSupervisionStats(currentRole, currentUser);
    const content = document.getElementById('contentArea');

    let pendingList = [];
    if (currentRole === ROLES.OFFICE) {
        pendingList = dataStore.listDocs()
            .filter(d => d.currentNode === FLOW_NODES.COMPLETE && !d.archived)
            .slice(0, 5);
    } else if (currentRole === ROLES.LEADER) {
        pendingList = dataStore.listDocs()
            .filter(d => d.currentNode === FLOW_NODES.PROPOSE || d.currentNode === FLOW_NODES.ASSIGN)
            .slice(0, 5);
    } else if (currentRole === ROLES.STAFF) {
        pendingList = dataStore.listDocs()
            .filter(d => (d.currentNode === FLOW_NODES.HANDLE || d.currentNode === FLOW_NODES.FEEDBACK)
                && d.assignedUser === currentUser.id)
            .slice(0, 5);
    }

    const warningDocs = dataStore.listSupervisionDocs()
        .filter(d => getWarningStatus(d) === WARNING_STATUS.OVERDUE || getWarningStatus(d) === WARNING_STATUS.APPROACHING)
        .slice(0, 5);

    const recentList = dataStore.listDocs().slice(0, 5);
    const recentMessages = messageStore.getRecentMessages(currentRole, currentUser, 5);
    const unreadCount = messageStore.getUnreadCount(currentRole, currentUser);

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">工作台</h2>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon blue">📊</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">公文总数</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon orange">⏳</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.processing}</div>
                    <div class="stat-label">办理中</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon green">✅</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.completed}</div>
                    <div class="stat-label">已办结</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon red">📌</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.myPending}</div>
                    <div class="stat-label">待我处理</div>
                </div>
            </div>
        </div>

        <div class="stats-grid warning-stats">
            <div class="stat-card warning-card-normal">
                <div class="stat-icon green">🟢</div>
                <div class="stat-info">
                    <div class="stat-number">${supStats.normal}</div>
                    <div class="stat-label">正常办理</div>
                </div>
            </div>
            <div class="stat-card warning-card-approaching">
                <div class="stat-icon orange">🟠</div>
                <div class="stat-info">
                    <div class="stat-number">${supStats.approaching}</div>
                    <div class="stat-label">临期预警</div>
                </div>
            </div>
            <div class="stat-card warning-card-overdue">
                <div class="stat-icon red">🔴</div>
                <div class="stat-info">
                    <div class="stat-number">${supStats.overdue}</div>
                    <div class="stat-label">超期督办</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">预警公文</span>
                <a class="action-link" onclick="navigateTo('supervision')">查看全部 →</a>
            </div>
            <div class="card-body" style="padding:0;">
                ${warningDocs.length > 0 ? `
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>文号</th>
                                    <th>标题</th>
                                    <th>紧急程度</th>
                                    <th>承办科室</th>
                                    <th>承办人</th>
                                    <th>剩余时间</th>
                                    <th>预警状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${warningDocs.map(doc => `
                                    <tr>
                                        <td>${doc.id}</td>
                                        <td class="td-ellipsis" title="${doc.title}">${doc.title}</td>
                                        <td>${getPriorityLabel(doc.priority)}</td>
                                        <td>${doc.assignedDept || '-'}</td>
                                        <td>${doc.assignedUserName || '-'}</td>
                                        <td>${renderRemainingTime(doc)}</td>
                                        <td><span class="warning-badge ${getWarningStatusClass(doc)}">${getWarningStatusLabel(doc)}</span></td>
                                        <td><a class="action-link" onclick="navigateTo('detail', {id: '${doc.id}'})">查看</a></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><div class="empty-icon">✅</div><p>暂无预警公文</p></div>'}
            </div>
        </div>

        <div class="dashboard-row">
            <div class="card dashboard-card">
                <div class="card-header">
                    <span class="card-title">待我处理</span>
                    <a class="action-link" onclick="navigateTo('list')">查看全部 →</a>
                </div>
                <div class="card-body" style="padding:0;">
                    ${pendingList.length > 0 ? `
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>文号</th>
                                    <th>标题</th>
                                    <th>状态</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pendingList.map(doc => `
                                    <tr>
                                        <td>${doc.id}</td>
                                        <td class="td-ellipsis" title="${doc.title}">${doc.title}</td>
                                        <td><span class="status-badge ${getDocStatusClass(doc)}">${getDocStatusLabel(doc)}</span></td>
                                        <td><a class="action-link" onclick="navigateTo('detail', {id: '${doc.id}'})">办理</a></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<div class="empty-state"><div class="empty-icon">🎉</div><p>暂无待处理公文</p></div>'}
                </div>
            </div>

            <div class="card dashboard-card">
                <div class="card-header">
                    <span class="card-title">系统消息</span>
                    <div style="display:flex; align-items:center; gap:12px;">
                        ${unreadCount > 0 ? `<span class="unread-count">${unreadCount} 条未读</span>` : ''}
                        <a class="action-link" onclick="navigateTo('messages')">查看全部 →</a>
                    </div>
                </div>
                <div class="card-body" style="padding:0;">
                    ${recentMessages.length > 0 ? `
                        <div class="message-list">
                            ${recentMessages.map(msg => `
                                <div class="message-item ${msg.read ? '' : 'unread'}" onclick="handleMessageClick('${msg.id}', '${msg.docId}')">
                                    <div class="message-icon msg-${msg.type}">${getMessageIcon(msg.type)}</div>
                                    <div class="message-content">
                                        <div class="message-title">
                                            ${msg.read ? '' : '<span class="message-dot"></span>'}
                                            ${msg.title}
                                        </div>
                                        <div class="message-desc">${msg.content}</div>
                                        <div class="message-time">${formatDateTime(msg.createdAt)}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<div class="empty-state"><div class="empty-icon">🔔</div><p>暂无消息</p></div>'}
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">最近公文</span>
            </div>
            <div class="card-body" style="padding:0;">
                ${recentList.length > 0 ? `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>文号</th>
                                <th>标题</th>
                                <th>来文单位</th>
                                <th>当前状态</th>
                                <th>登记时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentList.map(doc => `
                                <tr>
                                    <td>${doc.id}</td>
                                    <td>${doc.title}</td>
                                    <td>${doc.fromUnit}</td>
                                    <td><span class="status-badge ${getDocStatusClass(doc)}">${getDocStatusLabel(doc)}</span></td>
                                    <td>${formatDate(doc.createdAt)}</td>
                                    <td><a class="action-link" onclick="navigateTo('detail', {id: '${doc.id}'})">查看</a></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div class="empty-state"><p>暂无公文</p></div>'}
            </div>
        </div>
    `;
}

function renderRemainingTime(doc) {
    const remainingDays = getRemainingDays(doc);
    if (remainingDays === null) return '-';

    if (remainingDays < 0) {
        return `<span class="overdue-text">超期 ${Math.abs(remainingDays)} 天</span>`;
    } else if (remainingDays === 0) {
        return `<span class="approaching-text">今日到期</span>`;
    } else if (remainingDays === 1) {
        return `<span class="approaching-text">剩余 1 天</span>`;
    }
    return `剩余 ${remainingDays} 天`;
}

function renderDocList() {
    const content = document.getElementById('contentArea');

    let statusOptions = [
        { value: '', label: '全部状态' }
    ];

    Object.keys(NODE_LABELS).forEach(node => {
        statusOptions.push({ value: node, label: getStatusLabelByNode(node) });
    });

    let deptOptions = [{ value: '', label: '全部科室' }];
    DEPARTMENTS.forEach(d => deptOptions.push({ value: d, label: d }));

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">公文列表</h2>
            ${currentRole === ROLES.OFFICE ? '<button class="btn btn-primary" onclick="navigateTo(\'register\')">+ 收文登记</button>' : ''}
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar">
                    <div class="form-group">
                        <label class="form-label">关键词</label>
                        <input type="text" class="form-input" id="searchKeyword" placeholder="文号、标题、来文单位"
                               onkeyup="if(event.key==='Enter') applyFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">状态</label>
                        <select class="form-select" id="searchStatus" onchange="applyFilters()">
                            ${statusOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="applyFilters()">🔍 查询</button>
                    <button class="btn btn-default" onclick="resetFilters()">重置</button>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;" id="docListTable">
                ${renderDocTable()}
            </div>
        </div>
    `;
}

function applyFilters() {
    currentFilters = {
        keyword: document.getElementById('searchKeyword').value.trim(),
        status: document.getElementById('searchStatus').value
    };
    document.getElementById('docListTable').innerHTML = renderDocTable();
}

function resetFilters() {
    currentFilters = {};
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchStatus').value = '';
    document.getElementById('docListTable').innerHTML = renderDocTable();
}

function renderDocTable() {
    const docs = dataStore.listDocs(currentFilters);

    if (docs.length === 0) {
        return '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无符合条件的公文</p></div>';
    }

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>文号</th>
                        <th>标题</th>
                        <th>来文单位</th>
                        <th>紧急程度</th>
                        <th>当前状态</th>
                        <th>剩余时间</th>
                        <th>预警状态</th>
                        ${currentRole === ROLES.STAFF ? '<th>承办科室</th>' : ''}
                        <th>登记时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${docs.map(doc => `
                        <tr>
                            <td>${doc.id}</td>
                            <td>${doc.title}</td>
                            <td>${doc.fromUnit}</td>
                            <td>${getPriorityLabel(doc.priority)}</td>
                            <td><span class="status-badge ${getDocStatusClass(doc)}">${getDocStatusLabel(doc)}</span></td>
                            <td>${renderRemainingTime(doc)}</td>
                            <td>${doc.deadline ? `<span class="warning-badge ${getWarningStatusClass(doc)}">${getWarningStatusLabel(doc)}</span>` : '-'}</td>
                            ${currentRole === ROLES.STAFF ? `<td>${doc.assignedDept || '-'}</td>` : ''}
                            <td>${formatDate(doc.createdAt)}</td>
                            <td>
                                <div class="actions">
                                    <a class="action-link" onclick="navigateTo('detail', {id: '${doc.id}'})">查看</a>
                                    ${dataStore.canOperate(doc, currentRole, currentUser) ?
                                        `<a class="action-link" onclick="navigateTo('detail', {id: '${doc.id}'})">办理</a>` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderArchiveList() {
    const content = document.getElementById('contentArea');

    const categoryOptions = [
        { value: '', label: '全部类别' },
        { value: '通知', label: '通知' },
        { value: '请示', label: '请示' },
        { value: '报告', label: '报告' },
        { value: '批复', label: '批复' },
        { value: '函', label: '函' },
        { value: '会议纪要', label: '会议纪要' },
        { value: '其他', label: '其他' }
    ];

    const deptOptions = [{ value: '', label: '全部科室' }];
    DEPARTMENTS.forEach(d => {
        if (d !== '办公室') {
            deptOptions.push({ value: d, label: d });
        }
    });

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">归档库</h2>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="archive-search-bar">
                    <div class="form-group">
                        <label class="form-label">标题</label>
                        <input type="text" class="form-input" id="archiveTitle" placeholder="请输入标题关键词"
                               onkeyup="if(event.key==='Enter') applyArchiveFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">文号</label>
                        <input type="text" class="form-input" id="archiveDocNumber" placeholder="请输入文号关键词"
                               onkeyup="if(event.key==='Enter') applyArchiveFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">来文单位</label>
                        <input type="text" class="form-input" id="archiveFromUnit" placeholder="请输入来文单位"
                               onkeyup="if(event.key==='Enter') applyArchiveFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">公文类别</label>
                        <select class="form-select" id="archiveCategory" onchange="applyArchiveFilters()">
                            ${categoryOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">承办科室</label>
                        <select class="form-select" id="archiveDept" onchange="applyArchiveFilters()">
                            ${deptOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="search-actions">
                        <button class="btn btn-primary" onclick="applyArchiveFilters()">🔍 查询</button>
                        <button class="btn btn-default" onclick="resetArchiveFilters()">重置</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;" id="archiveListTable">
                ${renderArchiveTable()}
            </div>
        </div>
    `;
}

function applyArchiveFilters() {
    currentArchiveFilters = {
        title: document.getElementById('archiveTitle').value.trim(),
        docNumber: document.getElementById('archiveDocNumber').value.trim(),
        fromUnit: document.getElementById('archiveFromUnit').value.trim(),
        category: document.getElementById('archiveCategory').value,
        assignedDept: document.getElementById('archiveDept').value
    };
    document.getElementById('archiveListTable').innerHTML = renderArchiveTable();
}

function resetArchiveFilters() {
    currentArchiveFilters = {};
    document.getElementById('archiveTitle').value = '';
    document.getElementById('archiveDocNumber').value = '';
    document.getElementById('archiveFromUnit').value = '';
    document.getElementById('archiveCategory').value = '';
    document.getElementById('archiveDept').value = '';
    document.getElementById('archiveListTable').innerHTML = renderArchiveTable();
}

function renderArchiveTable() {
    const docs = dataStore.listArchivedDocs(currentArchiveFilters);

    if (docs.length === 0) {
        return '<div class="empty-state"><div class="empty-icon">📦</div><p>暂无归档公文</p></div>';
    }

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>文号</th>
                        <th>标题</th>
                        <th>来文单位</th>
                        <th>公文类别</th>
                        <th>承办科室</th>
                        <th>归档时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${docs.map(doc => {
                        const completeRecord = doc.flowRecords.find(r => r.node === FLOW_NODES.COMPLETE);
                        const archiveTime = completeRecord ? completeRecord.time : doc.createdAt;
                        return `
                        <tr>
                            <td>${doc.id}</td>
                            <td>${doc.title}</td>
                            <td>${doc.fromUnit}</td>
                            <td>${doc.category || '-'}</td>
                            <td>${doc.assignedDept ? `<span class="dept-tag">${doc.assignedDept}</span>` : '-'}</td>
                            <td>${formatDate(archiveTime)}</td>
                            <td>
                                <a class="action-link" onclick="navigateTo('detail', {id: '${doc.id}', fromArchive: true})">查看详情</a>
                            </td>
                        </tr>
                    `;}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderSupervisionCenter() {
    const content = document.getElementById('contentArea');
    const supStats = dataStore.getSupervisionStats(currentRole, currentUser);

    const warningOptions = [
        { value: '', label: '全部预警状态' },
        { value: WARNING_STATUS.OVERDUE, label: '超期' },
        { value: WARNING_STATUS.APPROACHING, label: '临期' },
        { value: WARNING_STATUS.NORMAL, label: '正常' }
    ];

    const deptOptions = [{ value: '', label: '全部科室' }];
    DEPARTMENTS.forEach(d => {
        if (d !== '办公室') {
            deptOptions.push({ value: d, label: d });
        }
    });

    const staffOptions = [{ value: '', label: '全部承办人' }];

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">督办预警中心</h2>
            ${currentRole === ROLES.OFFICE ? '<div class="page-subtitle">办公室督办管理 · 可对超期公文追加督办记录</div>' : ''}
        </div>

        <div class="stats-grid supervision-stats-grid">
            <div class="stat-card warning-card-normal">
                <div class="stat-icon green">🟢</div>
                <div class="stat-info">
                    <div class="stat-number">${supStats.normal}</div>
                    <div class="stat-label">正常办理</div>
                </div>
            </div>
            <div class="stat-card warning-card-approaching">
                <div class="stat-icon orange">🟠</div>
                <div class="stat-info">
                    <div class="stat-number">${supStats.approaching}</div>
                    <div class="stat-label">临期预警</div>
                </div>
            </div>
            <div class="stat-card warning-card-overdue">
                <div class="stat-icon red">🔴</div>
                <div class="stat-info">
                    <div class="stat-number">${supStats.overdue}</div>
                    <div class="stat-label">超期督办</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar supervision-search-bar">
                    <div class="form-group">
                        <label class="form-label">关键词</label>
                        <input type="text" class="form-input" id="supKeyword" placeholder="文号、标题、来文单位"
                               onkeyup="if(event.key==='Enter') applySupervisionFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">承办科室</label>
                        <select class="form-select" id="supDept" onchange="updateSupervisionStaffOptions(); applySupervisionFilters()">
                            ${deptOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">承办人</label>
                        <select class="form-select" id="supStaff" onchange="applySupervisionFilters()">
                            ${staffOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">预警状态</label>
                        <select class="form-select" id="supWarningStatus" onchange="applySupervisionFilters()">
                            ${warningOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="applySupervisionFilters()">🔍 查询</button>
                    <button class="btn btn-default" onclick="resetSupervisionFilters()">重置</button>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;" id="supervisionListTable">
                ${renderSupervisionTable()}
            </div>
        </div>
    `;
}

function applySupervisionFilters() {
    currentSupervisionFilters = {
        keyword: document.getElementById('supKeyword').value.trim(),
        assignedDept: document.getElementById('supDept').value,
        assignedUser: document.getElementById('supStaff').value,
        warningStatus: document.getElementById('supWarningStatus').value
    };
    document.getElementById('supervisionListTable').innerHTML = renderSupervisionTable();
}

function resetSupervisionFilters() {
    currentSupervisionFilters = {};
    document.getElementById('supKeyword').value = '';
    document.getElementById('supDept').value = '';
    document.getElementById('supStaff').value = '';
    document.getElementById('supWarningStatus').value = '';
    document.getElementById('supervisionListTable').innerHTML = renderSupervisionTable();
}

function updateSupervisionStaffOptions() {
    const dept = document.getElementById('supDept').value;
    const staffSelect = document.getElementById('supStaff');

    let options = '<option value="">全部承办人</option>';

    if (dept) {
        const staff = USERS[ROLES.STAFF].filter(u => u.dept === dept);
        staff.forEach(s => {
            options += `<option value="${s.id}">${s.name}</option>`;
        });
    } else {
        USERS[ROLES.STAFF].forEach(s => {
            options += `<option value="${s.id}">${s.name}（${s.dept}）</option>`;
        });
    }

    staffSelect.innerHTML = options;
}

function renderSupervisionTable() {
    const docs = dataStore.listSupervisionDocs(currentSupervisionFilters);

    if (docs.length === 0) {
        return '<div class="empty-state"><div class="empty-icon">📋</div><p>暂无符合条件的公文</p></div>';
    }

    const canSuperviseAll = currentRole === ROLES.OFFICE;

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>文号</th>
                        <th>标题</th>
                        <th>紧急程度</th>
                        <th>承办科室</th>
                        <th>承办人</th>
                        <th>当前状态</th>
                        <th>办理期限</th>
                        <th>剩余时间</th>
                        <th>预警状态</th>
                        <th>督办次数</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${docs.map(doc => `
                        <tr class="${getWarningStatusClass(doc) ? 'row-' + getWarningStatusClass(doc) : ''}">
                            <td>${doc.id}</td>
                            <td class="td-ellipsis" title="${doc.title}">${doc.title}</td>
                            <td>${getPriorityLabel(doc.priority)}</td>
                            <td>${doc.assignedDept || '-'}</td>
                            <td>${doc.assignedUserName || '-'}</td>
                            <td><span class="status-badge ${getDocStatusClass(doc)}">${getDocStatusLabel(doc)}</span></td>
                            <td>${doc.deadline ? formatDate(doc.deadline) : '-'}</td>
                            <td>${renderRemainingTime(doc)}</td>
                            <td>${doc.deadline ? `<span class="warning-badge ${getWarningStatusClass(doc)}">${getWarningStatusLabel(doc)}</span>` : '-'}</td>
                            <td>
                                ${doc.supervisionRecords && doc.supervisionRecords.length > 0
                                    ? `<span class="sup-count">${doc.supervisionRecords.length}</span>`
                                    : '<span style="color:#999;">0</span>'}
                            </td>
                            <td>
                                <div class="actions">
                                    <a class="action-link" onclick="navigateTo('detail', {id: '${doc.id}'})">查看</a>
                                    ${canSuperviseAll && doc.currentNode !== FLOW_NODES.REGISTER && !(doc.currentNode === FLOW_NODES.COMPLETE && doc.archived)
                                        ? `<a class="action-link action-supervise" onclick="quickSupervise('${doc.id}')">督办</a>`
                                        : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function quickSupervise(docId) {
    currentDocId = docId;
    showSuperviseModal();
}

function renderRegisterForm() {
    const content = document.getElementById('contentArea');

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">收文登记</h2>
            <button class="btn btn-default" onclick="navigateTo('list')">返回列表</button>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="detail-grid">
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span>公文标题</label>
                        <input type="text" class="form-input" id="regTitle" placeholder="请输入公文标题">
                    </div>
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span>来文单位</label>
                        <input type="text" class="form-input" id="regFromUnit" placeholder="请输入来文单位">
                    </div>
                    <div class="form-group">
                        <label class="form-label">来文字号</label>
                        <input type="text" class="form-input" id="regDocNumber" placeholder="如：市政办发〔2025〕1号">
                    </div>
                    <div class="form-group">
                        <label class="form-label">来文日期</label>
                        <input type="date" class="form-input" id="regDocDate">
                    </div>
                    <div class="form-group">
                        <label class="form-label">紧急程度</label>
                        <select class="form-select" id="regPriority">
                            <option value="normal">普通</option>
                            <option value="high">加急</option>
                            <option value="urgent">特急</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">公文类别</label>
                        <select class="form-select" id="regCategory">
                            <option value="">请选择</option>
                            <option value="通知">通知</option>
                            <option value="请示">请示</option>
                            <option value="报告">报告</option>
                            <option value="批复">批复</option>
                            <option value="函">函</option>
                            <option value="会议纪要">会议纪要</option>
                            <option value="其他">其他</option>
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <label class="form-label">公文内容摘要</label>
                        <textarea class="form-textarea" id="regContent" rows="4" placeholder="请输入公文内容摘要"></textarea>
                    </div>
                    <div class="form-group full-width">
                        <label class="form-label">附件上传</label>
                        <div class="upload-area" onclick="document.getElementById('regAttachments').click()">
                            <div class="upload-icon">📎</div>
                            <div class="upload-text">点击上传附件，或拖拽文件到此处</div>
                            <input type="file" id="regAttachments" multiple onchange="handleFileSelect(this, 'regAttachmentsList')">
                        </div>
                        <div class="attachment-list" id="regAttachmentsList" style="margin-top:12px;"></div>
                    </div>
                </div>

                <div style="margin-top:24px; text-align:right;">
                    <button class="btn btn-default" onclick="navigateTo('list')" style="margin-right:8px;">取消</button>
                    <button class="btn btn-primary btn-lg" onclick="submitRegister()">提交登记</button>
                </div>
            </div>
        </div>
    `;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('regDocDate').value = today;
}

let registerAttachments = [];

function handleFileSelect(input, listId) {
    const files = input.files;
    const list = document.getElementById(listId);

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachment = {
            name: file.name,
            size: formatFileSize(file.size),
            id: 'att_' + Date.now() + '_' + i
        };

        if (listId === 'regAttachmentsList') {
            registerAttachments.push(attachment);
        }

        const item = document.createElement('div');
        item.className = 'attachment-item';
        item.innerHTML = `
            <span class="attachment-icon">📄</span>
            <span class="attachment-name">${attachment.name}</span>
            <span class="attachment-size">${attachment.size}</span>
            <a class="action-link" onclick="this.parentElement.remove(); removeAttachment('${attachment.id}', '${listId}')">删除</a>
        `;
        list.appendChild(item);
    }

    input.value = '';
}

function removeAttachment(id, listId) {
    if (listId === 'regAttachmentsList') {
        registerAttachments = registerAttachments.filter(a => a.id !== id);
    }
}

function submitRegister() {
    const title = document.getElementById('regTitle').value.trim();
    const fromUnit = document.getElementById('regFromUnit').value.trim();

    if (!title) {
        showToast('请输入公文标题', 'error');
        return;
    }
    if (!fromUnit) {
        showToast('请输入来文单位', 'error');
        return;
    }

    const docData = {
        title: title,
        fromUnit: fromUnit,
        docNumber: document.getElementById('regDocNumber').value.trim(),
        docDate: document.getElementById('regDocDate').value,
        priority: document.getElementById('regPriority').value,
        category: document.getElementById('regCategory').value,
        content: document.getElementById('regContent').value.trim(),
        attachments: registerAttachments
    };

    const doc = dataStore.createDoc(docData, currentUser);
    registerAttachments = [];

    showToast('收文登记成功！');
    navigateTo('detail', { id: doc.id });
}

function renderDocDetail() {
    const doc = dataStore.getDoc(currentDocId);
    if (!doc) {
        document.getElementById('contentArea').innerHTML = '<div class="empty-state"><p>公文不存在</p></div>';
        return;
    }

    const canOperate = dataStore.canOperate(doc, currentRole, currentUser) && !isArchiveDetail;
    const canSupervise = dataStore.canSupervise(doc, currentRole, currentUser) && !isArchiveDetail;
    const content = document.getElementById('contentArea');

    let actionButton = '';
    if (canOperate) {
        const actionLabels = {
            [FLOW_NODES.PROPOSE]: '填写拟办意见',
            [FLOW_NODES.ASSIGN]: '分办指派',
            [FLOW_NODES.HANDLE]: '开始承办',
            [FLOW_NODES.FEEDBACK]: '提交反馈',
            [FLOW_NODES.COMPLETE]: '办结归档'
        };
        actionButton = `<button class="btn btn-primary" onclick="showOperateModal()">${actionLabels[doc.currentNode] || '办理'}</button>`;
    }

    let superviseButton = '';
    if (canSupervise) {
        superviseButton = `<button class="btn btn-warning" onclick="showSuperviseModal()">📢 督办</button>`;
    }

    const backPage = isArchiveDetail ? 'archive' : 'list';
    const backLabel = isArchiveDetail ? '返回归档库' : '返回列表';

    let statusBadgeExtra = '';
    if (isArchiveDetail || (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived)) {
        statusBadgeExtra = '<span class="archive-badge">已归档</span>';
    }

    const warningBadge = doc.deadline && !isArchiveDetail && !(doc.currentNode === FLOW_NODES.COMPLETE && doc.archived)
        ? `<span class="warning-badge ${getWarningStatusClass(doc)}">${getWarningStatusLabel(doc)}</span>`
        : '';

    const registerRecord = doc.flowRecords.find(r => r.node === FLOW_NODES.REGISTER);
    const proposeRecord = doc.flowRecords.find(r => r.node === FLOW_NODES.PROPOSE);
    const assignRecord = doc.flowRecords.find(r => r.node === FLOW_NODES.ASSIGN);

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">${isArchiveDetail ? '归档详情' : '公文详情'}</h2>
            <div>
                <button class="btn btn-default" onclick="navigateTo('${backPage}')" style="margin-right:8px;">${backLabel}</button>
                ${superviseButton ? superviseButton + ' ' : ''}
                ${actionButton}
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">基本信息</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    ${statusBadgeExtra}
                    ${warningBadge}
                    <span class="status-badge ${getDocStatusClass(doc)}">${getDocStatusLabel(doc)}</span>
                </div>
            </div>
            <div class="card-body">
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">文号</span>
                        <span class="detail-value"><strong>${doc.id}</strong></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">公文类别</span>
                        <span class="detail-value">${doc.category || '-'}</span>
                    </div>
                    <div class="detail-item full-width">
                        <span class="detail-label">标题</span>
                        <span class="detail-value" style="font-size:16px; font-weight:600;">${doc.title}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">来文单位</span>
                        <span class="detail-value">${doc.fromUnit}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">来文字号</span>
                        <span class="detail-value">${doc.docNumber || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">来文日期</span>
                        <span class="detail-value">${doc.docDate || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">紧急程度</span>
                        <span class="detail-value">${getPriorityLabel(doc.priority)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">办理期限</span>
                        <span class="detail-value">
                            ${doc.deadline ? formatDate(doc.deadline) : '-'}
                            ${doc.deadline && !isArchiveDetail && !(doc.currentNode === FLOW_NODES.COMPLETE && doc.archived) ? `（${renderRemainingTime(doc)}）` : ''}
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">登记人</span>
                        <span class="detail-value">${doc.createdByName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">登记时间</span>
                        <span class="detail-value">${formatDateTime(doc.createdAt)}</span>
                    </div>
                    ${doc.assignedDept ? `
                    <div class="detail-item">
                        <span class="detail-label">承办科室</span>
                        <span class="detail-value"><span class="dept-tag">${doc.assignedDept}</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">承办人</span>
                        <span class="detail-value">${doc.assignedUserName || '-'}</span>
                    </div>
                    ` : ''}
                    <div class="detail-item full-width">
                        <span class="detail-label">内容摘要</span>
                        <span class="detail-value" style="white-space:pre-wrap; line-height:1.8;">${doc.content || '暂无内容摘要'}</span>
                    </div>
                    ${registerRecord && registerRecord.attachments && registerRecord.attachments.length > 0 ? `
                    <div class="detail-item full-width">
                        <span class="detail-label">原文附件</span>
                        <div class="attachment-list">
                            ${registerRecord.attachments.map(a => `
                                <div class="attachment-item">
                                    <span class="attachment-icon">📎</span>
                                    <span class="attachment-name">${a.name}</span>
                                    <span class="attachment-size">${a.size}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>

        ${!isArchiveDetail && doc.supervisionRecords && doc.supervisionRecords.length > 0 ? `
        <div class="card">
            <div class="card-header">
                <span class="card-title">督办记录</span>
                <span class="badge-count">${doc.supervisionRecords.length} 条</span>
            </div>
            <div class="card-body">
                ${renderSupervisionTimeline(doc)}
            </div>
        </div>
        ` : ''}

        <div class="card">
            <div class="card-header">
                <span class="card-title">流转记录</span>
            </div>
            <div class="card-body">
                ${renderTimeline(doc)}
            </div>
        </div>
    `;
}

function renderSupervisionTimeline(doc) {
    const records = doc.supervisionRecords || [];
    if (records.length === 0) return '';

    let html = '<div class="supervision-timeline">';

    records.slice().reverse().forEach(record => {
        html += `
            <div class="supervision-item">
                <div class="supervision-dot">📢</div>
                <div class="supervision-content">
                    <div class="supervision-header">
                        <span class="supervision-operator">${record.operatorName}（${record.operatorDept}）</span>
                        <span class="supervision-time">${formatDateTime(record.time)}</span>
                    </div>
                    <div class="supervision-text">${record.content}</div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

function renderTimeline(doc) {
    const nodes = Object.values(FLOW_NODES);

    let html = '<div class="timeline">';

    nodes.forEach((node, index) => {
        const record = doc.flowRecords.find(r => r.node === node);
        const isCompleted = !!record;
        const isCurrent = doc.currentNode === node && !isCompleted;
        const isPending = nodes.indexOf(doc.currentNode) < index;

        let dotClass = '';
        if (isCompleted) {
            dotClass = 'completed';
        } else if (isCurrent || isPending) {
            dotClass = 'pending';
        }

        let contentHtml = '';
        if (isCompleted && record) {
            contentHtml = `
                <div class="timeline-content">
                    <div class="timeline-title">${NODE_LABELS[node]}</div>
                    <div class="timeline-meta">
                        ${record.operatorName}（${record.operatorDept}） · ${formatDateTime(record.time)}
                    </div>
                    ${record.comment ? `<div class="timeline-comment">${record.comment}</div>` : ''}
                    ${record.assignedDept ? `<div class="timeline-meta" style="margin-top:6px;">分派至：${record.assignedDept} - ${record.assignedUserName}</div>` : ''}
                    ${record.attachments && record.attachments.length > 0 ? `
                        <div class="timeline-attachment">
                            <div style="font-size:12px; color:#888; margin-bottom:4px;">附件：</div>
                            ${record.attachments.map(a => `
                                <div class="attachment-item" style="padding:4px 8px;">
                                    <span class="attachment-icon" style="font-size:16px;">📎</span>
                                    <span class="attachment-name">${a.name}</span>
                                    <span class="attachment-size">${a.size}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (isCurrent) {
            contentHtml = `
                <div class="timeline-content" style="opacity:0.7;">
                    <div class="timeline-title">${NODE_LABELS[node]}</div>
                    <div class="timeline-meta">等待处理中...</div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="timeline-content" style="opacity:0.4;">
                    <div class="timeline-title">${NODE_LABELS[node]}</div>
                    <div class="timeline-meta">未开始</div>
                </div>
            `;
        }

        html += `
            <div class="timeline-item">
                <div class="timeline-dot ${dotClass}"></div>
                ${contentHtml}
            </div>
        `;
    });

    html += '</div>';
    return html;
}

let operateAttachments = [];

function showOperateModal() {
    const doc = dataStore.getDoc(currentDocId);
    if (!doc) return;

    operateAttachments = [];

    let title = '';
    let bodyHtml = '';

    switch (doc.currentNode) {
        case FLOW_NODES.PROPOSE:
            title = '拟办批示';
            bodyHtml = `
                ${renderTemplateSelector(TEMPLATE_TYPES.PROPOSE)}
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span>批示意见</label>
                    <textarea class="form-textarea" id="opComment" rows="5" placeholder="请输入拟办批示意见..."></textarea>
                </div>
                <p style="color:#888; font-size:12px;">批示后将进入分办环节，由领导指派承办科室。</p>
            `;
            break;

        case FLOW_NODES.ASSIGN:
            title = '分办指派';
            const deptOptions = DEPARTMENTS.filter(d => d !== '局领导').map(d => `<option value="${d}">${d}</option>`).join('');
            bodyHtml = `
                ${renderTemplateSelector(TEMPLATE_TYPES.ASSIGN)}
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span>批示意见</label>
                    <textarea class="form-textarea" id="opComment" rows="3" placeholder="请输入分办批示意见..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span>承办科室</label>
                    <select class="form-select" id="opDept" onchange="updateStaffOptions()">
                        <option value="">请选择科室</option>
                        ${deptOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span>承办人</label>
                    <select class="form-select" id="opStaff">
                        <option value="">请先选择科室</option>
                    </select>
                </div>
            `;
            break;

        case FLOW_NODES.HANDLE:
            title = '承办办理';
            bodyHtml = `
                ${renderTemplateSelector(TEMPLATE_TYPES.HANDLE)}
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span>办理意见</label>
                    <textarea class="form-textarea" id="opComment" rows="5" placeholder="请输入办理情况说明..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">办理附件</label>
                    <div class="upload-area" onclick="document.getElementById('opAttachments').click()">
                        <div class="upload-icon">📎</div>
                        <div class="upload-text">点击上传办理相关附件</div>
                        <input type="file" id="opAttachments" multiple onchange="handleOpFileSelect()">
                    </div>
                    <div class="attachment-list" id="opAttachmentsList" style="margin-top:12px;"></div>
                </div>
            `;
            break;

        case FLOW_NODES.FEEDBACK:
            title = '办理反馈';
            bodyHtml = `
                ${renderTemplateSelector(TEMPLATE_TYPES.FEEDBACK)}
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span>反馈意见</label>
                    <textarea class="form-textarea" id="opComment" rows="5" placeholder="请输入办理结果反馈..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">反馈附件</label>
                    <div class="upload-area" onclick="document.getElementById('opAttachments').click()">
                        <div class="upload-icon">📎</div>
                        <div class="upload-text">点击上传反馈相关附件</div>
                        <input type="file" id="opAttachments" multiple onchange="handleOpFileSelect()">
                    </div>
                    <div class="attachment-list" id="opAttachmentsList" style="margin-top:12px;"></div>
                </div>
                <p style="color:#888; font-size:12px;">提交反馈后，公文将进入办结待归档状态。</p>
            `;
            break;

        case FLOW_NODES.COMPLETE:
            title = '办结归档';
            bodyHtml = `
                <div class="form-group">
                    <label class="form-label">归档备注</label>
                    <textarea class="form-textarea" id="opComment" rows="4" placeholder="请输入归档备注（选填）..."></textarea>
                </div>
                <p style="color:#888; font-size:12px;">确认归档后，公文流程全部结束。</p>
            `;
            break;
    }

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml + `
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitOperation()">确认提交</button>
        </div>
    `;
    document.getElementById('modal').classList.remove('hidden');
}

function handleOpFileSelect() {
    const input = document.getElementById('opAttachments');
    const files = input.files;
    const list = document.getElementById('opAttachmentsList');

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachment = {
            name: file.name,
            size: formatFileSize(file.size),
            id: 'opatt_' + Date.now() + '_' + i
        };

        operateAttachments.push(attachment);

        const item = document.createElement('div');
        item.className = 'attachment-item';
        item.innerHTML = `
            <span class="attachment-icon">📄</span>
            <span class="attachment-name">${attachment.name}</span>
            <span class="attachment-size">${attachment.size}</span>
            <a class="action-link" onclick="this.parentElement.remove(); removeOpAttachment('${attachment.id}')">删除</a>
        `;
        list.appendChild(item);
    }

    input.value = '';
}

function removeOpAttachment(id) {
    operateAttachments = operateAttachments.filter(a => a.id !== id);
}

function updateStaffOptions() {
    const dept = document.getElementById('opDept').value;
    const staffSelect = document.getElementById('opStaff');

    if (!dept) {
        staffSelect.innerHTML = '<option value="">请先选择科室</option>';
        return;
    }

    const staff = USERS[ROLES.STAFF].filter(u => u.dept === dept);
    staffSelect.innerHTML = staff.map(s =>
        `<option value="${s.id}">${s.name}</option>`
    ).join('');
}

function submitOperation() {
    const doc = dataStore.getDoc(currentDocId);
    if (!doc) return;

    const comment = document.getElementById('opComment').value.trim();

    let result = null;

    switch (doc.currentNode) {
        case FLOW_NODES.PROPOSE:
            if (!comment) {
                showToast('请输入批示意见', 'error');
                return;
            }
            result = dataStore.proposeDoc(doc.id, comment, currentUser);
            break;

        case FLOW_NODES.ASSIGN:
            const dept = document.getElementById('opDept').value;
            const staffId = document.getElementById('opStaff').value;
            if (!comment) {
                showToast('请输入批示意见', 'error');
                return;
            }
            if (!dept) {
                showToast('请选择承办科室', 'error');
                return;
            }
            if (!staffId) {
                showToast('请选择承办人', 'error');
                return;
            }
            const staffUser = USERS[ROLES.STAFF].find(u => u.id === staffId);
            result = dataStore.assignDoc(doc.id, dept, staffId, staffUser.name, comment, currentUser);
            break;

        case FLOW_NODES.HANDLE:
            if (!comment) {
                showToast('请输入办理意见', 'error');
                return;
            }
            result = dataStore.handleDoc(doc.id, comment, operateAttachments, currentUser);
            break;

        case FLOW_NODES.FEEDBACK:
            if (!comment) {
                showToast('请输入反馈意见', 'error');
                return;
            }
            result = dataStore.feedbackDoc(doc.id, comment, operateAttachments, currentUser);
            break;

        case FLOW_NODES.COMPLETE:
            result = dataStore.completeDoc(doc.id, comment || '已归档', currentUser);
            break;
    }

    if (result) {
        closeModal();
        showToast('操作成功！');
        renderDocDetail();
        renderNav();
    } else {
        showToast('操作失败，请重试', 'error');
    }
}

function showSuperviseModal() {
    const doc = dataStore.getDoc(currentDocId);
    if (!doc) return;

    document.getElementById('modalTitle').textContent = '追加督办';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>督办内容</label>
            <textarea class="form-textarea" id="supContent" rows="5" placeholder="请输入督办内容..."></textarea>
        </div>
        <div class="supervision-info">
            <p><strong>公文标题：</strong>${doc.title}</p>
            <p><strong>当前状态：</strong>${getDocStatusLabel(doc)}</p>
            <p><strong>剩余时间：</strong>${renderRemainingTime(doc)}</p>
            <p><strong>承办人：</strong>${doc.assignedUserName || '未指派'}</p>
        </div>
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-warning" onclick="submitSupervision()">确认督办</button>
        </div>
    `;
    document.getElementById('modal').classList.remove('hidden');
}

function submitSupervision() {
    const content = document.getElementById('supContent').value.trim();
    if (!content) {
        showToast('请输入督办内容', 'error');
        return;
    }

    const result = dataStore.addSupervisionRecord(currentDocId, content, currentUser);
    if (result) {
        closeModal();
        showToast('督办记录已添加！');
        renderDocDetail();
        renderNav();
    } else {
        showToast('操作失败，请重试', 'error');
    }
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    operateAttachments = [];
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');

    if (type === 'error') {
        toast.style.background = 'rgba(245, 34, 45, 0.9)';
    } else {
        toast.style.background = 'rgba(0, 0, 0, 0.8)';
    }

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2500);
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateTime(isoString) {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function getPriorityLabel(priority) {
    const map = {
        'normal': '<span style="color:#52c41a;">● 普通</span>',
        'high': '<span style="color:#fa8c16;">● 加急</span>',
        'urgent': '<span style="color:#f5222d;">● 特急</span>'
    };
    return map[priority] || map['normal'];
}

let currentTemplateType = '';

function renderTemplateList() {
    const content = document.getElementById('contentArea');

    let typeOptions = [{ value: '', label: '全部类型' }];
    Object.keys(TEMPLATE_TYPE_LABELS).forEach(key => {
        typeOptions.push({ value: key, label: TEMPLATE_TYPE_LABELS[key] });
    });

    const templates = templateStore.getUserTemplates(currentUser.id, currentTemplateType || null);

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">常用意见模板</h2>
            <button class="btn btn-primary" onclick="showAddTemplateModal()">+ 新增模板</button>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="template-filter-bar">
                    <div class="form-group" style="margin-bottom:0; min-width:180px;">
                        <label class="form-label">模板类型</label>
                        <select class="form-select" id="templateTypeFilter" onchange="filterTemplates()">
                            ${typeOptions.map(o => `<option value="${o.value}" ${currentTemplateType === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="template-tip">
                        <span style="color:#888; font-size:13px;">共 ${templates.length} 个模板，按使用频率排序</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;">
                ${templates.length > 0 ? `
                    <div class="template-list">
                        ${templates.map(tpl => `
                            <div class="template-item">
                                <div class="template-item-header">
                                    <div class="template-item-title">
                                        <span class="template-type-tag ${tpl.type}">${TEMPLATE_TYPE_LABELS[tpl.type]}</span>
                                        <span class="template-title-text">${escapeHtml(tpl.title)}</span>
                                    </div>
                                    <div class="template-item-actions">
                                        <span class="template-use-count">使用 ${tpl.useCount} 次</span>
                                        <a class="action-link" onclick="deleteTemplate('${tpl.id}')">删除</a>
                                    </div>
                                </div>
                                <div class="template-item-content">${escapeHtml(tpl.content)}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="empty-state"><div class="empty-icon">📝</div><p>暂无模板，点击"新增模板"添加</p></div>'}
            </div>
        </div>
    `;
}

function filterTemplates() {
    currentTemplateType = document.getElementById('templateTypeFilter').value;
    renderTemplateList();
}

function showAddTemplateModal() {
    let typeOptions = [];
    Object.keys(TEMPLATE_TYPE_LABELS).forEach(key => {
        typeOptions.push({ value: key, label: TEMPLATE_TYPE_LABELS[key] });
    });

    document.getElementById('modalTitle').textContent = '新增常用模板';
    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>模板类型</label>
            <select class="form-select" id="newTemplateType">
                ${typeOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>模板标题</label>
            <input type="text" class="form-input" id="newTemplateTitle" placeholder="给模板起个简短的名字">
        </div>
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>模板内容</label>
            <textarea class="form-textarea" id="newTemplateContent" rows="6" placeholder="请输入常用的意见内容..."></textarea>
        </div>
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="addTemplate()">确认添加</button>
        </div>
    `;
    document.getElementById('modal').classList.remove('hidden');
}

function addTemplate() {
    const type = document.getElementById('newTemplateType').value;
    const title = document.getElementById('newTemplateTitle').value.trim();
    const content = document.getElementById('newTemplateContent').value.trim();

    if (!title) {
        showToast('请输入模板标题', 'error');
        return;
    }
    if (!content) {
        showToast('请输入模板内容', 'error');
        return;
    }

    templateStore.addTemplate(currentUser.id, { type, title, content });
    closeModal();
    showToast('模板添加成功！');
    renderTemplateList();
}

function deleteTemplate(templateId) {
    if (!confirm('确定要删除这个模板吗？')) return;

    const result = templateStore.deleteTemplate(currentUser.id, templateId);
    if (result) {
        showToast('模板已删除');
        renderTemplateList();
    } else {
        showToast('删除失败', 'error');
    }
}

function renderTemplateSelector(type) {
    const templates = templateStore.getUserTemplates(currentUser.id, type);

    if (templates.length === 0) {
        return '';
    }

    return `
        <div class="template-selector">
            <div class="template-selector-label">
                <span>📝 常用模板</span>
                <span class="template-selector-hint">点击快速插入</span>
            </div>
            <div class="template-selector-list">
                ${templates.slice(0, 5).map(tpl => `
                    <button type="button" class="template-chip" onclick="insertTemplateContent('${tpl.id}')" title="${escapeHtml(tpl.content)}">
                        ${escapeHtml(tpl.title)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function insertTemplateContent(templateId) {
    const template = templateStore.useTemplate(currentUser.id, templateId);
    if (!template) return;

    const textarea = document.getElementById('opComment');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    const newValue = value.substring(0, start) + template.content + value.substring(end);
    textarea.value = newValue;

    const newPos = start + template.content.length;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);

    showToast('已插入模板');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getMessageIcon(type) {
    const icons = {
        [MESSAGE_TYPES.NEW_DOC_PROPOSE]: '📝',
        [MESSAGE_TYPES.DOC_ASSIGNED]: '📋',
        [MESSAGE_TYPES.DOC_HANDLED]: '⚙️',
        [MESSAGE_TYPES.DOC_FEEDBACK]: '📤',
        [MESSAGE_TYPES.DOC_COMPLETED]: '✅',
        [MESSAGE_TYPES.DOC_ARCHIVED]: '📦',
        [MESSAGE_TYPES.SUPERVISION]: '📢'
    };
    return icons[type] || '🔔';
}

function getMessageTypeLabel(type) {
    return MESSAGE_TYPE_LABELS[type] || '通知';
}

let messageFilterType = '';

function renderMessageList() {
    const content = document.getElementById('contentArea');
    const allMessages = messageStore.getMessagesForUser(currentRole, currentUser);
    const unreadCount = messageStore.getUnreadCount(currentRole, currentUser);

    const typeOptions = [
        { value: '', label: '全部消息' },
        { value: MESSAGE_TYPES.NEW_DOC_PROPOSE, label: '待批示' },
        { value: MESSAGE_TYPES.DOC_ASSIGNED, label: '新交办' },
        { value: MESSAGE_TYPES.DOC_HANDLED, label: '办理中' },
        { value: MESSAGE_TYPES.DOC_FEEDBACK, label: '已反馈' },
        { value: MESSAGE_TYPES.DOC_COMPLETED, label: '待归档' },
        { value: MESSAGE_TYPES.DOC_ARCHIVED, label: '已归档' }
    ];

    const filteredMessages = messageFilterType
        ? allMessages.filter(m => m.type === messageFilterType)
        : allMessages;

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">消息中心</h2>
            <div style="display:flex; gap:10px;">
                <span class="unread-count-big">未读：${unreadCount} 条</span>
                <button class="btn btn-default btn-sm" onclick="markAllMessagesRead()" ${unreadCount === 0 ? 'disabled' : ''}>全部标为已读</button>
            </div>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="message-filter-bar">
                    <div class="message-tabs">
                        ${typeOptions.map(opt => `
                            <div class="message-tab ${messageFilterType === opt.value ? 'active' : ''}"
                                 onclick="filterMessages('${opt.value}')">
                                ${opt.label}
                                ${opt.value === '' ? '' : ''}
                            </div>
                        `).join('')}
                    </div>
                    <div class="message-count-info">
                        共 ${filteredMessages.length} 条消息
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;">
                ${filteredMessages.length > 0 ? `
                    <div class="message-list-full">
                        ${filteredMessages.map(msg => `
                            <div class="message-item-full ${msg.read ? '' : 'unread'}"
                                 onclick="handleMessageClick('${msg.id}', '${msg.docId}')">
                                <div class="message-icon msg-${msg.type}">
                                    ${getMessageIcon(msg.type)}
                                </div>
                                <div class="message-content-full">
                                    <div class="message-header">
                                        <div class="message-title-full">
                                            ${msg.read ? '' : '<span class="message-dot"></span>'}
                                            ${msg.title}
                                        </div>
                                        <span class="message-type-tag">${getMessageTypeLabel(msg.type)}</span>
                                    </div>
                                    <div class="message-body">
                                        ${msg.content}
                                    </div>
                                    <div class="message-footer">
                                        <span class="message-from">来自：${msg.fromUserName}</span>
                                        <span class="message-time">${formatDateTime(msg.createdAt)}</span>
                                        ${msg.read ? '' : '<span class="mark-read-btn" onclick="event.stopPropagation(); markMessageRead(\'' + msg.id + '\')">标为已读</span>'}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<div class="empty-state"><div class="empty-icon">🔔</div><p>暂无消息</p></div>'}
            </div>
        </div>
    `;
}

function filterMessages(type) {
    messageFilterType = type;
    renderMessageList();
}

function handleMessageClick(messageId, docId) {
    messageStore.markAsRead(messageId);
    if (docId) {
        navigateTo('detail', { id: docId });
    }
    renderNav();
}

function markMessageRead(messageId) {
    messageStore.markAsRead(messageId);
    renderMessageList();
    renderNav();
}

function markAllMessagesRead() {
    messageStore.markAllAsRead(currentRole, currentUser);
    showToast('已全部标为已读');
    renderMessageList();
    renderNav();
}

document.addEventListener('DOMContentLoaded', init);
