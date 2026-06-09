let currentRole = null;
let currentUser = null;
let currentPage = 'dashboard';
let currentDocId = null;
let currentDraftId = null;
let draftAutoSaveTimer = null;
let draftLastSavedAt = null;
let isDraftFormDirty = false;
let isDraftSaving = false;
let currentFilters = {};
let currentArchiveFilters = {};
let currentSupervisionFilters = {};
let isArchiveDetail = false;

let currentImportBatchId = null;
let currentImportFilters = {};

let currentAttachmentFilters = {};

let currentDraftFilters = {};

let currentFilterViewId = null;

let registerAttachments = [];
let operateAttachments = [];
let resubmitAttachments = [];

let loginSelectedRole = ROLES.OFFICE;

function init() {
    selectLoginRole(ROLES.OFFICE);
    const savedRole = sessionStorage.getItem('doc_flow_role');
    const savedUserId = sessionStorage.getItem('doc_flow_userid');
    if (savedRole && savedUserId) {
        const user = userStore.getUserById(savedUserId);
        if (user && user.active && user.role === savedRole) {
            currentRole = savedRole;
            currentUser = user;
            showMainApp();
        }
    }
}

function selectLoginRole(role) {
    loginSelectedRole = role;
    document.querySelectorAll('.role-selectable').forEach(card => {
        if (card.dataset.role === role) {
            card.classList.add('role-selected');
        } else {
            card.classList.remove('role-selected');
        }
    });
    updateUserSelect(role);
}

function updateUserSelect(role) {
    const select = document.getElementById('userSelect');
    const users = userStore.getUsersByRole(role) || [];
    select.innerHTML = users.map(u =>
        `<option value="${u.id}">${u.name}（${u.dept}）</option>`
    ).join('');
}

function doLogin() {
    const role = loginSelectedRole;
    currentRole = role;
    const select = document.getElementById('userSelect');
    const userId = select.value;
    const users = userStore.getUsersByRole(role) || [];
    currentUser = users.find(u => u.id === userId) || users[0];

    if (!currentUser) {
        showToast('该角色暂无可用用户', 'error');
        return;
    }

    sessionStorage.setItem('doc_flow_role', role);
    sessionStorage.setItem('doc_flow_userid', currentUser.id);

    showMainApp();
    showToast(`欢迎，${currentUser.name}！`);
}

function logout() {
    const lastRole = currentRole || ROLES.OFFICE;
    currentRole = null;
    currentUser = null;
    currentPage = 'dashboard';
    currentDocId = null;
    currentDraftId = null;
    registerAttachments = [];
    sessionStorage.removeItem('doc_flow_role');
    sessionStorage.removeItem('doc_flow_userid');

    selectLoginRole(lastRole);

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
    menuItems.push({ key: 'attachments', label: '附件管理中心', icon: '📎' });
    menuItems.push({ key: 'supervision', label: '督办预警中心', icon: '⚠️' });

    if (currentRole === ROLES.OFFICE || currentRole === ROLES.LEADER) {
        menuItems.push({ key: 'statistics', label: '公文统计分析', icon: '📊' });
    }

    if (currentRole === ROLES.OFFICE) {
        menuItems.push({ key: 'register', label: '收文登记', icon: '✍️' });
        const draftCount = dataStore.getDraftStats(currentUser.id).total;
        const draftBadge = draftCount > 0 ? `<span class="nav-badge">${draftCount > 99 ? '99+' : draftCount}</span>` : '';
        menuItems.push({ key: 'drafts', label: '公文草稿箱', icon: '📝', badge: draftBadge });
        menuItems.push({ key: 'batchImport', label: '批量收文导入', icon: '📥' });
        menuItems.push({ key: 'archive', label: '归档库', icon: '📦' });
        menuItems.push({ key: 'userManage', label: '角色与人员管理', icon: '👥' });
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
    if ((currentPage === 'register' || currentPage === 'draftEdit') && (page !== 'register' && page !== 'draftEdit')) {
        clearDraftAutoSave();
        if (isDraftFormDirty && currentDraftId) {
            const formData = getRegisterFormData();
            if (formData.title || formData.fromUnit || formData.content || (formData.attachments && formData.attachments.length > 0)) {
                dataStore.updateDraft(currentDraftId, formData, currentUser);
            }
        }
        isDraftFormDirty = false;
    }

    currentPage = page;
    renderNav();
    const content = document.getElementById('contentArea');

    switch (page) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'list':
            if (params.filters) {
                currentFilters = { ...params.filters };
            }
            renderDocList();
            break;
        case 'attachments':
            renderAttachmentCenter();
            break;
        case 'statistics':
            renderStatistics();
            break;
        case 'supervision':
            renderSupervisionCenter();
            break;
        case 'register':
            currentDraftId = null;
            renderRegisterForm();
            break;
        case 'draftEdit':
            currentDraftId = params.draftId || null;
            renderRegisterForm();
            break;
        case 'drafts':
            renderDraftList();
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
        case 'userManage':
            renderUserManage();
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
            .filter(d => (d.currentNode === FLOW_NODES.COMPLETE && !d.archived) ||
                        (d.currentNode === FLOW_NODES.REGISTER && d.isReturned))
            .slice(0, 5);
    } else if (currentRole === ROLES.LEADER) {
        pendingList = dataStore.listDocs()
            .filter(d => d.currentNode === FLOW_NODES.PROPOSE || d.currentNode === FLOW_NODES.ASSIGN)
            .slice(0, 5);
    } else if (currentRole === ROLES.STAFF) {
        pendingList = dataStore.listDocs()
            .filter(d => dataStore.canOperate(d, currentRole, currentUser) ||
                        dataStore.canResubmit(d, currentRole, currentUser))
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

