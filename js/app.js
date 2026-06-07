let currentRole = null;
let currentUser = null;
let currentPage = 'dashboard';
let currentDocId = null;
let currentFilters = {};
let currentArchiveFilters = {};
let currentSupervisionFilters = {};
let isArchiveDetail = false;

let currentImportBatchId = null;
let currentImportFilters = {};

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
        menuItems.push({ key: 'batchImport', label: '批量收文导入', icon: '📥' });
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
        case 'batchImport':
            renderBatchImportList();
            break;
        case 'batchImportUpload':
            renderBatchImportUpload();
            break;
        case 'batchImportPreview':
            currentImportBatchId = params.batchId;
            renderBatchImportPreview();
            break;
        case 'batchImportResult':
            currentImportBatchId = params.batchId;
            renderBatchImportResult();
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
            .filter(d => {
                const handlerRecord = getHandlerRecord(d, currentUser.id);
                if (!handlerRecord || handlerRecord.status !== HANDLE_STATUS.PENDING) {
                    return false;
                }
                if (handlerRecord.type === HANDLE_TYPES.MAIN) {
                    return d.currentNode === FLOW_NODES.HANDLE || d.currentNode === FLOW_NODES.FEEDBACK;
                } else {
                    return d.currentNode === FLOW_NODES.HANDLE;
                }
            })
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

    const modeOptions = [
        { value: '', label: '全部办理方式' },
        { value: 'single', label: '单科室承办' },
        { value: 'multi', label: '多科室协办' }
    ];

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
                    <div class="form-group">
                        <label class="form-label">办理方式</label>
                        <select class="form-select" id="searchMode" onchange="applyFilters()">
                            ${modeOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
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
    const modeVal = document.getElementById('searchMode').value;
    let isMultiDept = undefined;
    if (modeVal === 'multi') {
        isMultiDept = true;
    } else if (modeVal === 'single') {
        isMultiDept = false;
    }

    currentFilters = {
        keyword: document.getElementById('searchKeyword').value.trim(),
        status: document.getElementById('searchStatus').value,
        isMultiDept: isMultiDept
    };
    document.getElementById('docListTable').innerHTML = renderDocTable();
}

function resetFilters() {
    currentFilters = {};
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchStatus').value = '';
    document.getElementById('searchMode').value = '';
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
                        <th>办理方式</th>
                        <th>剩余时间</th>
                        <th>预警状态</th>
                        ${currentRole === ROLES.STAFF ? '<th>我的角色</th>' : ''}
                        <th>登记时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${docs.map(doc => {
                        let myRole = '';
                        if (currentRole === ROLES.STAFF) {
                            const handlerRecord = getHandlerRecord(doc, currentUser.id);
                            if (handlerRecord) {
                                myRole = handlerRecord.type === HANDLE_TYPES.MAIN
                                    ? '<span class="role-badge main">主办</span>'
                                    : '<span class="role-badge co">协办</span>';
                            }
                        }
                        const modeBadge = doc.isMultiDept
                            ? '<span class="badge-multi">多科室协办</span>'
                            : '<span class="badge-single">单科室承办</span>';
                        return `
                        <tr>
                            <td>${doc.id}</td>
                            <td>${doc.title}</td>
                            <td>${doc.fromUnit}</td>
                            <td>${getPriorityLabel(doc.priority)}</td>
                            <td><span class="status-badge ${getDocStatusClass(doc)}">${getDocStatusLabel(doc)}</span></td>
                            <td>${modeBadge}</td>
                            <td>${renderRemainingTime(doc)}</td>
                            <td>${doc.deadline ? `<span class="warning-badge ${getWarningStatusClass(doc)}">${getWarningStatusLabel(doc)}</span>` : '-'}</td>
                            ${currentRole === ROLES.STAFF ? `<td>${myRole || '-'}</td>` : ''}
                            <td>${formatDate(doc.createdAt)}</td>
                            <td>
                                <div class="actions">
                                    <a class="action-link" onclick="navigateTo('detail', {id: '${doc.id}'})">查看</a>
                                    ${dataStore.canOperate(doc, currentRole, currentUser) ?
                                        `<a class="action-link" onclick="navigateTo('detail', {id: '${doc.id}'})">办理</a>` : ''}
                                </div>
                            </td>
                        </tr>
                    `}).join('')}
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
    USERS[ROLES.STAFF].forEach(s => {
        staffOptions.push({ value: s.id, label: `${s.name}（${s.dept}）` });
    });

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">督办预警中心</h2>
            ${currentRole === ROLES.OFFICE ? '<div class="page-subtitle">办公室督办管理 · 仅超期公文可追加督办记录</div>' : ''}
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
                                    ${dataStore.canSupervise(doc, currentRole, currentUser)
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
        let actionLabel = '办理';
        if (doc.currentNode === FLOW_NODES.PROPOSE) {
            actionLabel = '填写拟办意见';
        } else if (doc.currentNode === FLOW_NODES.ASSIGN) {
            actionLabel = '分办指派';
        } else if (doc.currentNode === FLOW_NODES.HANDLE) {
            if (doc.isMultiDept) {
                const handlerRecord = getHandlerRecord(doc, currentUser.id);
                if (handlerRecord && handlerRecord.type === HANDLE_TYPES.CO) {
                    actionLabel = '提交协办意见';
                } else {
                    actionLabel = '提交办理意见';
                }
            } else {
                actionLabel = '开始承办';
            }
        } else if (doc.currentNode === FLOW_NODES.FEEDBACK) {
            if (doc.isMultiDept) {
                actionLabel = '提交最终反馈';
            } else {
                actionLabel = '提交反馈';
            }
        } else if (doc.currentNode === FLOW_NODES.COMPLETE) {
            actionLabel = '办结归档';
        }
        actionButton = `<button class="btn btn-primary" onclick="showOperateModal()">${actionLabel}</button>`;
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
                    ${doc.isMultiDept ? `
                    <div class="detail-item full-width">
                        <span class="detail-label">办理方式</span>
                        <span class="detail-value"><span class="badge-multi">多科室协办</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">主办科室</span>
                        <span class="detail-value"><span class="dept-tag main-dept">${doc.assignedDept}</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">主办人</span>
                        <span class="detail-value">${doc.assignedUserName || '-'}</span>
                    </div>
                    <div class="detail-item full-width">
                        <span class="detail-label">协办科室（${getCoHandlers(doc).length}个）</span>
                        <span class="detail-value">
                            <div class="co-dept-list">
                                ${getCoHandlers(doc).map(co => `
                                    <span class="dept-tag co-dept">
                                        ${co.dept} - ${co.userName}
                                        <span class="co-status ${co.status === HANDLE_STATUS.COMPLETED ? 'completed' : 'pending'}">
                                            ${co.status === HANDLE_STATUS.COMPLETED ? '已完成' : '待办理'}
                                        </span>
                                    </span>
                                `).join('')}
                            </div>
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">协办进度</span>
                        <span class="detail-value">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${getCoHandleProgress(doc).percent}%"></div>
                            </div>
                            <span class="progress-text">${getCoHandleProgress(doc).completed}/${getCoHandleProgress(doc).total} 已完成</span>
                        </span>
                    </div>
                    ` : `
                    <div class="detail-item">
                        <span class="detail-label">承办科室</span>
                        <span class="detail-value"><span class="dept-tag">${doc.assignedDept}</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">承办人</span>
                        <span class="detail-value">${doc.assignedUserName || '-'}</span>
                    </div>
                    `}
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
        const records = doc.flowRecords.filter(r => r.node === node);
        const isCompleted = records.length > 0;
        const isCurrent = doc.currentNode === node && !isCompleted;
        const isPending = nodes.indexOf(doc.currentNode) < index;

        let dotClass = '';
        if (isCompleted) {
            dotClass = 'completed';
        } else if (isCurrent || isPending) {
            dotClass = 'pending';
        }

        let contentHtml = '';
        if (isCompleted && records.length > 0) {
            if (node === FLOW_NODES.HANDLE && doc.isMultiDept) {
                contentHtml = renderMultiHandleTimelineContent(doc, records);
            } else {
                const record = records[0];
                contentHtml = `
                    <div class="timeline-content">
                        <div class="timeline-title">${NODE_LABELS[node]}</div>
                        <div class="timeline-meta">
                            ${record.operatorName}（${record.operatorDept}） · ${formatDateTime(record.time)}
                        </div>
                        ${record.comment ? `<div class="timeline-comment">${record.comment}</div>` : ''}
                        ${record.assignedDept ? `<div class="timeline-meta" style="margin-top:6px;">分派至：${record.assignedDept} - ${record.assignedUserName}</div>` : ''}
                        ${record.isMultiDept ? `<div class="timeline-meta" style="margin-top:4px;"><span class="badge-multi">多科室协办</span></div>` : ''}
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
            }
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

function renderMultiHandleTimelineContent(doc, records) {
    const handleRecords = doc.handleRecords || [];

    let recordsHtml = handleRecords.map(hr => {
        const isMain = hr.type === HANDLE_TYPES.MAIN;
        const isCompleted = hr.status === HANDLE_STATUS.COMPLETED;
        const flowRecord = records.find(r => r.operatorId === hr.userId);

        return `
            <div class="handle-record-item ${isCompleted ? 'completed' : 'pending'}">
                <div class="handle-record-header">
                    <span class="handle-type-badge ${isMain ? 'main' : 'co'}">${isMain ? '主办' : '协办'}</span>
                    <span class="handle-dept">${hr.dept}</span>
                    <span class="handle-name">${hr.userName}</span>
                    <span class="handle-status ${isCompleted ? 'done' : 'wait'}">
                        ${isCompleted ? '已完成' : '待办理'}
                    </span>
                </div>
                ${isCompleted && flowRecord ? `
                    <div class="handle-record-body">
                        <div class="timeline-meta">${formatDateTime(flowRecord.time)}</div>
                        ${flowRecord.comment ? `<div class="timeline-comment">${flowRecord.comment}</div>` : ''}
                        ${flowRecord.attachments && flowRecord.attachments.length > 0 ? `
                            <div class="timeline-attachment">
                                <div style="font-size:12px; color:#888; margin-bottom:4px;">附件：</div>
                                ${flowRecord.attachments.map(a => `
                                    <div class="attachment-item" style="padding:4px 8px;">
                                        <span class="attachment-icon" style="font-size:16px;">📎</span>
                                        <span class="attachment-name">${a.name}</span>
                                        <span class="attachment-size">${a.size}</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="timeline-content">
            <div class="timeline-title">${NODE_LABELS[FLOW_NODES.HANDLE]} <span class="badge-multi">多科室协办</span></div>
            <div class="handle-records-list">
                ${recordsHtml}
            </div>
        </div>
    `;
}

let operateAttachments = [];
let coHandlerList = [];

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
            coHandlerList = [];
            const deptOptions = DEPARTMENTS.filter(d => d !== '局领导').map(d => `<option value="${d}">${d}</option>`).join('');
            bodyHtml = `
                ${renderTemplateSelector(TEMPLATE_TYPES.ASSIGN)}
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span>批示意见</label>
                    <textarea class="form-textarea" id="opComment" rows="3" placeholder="请输入分办批示意见..."></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">分办模式</label>
                    <div class="mode-switch">
                        <label class="mode-option active" onclick="setAssignMode('single', this)">
                            <input type="radio" name="assignMode" value="single" checked>
                            <span>单科室承办</span>
                        </label>
                        <label class="mode-option" onclick="setAssignMode('multi', this)">
                            <input type="radio" name="assignMode" value="multi">
                            <span>多科室协办</span>
                        </label>
                    </div>
                </div>
                <div id="singleModeSection">
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
                </div>
                <div id="multiModeSection" style="display:none;">
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span>主办科室</label>
                        <select class="form-select" id="mainDept" onchange="updateMainStaffOptions()">
                            <option value="">请选择主办科室</option>
                            ${deptOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span>主办人</label>
                        <select class="form-select" id="mainStaff">
                            <option value="">请先选择科室</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">协办科室</label>
                        <div id="coHandlerList">
                            <div class="empty-tip" style="color:#999; font-size:13px; padding:8px 0;">暂无协办科室</div>
                        </div>
                        <button type="button" class="btn btn-outline btn-sm" onclick="showAddCoHandlerModal()" style="margin-top:8px;">
                            + 添加协办科室
                        </button>
                    </div>
                </div>
            `;
            break;

        case FLOW_NODES.HANDLE:
            if (doc.isMultiDept) {
                const handlerRecord = getHandlerRecord(doc, currentUser.id);
                const isCo = handlerRecord && handlerRecord.type === HANDLE_TYPES.CO;
                title = isCo ? '协办意见' : '承办办理';
                const label = isCo ? '协办意见' : '办理意见';
                const placeholder = isCo ? '请输入协办意见...' : '请输入办理情况说明...';
                const attLabel = isCo ? '协办附件' : '办理附件';
                const attPlaceholder = isCo ? '点击上传协办相关附件' : '点击上传办理相关附件';
                const tipText = isCo
                    ? '提交协办意见后，请等待主办人汇总反馈。'
                    : (getCoHandlers(doc).length > 0
                        ? `当前已完成 ${getCoHandleProgress(doc).completed}/${getCoHandleProgress(doc).total} 个协办，所有协办完成后可提交最终反馈。`
                        : '提交办理进展后，将进入反馈环节。');
                bodyHtml = `
                    ${renderTemplateSelector(isCo ? TEMPLATE_TYPES.HANDLE : TEMPLATE_TYPES.HANDLE)}
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span>${label}</label>
                        <textarea class="form-textarea" id="opComment" rows="5" placeholder="${placeholder}"></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">${attLabel}</label>
                        <div class="upload-area" onclick="document.getElementById('opAttachments').click()">
                            <div class="upload-icon">📎</div>
                            <div class="upload-text">${attPlaceholder}</div>
                            <input type="file" id="opAttachments" multiple onchange="handleOpFileSelect()">
                        </div>
                        <div class="attachment-list" id="opAttachmentsList" style="margin-top:12px;"></div>
                    </div>
                    <p style="color:#888; font-size:12px;">${tipText}</p>
                `;
            } else {
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
            }
            break;

        case FLOW_NODES.FEEDBACK:
            if (doc.isMultiDept) {
                const allCoDone = allCoHandlersCompleted(doc);
                title = '最终反馈';
                bodyHtml = `
                    ${renderTemplateSelector(TEMPLATE_TYPES.FEEDBACK)}
                    ${!allCoDone ? `<div class="alert alert-warning" style="margin-bottom:16px;">
                        ⚠️ 还有 ${getCoHandleProgress(doc).total - getCoHandleProgress(doc).completed} 个协办科室未提交意见，请等待所有协办完成后再提交最终反馈。
                    </div>` : ''}
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span>最终反馈意见</label>
                        <textarea class="form-textarea" id="opComment" rows="5" placeholder="请输入最终办理结果反馈..."></textarea>
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
                    <p style="color:#888; font-size:12px;">提交最终反馈后，公文将进入办结待归档状态。</p>
                `;
            } else {
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
            }
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

function updateMainStaffOptions() {
    const dept = document.getElementById('mainDept').value;
    const staffSelect = document.getElementById('mainStaff');

    if (!dept) {
        staffSelect.innerHTML = '<option value="">请先选择科室</option>';
        return;
    }

    const staff = USERS[ROLES.STAFF].filter(u => u.dept === dept);
    staffSelect.innerHTML = staff.map(s =>
        `<option value="${s.id}">${s.name}</option>`
    ).join('');
}

function setAssignMode(mode, el) {
    const options = document.querySelectorAll('.mode-option');
    options.forEach(opt => opt.classList.remove('active'));
    el.classList.add('active');
    el.querySelector('input').checked = true;

    const singleSection = document.getElementById('singleModeSection');
    const multiSection = document.getElementById('multiModeSection');

    if (mode === 'single') {
        singleSection.style.display = 'block';
        multiSection.style.display = 'none';
    } else {
        singleSection.style.display = 'none';
        multiSection.style.display = 'block';
    }
}

function showAddCoHandlerModal() {
    const deptOptions = DEPARTMENTS.filter(d => d !== '局领导').map(d =>
        `<option value="${d}">${d}</option>`
    ).join('');

    const modalHtml = `
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>协办科室</label>
            <select class="form-select" id="addCoDept" onchange="updateCoStaffOptions()">
                <option value="">请选择科室</option>
                ${deptOptions}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>协办人</label>
            <select class="form-select" id="addCoStaff">
                <option value="">请先选择科室</option>
            </select>
        </div>
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeSubModal()">取消</button>
            <button class="btn btn-primary" onclick="confirmAddCoHandler()">确认添加</button>
        </div>
    `;

    const subModal = document.createElement('div');
    subModal.id = 'subModal';
    subModal.className = 'modal';
    subModal.innerHTML = `
        <div class="modal-overlay" onclick="closeSubModal()"></div>
        <div class="modal-content" style="width:420px;">
            <div class="modal-header">
                <h3>添加协办科室</h3>
                <button class="modal-close" onclick="closeSubModal()">×</button>
            </div>
            <div class="modal-body">
                ${modalHtml}
            </div>
        </div>
    `;
    document.body.appendChild(subModal);
}

function closeSubModal() {
    const subModal = document.getElementById('subModal');
    if (subModal) {
        subModal.remove();
    }
}

function updateCoStaffOptions() {
    const dept = document.getElementById('addCoDept').value;
    const staffSelect = document.getElementById('addCoStaff');

    if (!dept) {
        staffSelect.innerHTML = '<option value="">请先选择科室</option>';
        return;
    }

    const staff = USERS[ROLES.STAFF].filter(u => u.dept === dept);
    staffSelect.innerHTML = staff.map(s =>
        `<option value="${s.id}">${s.name}</option>`
    ).join('');
}

function confirmAddCoHandler() {
    const dept = document.getElementById('addCoDept').value;
    const staffId = document.getElementById('addCoStaff').value;

    if (!dept) {
        showToast('请选择协办科室', 'error');
        return;
    }
    if (!staffId) {
        showToast('请选择协办人', 'error');
        return;
    }

    const mainStaffId = document.getElementById('mainStaff').value;
    if (mainStaffId && staffId === mainStaffId) {
        showToast('协办人不能与主办人相同', 'warning');
        return;
    }

    const exists = coHandlerList.some(c => c.userId === staffId);
    if (exists) {
        showToast('该协办人已添加', 'warning');
        return;
    }

    const staffUser = USERS[ROLES.STAFF].find(u => u.id === staffId);
    coHandlerList.push({
        dept: dept,
        userId: staffId,
        userName: staffUser.name
    });

    renderCoHandlerList();
    closeSubModal();
    showToast('添加成功');
}

function renderCoHandlerList() {
    const container = document.getElementById('coHandlerList');
    if (!container) return;

    if (coHandlerList.length === 0) {
        container.innerHTML = '<div class="empty-tip" style="color:#999; font-size:13px; padding:8px 0;">暂无协办科室</div>';
        return;
    }

    container.innerHTML = coHandlerList.map((co, index) => `
        <div class="co-handler-item">
            <span class="co-handler-dept">${co.dept}</span>
            <span class="co-handler-name">${co.userName}</span>
            <span class="co-handler-remove" onclick="removeCoHandler(${index})">×</span>
        </div>
    `).join('');
}

function removeCoHandler(index) {
    coHandlerList.splice(index, 1);
    renderCoHandlerList();
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
            const modeRadio = document.querySelector('input[name="assignMode"]:checked');
            const mode = modeRadio ? modeRadio.value : 'single';

            if (!comment) {
                showToast('请输入批示意见', 'error');
                return;
            }

            if (mode === 'single') {
                const dept = document.getElementById('opDept').value;
                const staffId = document.getElementById('opStaff').value;
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
            } else {
                const mainDept = document.getElementById('mainDept').value;
                const mainStaffId = document.getElementById('mainStaff').value;
                if (!mainDept) {
                    showToast('请选择主办科室', 'error');
                    return;
                }
                if (!mainStaffId) {
                    showToast('请选择主办人', 'error');
                    return;
                }
                if (coHandlerList.length === 0) {
                    showToast('请至少添加一个协办科室', 'error');
                    return;
                }
                const coUserIds = coHandlerList.map(c => c.userId);
                if (new Set(coUserIds).size !== coUserIds.length) {
                    showToast('协办人不能重复', 'error');
                    return;
                }
                if (coUserIds.includes(mainStaffId)) {
                    showToast('协办人不能与主办人相同', 'error');
                    return;
                }
                const mainStaffUser = USERS[ROLES.STAFF].find(u => u.id === mainStaffId);
                result = dataStore.assignDocMulti(doc.id, {
                    mainDept: mainDept,
                    mainUserId: mainStaffId,
                    mainUserName: mainStaffUser.name,
                    coHandlers: coHandlerList,
                    comment: comment
                }, currentUser);
            }
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

    const result = dataStore.addSupervisionRecord(currentDocId, content, currentUser, currentRole);
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

function renderBatchImportList() {
    const content = document.getElementById('contentArea');
    const batches = importBatchStore.listBatches(currentImportFilters);

    const statusOptions = [
        { value: '', label: '全部状态' },
        { value: IMPORT_STATUS.PENDING, label: '待导入' },
        { value: IMPORT_STATUS.COMPLETED, label: '已完成' },
        { value: IMPORT_STATUS.FAILED, label: '导入失败' }
    ];

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">批量收文导入</h2>
            <button class="btn btn-primary" onclick="navigateTo('batchImportUpload')">📥 新建导入</button>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar">
                    <div class="form-group">
                        <label class="form-label">关键词</label>
                        <input type="text" class="form-input" id="importKeyword" placeholder="批次号、文件名"
                               onkeyup="if(event.key==='Enter') applyImportFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">状态</label>
                        <select class="form-select" id="importStatus" onchange="applyImportFilters()">
                            ${statusOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="applyImportFilters()">🔍 查询</button>
                    <button class="btn btn-default" onclick="resetImportFilters()">重置</button>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;" id="importListTable">
                ${renderBatchImportTable()}
            </div>
        </div>
    `;
}

function applyImportFilters() {
    currentImportFilters = {
        keyword: document.getElementById('importKeyword').value.trim(),
        status: document.getElementById('importStatus').value
    };
    document.getElementById('importListTable').innerHTML = renderBatchImportTable();
}

function resetImportFilters() {
    currentImportFilters = {};
    document.getElementById('importKeyword').value = '';
    document.getElementById('importStatus').value = '';
    document.getElementById('importListTable').innerHTML = renderBatchImportTable();
}

function renderBatchImportTable() {
    const batches = importBatchStore.listBatches(currentImportFilters);

    if (batches.length === 0) {
        return '<div class="empty-state"><div class="empty-icon">📥</div><p>暂无导入批次记录</p></div>';
    }

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>批次号</th>
                        <th>文件名</th>
                        <th>文件类型</th>
                        <th>总数</th>
                        <th>成功</th>
                        <th>失败</th>
                        <th>状态</th>
                        <th>导入时间</th>
                        <th>操作人</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${batches.map(batch => `
                        <tr>
                            <td><strong>${batch.id}</strong></td>
                            <td>${batch.fileName}</td>
                            <td><span class="file-type-tag">${batch.fileType.toUpperCase()}</span></td>
                            <td>${batch.totalCount}</td>
                            <td style="color:#52c41a;">${batch.successCount}</td>
                            <td style="color:#f5222d;">${batch.failCount}</td>
                            <td><span class="import-status-badge status-${batch.status}">${IMPORT_STATUS_LABELS[batch.status]}</span></td>
                            <td>${formatDateTime(batch.createdAt)}</td>
                            <td>${batch.createdByName}</td>
                            <td>
                                <div class="actions">
                                    ${batch.status === IMPORT_STATUS.PENDING
                                        ? `<a class="action-link" onclick="navigateTo('batchImportPreview', {batchId: '${batch.id}'})">继续导入</a>`
                                        : `<a class="action-link" onclick="viewImportResult('${batch.id}')">查看结果</a>`}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function viewImportResult(batchId) {
    navigateTo('batchImportResult', { batchId: batchId });
}

let pendingImportData = null;

function renderBatchImportUpload() {
    const content = document.getElementById('contentArea');

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">新建批量导入</h2>
            <button class="btn btn-default" onclick="navigateTo('batchImport')">返回列表</button>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">上传文件</span>
            </div>
            <div class="card-body">
                <div class="import-upload-area" onclick="document.getElementById('importFileInput').click()">
                    <div class="import-upload-icon">📁</div>
                    <div class="import-upload-title">点击上传文件</div>
                    <div class="import-upload-desc">支持 CSV、JSON 格式，单文件不超过 10MB</div>
                    <input type="file" id="importFileInput" accept=".csv,.json" onchange="handleImportFileSelect(this)">
                </div>

                <div class="import-format-info">
                    <h4 style="margin-bottom:12px; color:#333;">📋 文件格式说明</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                        <div class="format-card">
                            <div class="format-title">CSV 格式</div>
                            <div class="format-desc">
                                <p>第一行为表头，包含以下字段：</p>
                                <ul>
                                    <li><code>title</code> - 公文标题（必填）</li>
                                    <li><code>fromUnit</code> - 来文单位（必填）</li>
                                    <li><code>docNumber</code> - 来文字号</li>
                                    <li><code>docDate</code> - 来文日期 (YYYY-MM-DD)</li>
                                    <li><code>priority</code> - 紧急程度 (普通/加急/特急)</li>
                                    <li><code>category</code> - 公文类别</li>
                                    <li><code>content</code> - 内容摘要</li>
                                </ul>
                            </div>
                        </div>
                        <div class="format-card">
                            <div class="format-title">JSON 格式</div>
                            <div class="format-desc">
                                <p>对象数组，每个对象包含以下字段：</p>
                                <ul>
                                    <li><code>title</code> - 公文标题（必填）</li>
                                    <li><code>fromUnit</code> - 来文单位（必填）</li>
                                    <li><code>docNumber</code> - 来文字号</li>
                                    <li><code>docDate</code> - 来文日期</li>
                                    <li><code>priority</code> - 紧急程度</li>
                                    <li><code>category</code> - 公文类别</li>
                                    <li><code>content</code> - 内容摘要</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top:20px; text-align:right;">
                    <button class="btn btn-default" onclick="navigateTo('batchImport')">取消</button>
                    <button class="btn btn-primary" id="nextPreviewBtn" disabled onclick="goToImportPreview()">下一步：预览校验</button>
                </div>
            </div>
        </div>
    `;

    pendingImportData = null;
}

function handleImportFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('文件大小不能超过 10MB', 'error');
        return;
    }

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isJSON = fileName.endsWith('.json');

    if (!isCSV && !isJSON) {
        showToast('仅支持 CSV 和 JSON 格式文件', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let items = [];
            if (isCSV) {
                items = parseCSV(e.target.result);
            } else {
                items = parseJSON(e.target.result);
            }

            if (items.length === 0) {
                showToast('文件中没有有效数据', 'error');
                return;
            }

            pendingImportData = {
                fileName: file.name,
                fileType: isCSV ? 'csv' : 'json',
                items: items
            };

            document.getElementById('nextPreviewBtn').disabled = false;
            showToast(`文件解析成功，共 ${items.length} 条记录`);
        } catch (err) {
            showToast('文件解析失败：' + err.message, 'error');
        }
    };
    reader.onerror = function() {
        showToast('文件读取失败', 'error');
    };

    if (isCSV) {
        reader.readAsText(file, 'UTF-8');
    } else {
        reader.readAsText(file);
    }
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
        throw new Error('CSV 文件至少需要表头和一行数据');
    }

    const fieldMap = {
        'title': 'title',
        'fromunit': 'fromUnit',
        'from_unit': 'fromUnit',
        'docnumber': 'docNumber',
        'doc_number': 'docNumber',
        'docdate': 'docDate',
        'doc_date': 'docDate',
        'priority': 'priority',
        'category': 'category',
        'content': 'content'
    };

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    const items = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;

        const values = parseCSVLine(line);
        const item = {};

        headers.forEach((header, index) => {
            const key = header.toLowerCase().replace(/\s+/g, '');
            const mappedKey = fieldMap[key] || key;
            item[mappedKey] = values[index] || '';
        });

        items.push(item);
    }

    return items;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result;
}

function parseJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
        throw new Error('JSON 文件内容必须是数组');
    }
    return data;
}

let currentPreviewBatchId = null;

function goToImportPreview() {
    if (!pendingImportData) {
        showToast('请先上传文件', 'error');
        return;
    }

    const docNumbers = new Set();
    const validatedItems = pendingImportData.items.map((item, index) => {
        return importBatchStore.validateImportItem(item, index + 1, docNumbers);
    });

    const batch = importBatchStore.createBatch({
        fileName: pendingImportData.fileName,
        fileType: pendingImportData.fileType,
        totalCount: validatedItems.length,
        items: validatedItems
    }, currentUser);

    currentPreviewBatchId = batch.id;
    navigateTo('batchImportPreview', { batchId: batch.id });
}

function renderBatchImportPreview() {
    const batchId = currentImportBatchId || currentPreviewBatchId;
    const batch = importBatchStore.getBatch(batchId);

    if (!batch) {
        document.getElementById('contentArea').innerHTML = '<div class="empty-state"><p>批次不存在</p></div>';
        return;
    }

    const validItems = batch.items.filter(item => item.valid);
    const invalidItems = batch.items.filter(item => !item.valid);

    const content = document.getElementById('contentArea');

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">预览校验</h2>
            <button class="btn btn-default" onclick="navigateTo('batchImport')">返回列表</button>
        </div>

        <div class="preview-stats-grid">
            <div class="preview-stat-card preview-stat-total">
                <div class="preview-stat-icon">📊</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${batch.totalCount}</div>
                    <div class="preview-stat-label">总记录数</div>
                </div>
            </div>
            <div class="preview-stat-card preview-stat-success">
                <div class="preview-stat-icon">✅</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${validItems.length}</div>
                    <div class="preview-stat-label">校验通过</div>
                </div>
            </div>
            <div class="preview-stat-card preview-stat-error">
                <div class="preview-stat-icon">❌</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${invalidItems.length}</div>
                    <div class="preview-stat-label">校验失败</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">文件信息</span>
            </div>
            <div class="card-body">
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">批次号</span>
                        <span class="detail-value"><strong>${batch.id}</strong></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">文件名</span>
                        <span class="detail-value">${batch.fileName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">文件类型</span>
                        <span class="detail-value"><span class="file-type-tag">${batch.fileType.toUpperCase()}</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">上传时间</span>
                        <span class="detail-value">${formatDateTime(batch.createdAt)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">数据校验结果</span>
                <div class="preview-tabs">
                    <span class="preview-tab active" onclick="switchPreviewTab('all', this)">全部 (${batch.totalCount})</span>
                    <span class="preview-tab" onclick="switchPreviewTab('valid', this)">通过 (${validItems.length})</span>
                    <span class="preview-tab" onclick="switchPreviewTab('invalid', this)">失败 (${invalidItems.length})</span>
                </div>
            </div>
            <div class="card-body" style="padding:0;">
                ${renderPreviewTable(batch.items, 'all')}
            </div>
        </div>

        <div style="margin-top:20px; text-align:right;">
            <button class="btn btn-default" onclick="navigateTo('batchImportUpload')" style="margin-right:8px;">重新上传</button>
            <button class="btn btn-primary btn-lg" onclick="confirmImportBatch()" ${validItems.length === 0 ? 'disabled' : ''}>
                确认导入 (${validItems.length} 条)
            </button>
        </div>
    `;
}

function switchPreviewTab(type, tabEl) {
    const batchId = currentImportBatchId || currentPreviewBatchId;
    const batch = importBatchStore.getBatch(batchId);
    if (!batch) return;

    document.querySelectorAll('.preview-tab').forEach(el => el.classList.remove('active'));
    tabEl.classList.add('active');

    let items = batch.items;
    if (type === 'valid') {
        items = batch.items.filter(item => item.valid);
    } else if (type === 'invalid') {
        items = batch.items.filter(item => !item.valid);
    }

    const tableContainer = document.querySelector('.card-body[style="padding:0;"]');
    if (tableContainer) {
        tableContainer.innerHTML = renderPreviewTable(items, type);
    }
}

function renderPreviewTable(items, type) {
    if (items.length === 0) {
        return '<div class="empty-state"><p>暂无数据</p></div>';
    }

    return `
        <div class="table-container import-preview-table">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width:60px;">行号</th>
                        <th>标题</th>
                        <th>来文单位</th>
                        <th>来文字号</th>
                        <th>来文日期</th>
                        <th>紧急程度</th>
                        <th>状态</th>
                        <th>错误信息</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr class="${item.valid ? 'row-valid' : 'row-invalid'}">
                            <td>${item.rowIndex}</td>
                            <td class="td-ellipsis" title="${item.data.title || ''}">${item.data.title || '-'}</td>
                            <td>${item.data.fromUnit || '-'}</td>
                            <td>${item.data.docNumber || '-'}</td>
                            <td>${item.data.docDate || '-'}</td>
                            <td>${item.data.priority ? getPriorityLabel(item.data.priority) : '-'}</td>
                            <td>
                                <span class="valid-badge ${item.valid ? 'valid' : 'invalid'}">
                                    ${item.valid ? '✓ 通过' : '✗ 失败'}
                                </span>
                            </td>
                            <td class="error-cell">
                                ${item.valid ? '-' : item.errors.join('；')}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function confirmImportBatch() {
    const batchId = currentImportBatchId || currentPreviewBatchId;
    const batch = importBatchStore.getBatch(batchId);

    if (!batch) {
        showToast('批次不存在', 'error');
        return;
    }

    const validCount = batch.items.filter(item => item.valid).length;
    if (validCount === 0) {
        showToast('没有可导入的有效数据', 'error');
        return;
    }

    if (!confirm(`确认导入 ${validCount} 条公文？导入后将生成待批示公文。`)) {
        return;
    }

    const result = importBatchStore.batchCreateDocs(batchId, currentUser);

    showToast(`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
    navigateTo('batchImportResult', { batchId: batchId });
}

function renderBatchImportResult() {
    const batchId = currentImportBatchId;
    const batch = importBatchStore.getBatch(batchId);

    if (!batch) {
        document.getElementById('contentArea').innerHTML = '<div class="empty-state"><p>批次不存在</p></div>';
        return;
    }

    const successItems = batch.items.filter(item => item.docId);
    const failItems = batch.items.filter(item => !item.valid || !item.docId);

    const content = document.getElementById('contentArea');

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">导入结果</h2>
            <button class="btn btn-default" onclick="navigateTo('batchImport')">返回列表</button>
        </div>

        <div class="result-summary-card ${batch.status === IMPORT_STATUS.FAILED ? 'result-failed' : 'result-success'}">
            <div class="result-icon">
                ${batch.status === IMPORT_STATUS.FAILED ? '❌' : '✅'}
            </div>
            <div class="result-info">
                <div class="result-title">
                    ${batch.status === IMPORT_STATUS.FAILED ? '导入失败' : '导入成功'}
                </div>
                <div class="result-desc">
                    批次号：${batch.id} · 共 ${batch.totalCount} 条记录
                </div>
            </div>
        </div>

        <div class="preview-stats-grid" style="margin-top:20px;">
            <div class="preview-stat-card preview-stat-success">
                <div class="preview-stat-icon">✅</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${batch.successCount}</div>
                    <div class="preview-stat-label">成功导入</div>
                </div>
            </div>
            <div class="preview-stat-card preview-stat-error">
                <div class="preview-stat-icon">❌</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${batch.failCount}</div>
                    <div class="preview-stat-label">导入失败</div>
                </div>
            </div>
            <div class="preview-stat-card preview-stat-total">
                <div class="preview-stat-icon">📊</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${batch.totalCount}</div>
                    <div class="preview-stat-label">总记录数</div>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:20px;">
            <div class="card-header">
                <span class="card-title">成功导入的公文</span>
                <span class="badge-count">${successItems.length} 条</span>
            </div>
            <div class="card-body" style="padding:0;">
                ${successItems.length > 0 ? `
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>行号</th>
                                    <th>文号</th>
                                    <th>标题</th>
                                    <th>来文单位</th>
                                    <th>紧急程度</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${successItems.map(item => `
                                    <tr>
                                        <td>${item.rowIndex}</td>
                                        <td><strong>${item.docId}</strong></td>
                                        <td class="td-ellipsis" title="${item.data.title}">${item.data.title}</td>
                                        <td>${item.data.fromUnit}</td>
                                        <td>${item.data.priority ? getPriorityLabel(item.data.priority) : '-'}</td>
                                        <td>
                                            <a class="action-link" onclick="navigateTo('detail', {id: '${item.docId}'})">查看</a>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>无成功导入记录</p></div>'}
            </div>
        </div>

        ${failItems.length > 0 ? `
        <div class="card">
            <div class="card-header">
                <span class="card-title">导入失败记录</span>
                <span class="badge-count" style="background:#f5222d;">${failItems.length} 条</span>
            </div>
            <div class="card-body" style="padding:0;">
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width:60px;">行号</th>
                                <th>标题</th>
                                <th>来文单位</th>
                                <th>来文字号</th>
                                <th>失败原因</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${failItems.map(item => `
                                <tr class="row-invalid">
                                    <td>${item.rowIndex}</td>
                                    <td>${item.data.title || '-'}</td>
                                    <td>${item.data.fromUnit || '-'}</td>
                                    <td>${item.data.docNumber || '-'}</td>
                                    <td class="error-cell">
                                        ${item.errors && item.errors.length > 0 ? item.errors.join('；') : '导入失败'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        ` : ''}

        <div style="margin-top:20px; text-align:right;">
            <button class="btn btn-default" onclick="navigateTo('batchImportUpload')" style="margin-right:8px;">继续导入</button>
            <button class="btn btn-primary" onclick="navigateTo('list')">查看公文列表</button>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', init);
