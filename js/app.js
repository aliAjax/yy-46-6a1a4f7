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
            if (formData.title || formData.fromUnit || formData.docNumber || formData.deadline || formData.content || (formData.attachments && formData.attachments.length > 0)) {
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
            showAutoDraftPromptIfNeeded();
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

function renderDocList() {
    const content = document.getElementById('contentArea');

    let statusOptions = [
        { value: '', label: '全部状态' }
    ];

    Object.keys(NODE_LABELS).forEach(node => {
        statusOptions.push({ value: node, label: getStatusLabelByNode(node) });
    });

    let deptOptions = [{ value: '', label: '全部科室' }];
    userStore.getDepartments().forEach(d => deptOptions.push({ value: d, label: d }));

    const modeOptions = [
        { value: '', label: '全部办理方式' },
        { value: 'single', label: '单科室承办' },
        { value: 'multi', label: '多科室协办' }
    ];

    const priorityOptions = [
        { value: '', label: '全部紧急程度' },
        { value: 'normal', label: '普通' },
        { value: 'high', label: '加急' },
        { value: 'urgent', label: '特急' }
    ];

    const categoryOptions = [
        { value: '', label: '全部类别' },
        { value: '通知', label: '通知' },
        { value: '请示', label: '请示' },
        { value: '报告', label: '报告' },
        { value: '批复', label: '批复' },
        { value: '函', label: '函' },
        { value: '会议纪要', label: '会议纪要' },
        { value: '意见', label: '意见' },
        { value: '其他', label: '其他' },
        { value: '__none__', label: '未分类' }
    ];

    const kw = currentFilters.keyword || '';
    const status = currentFilters.status || '';
    const mode = currentFilters.isMultiDept === true ? 'multi' : (currentFilters.isMultiDept === false ? 'single' : '');
    const dept = currentFilters.assignedDept || '';
    const priority = currentFilters.priority || '';
    const category = currentFilters.category || '';
    const startDate = currentFilters.startDate || '';
    const endDate = currentFilters.endDate || '';

    const views = filterViewStore.getViews();
    const activeViewId = currentFilterViewId;

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">公文列表</h2>
            ${currentRole === ROLES.OFFICE ? '<button class="btn btn-primary" onclick="navigateTo(\'register\')">+ 收文登记</button>' : ''}
        </div>

        <div class="card">
            <div class="filter-view-bar">
                <div class="filter-view-label">常用视图：</div>
                <div class="filter-view-tabs" id="filterViewTabs">
                    <span class="filter-view-tab ${activeViewId === null ? 'active' : ''}" onclick="applyFilterView(null)" title="全部公文">
                        全部
                    </span>
                    ${views.map(v => `
                        <span class="filter-view-tab ${activeViewId === v.id ? 'active' : ''}" data-view-id="${v.id}" title="${escapeHtml(v.name)}">
                            <span class="filter-view-tab-name" onclick="applyFilterView('${v.id}')">${escapeHtml(v.name)}</span>
                            <span class="filter-view-tab-actions">
                                <span class="filter-view-tab-btn" onclick="event.stopPropagation(); openSaveViewModal('${v.id}')" title="编辑视图">✏️</span>
                                <span class="filter-view-tab-btn filter-view-tab-delete" onclick="event.stopPropagation(); deleteFilterView('${v.id}')" title="删除视图">🗑️</span>
                            </span>
                        </span>
                    `).join('')}
                </div>
                <div class="filter-view-actions">
                    <button class="btn btn-outline btn-sm filter-view-save-btn" onclick="openSaveViewModal()">
                        💾 保存当前为视图
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="search-bar list-search-bar">
                    <div class="form-group">
                        <label class="form-label">关键词</label>
                        <input type="text" class="form-input" id="searchKeyword" placeholder="文号、标题、来文单位"
                               value="${kw}"
                               onkeyup="if(event.key==='Enter') applyFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">状态</label>
                        <select class="form-select" id="searchStatus" onchange="applyFilters()">
                            ${statusOptions.map(o => `<option value="${o.value}" ${o.value === status ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">承办科室</label>
                        <select class="form-select" id="searchDept" onchange="applyFilters()">
                            ${deptOptions.map(o => `<option value="${o.value}" ${o.value === dept ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">紧急程度</label>
                        <select class="form-select" id="searchPriority" onchange="applyFilters()">
                            ${priorityOptions.map(o => `<option value="${o.value}" ${o.value === priority ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">公文类别</label>
                        <select class="form-select" id="searchCategory" onchange="applyFilters()">
                            ${categoryOptions.map(o => `<option value="${o.value}" ${o.value === category ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">办理方式</label>
                        <select class="form-select" id="searchMode" onchange="applyFilters()">
                            ${modeOptions.map(o => `<option value="${o.value}" ${o.value === mode ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">登记开始日期</label>
                        <input type="date" class="form-input" id="searchStartDate" value="${startDate}" onchange="applyFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">登记结束日期</label>
                        <input type="date" class="form-input" id="searchEndDate" value="${endDate}" onchange="applyFilters()">
                    </div>
                    <div class="search-actions">
                        <button class="btn btn-primary" onclick="applyFilters()">🔍 查询</button>
                        <button class="btn btn-default" onclick="resetFilters()">重置</button>
                    </div>
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
        assignedDept: document.getElementById('searchDept').value,
        priority: document.getElementById('searchPriority').value,
        category: document.getElementById('searchCategory').value,
        startDate: document.getElementById('searchStartDate').value,
        endDate: document.getElementById('searchEndDate').value,
        isMultiDept: isMultiDept
    };
    currentFilterViewId = null;
    updateFilterViewTabs();
    document.getElementById('docListTable').innerHTML = renderDocTable();
}

function resetFilters() {
    currentFilters = {};
    currentFilterViewId = null;
    document.getElementById('searchKeyword').value = '';
    document.getElementById('searchStatus').value = '';
    document.getElementById('searchDept').value = '';
    document.getElementById('searchPriority').value = '';
    document.getElementById('searchCategory').value = '';
    document.getElementById('searchMode').value = '';
    document.getElementById('searchStartDate').value = '';
    document.getElementById('searchEndDate').value = '';
    updateFilterViewTabs();
    document.getElementById('docListTable').innerHTML = renderDocTable();
}

function applyFilterView(viewId) {
    if (viewId === null) {
        currentFilters = {};
        currentFilterViewId = null;
    } else {
        const view = filterViewStore.getViewById(viewId);
        if (!view) {
            showToast('视图不存在', 'error');
            return;
        }
        currentFilters = { ...view.filters };
        currentFilterViewId = viewId;
    }

    if (document.getElementById('searchKeyword')) {
        document.getElementById('searchKeyword').value = currentFilters.keyword || '';
    }
    if (document.getElementById('searchStatus')) {
        document.getElementById('searchStatus').value = currentFilters.status || '';
    }
    if (document.getElementById('searchDept')) {
        document.getElementById('searchDept').value = currentFilters.assignedDept || '';
    }
    if (document.getElementById('searchPriority')) {
        document.getElementById('searchPriority').value = currentFilters.priority || '';
    }
    if (document.getElementById('searchCategory')) {
        document.getElementById('searchCategory').value = currentFilters.category || '';
    }
    if (document.getElementById('searchMode')) {
        const modeVal = currentFilters.isMultiDept === true ? 'multi' : (currentFilters.isMultiDept === false ? 'single' : '');
        document.getElementById('searchMode').value = modeVal;
    }
    if (document.getElementById('searchStartDate')) {
        document.getElementById('searchStartDate').value = currentFilters.startDate || '';
    }
    if (document.getElementById('searchEndDate')) {
        document.getElementById('searchEndDate').value = currentFilters.endDate || '';
    }

    updateFilterViewTabs();
    document.getElementById('docListTable').innerHTML = renderDocTable();
    if (viewId) {
        showToast('已切换到视图：' + filterViewStore.getViewById(viewId).name, 'success');
    }
}

function updateFilterViewTabs() {
    const tabsContainer = document.getElementById('filterViewTabs');
    if (!tabsContainer) return;

    const tabs = tabsContainer.querySelectorAll('.filter-view-tab');
    tabs.forEach(tab => {
        const viewId = tab.dataset.viewId || null;
        if (currentFilterViewId === viewId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

function openSaveViewModal(viewId) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    const isEdit = !!viewId;
    const view = isEdit ? filterViewStore.getViewById(viewId) : null;

    if (isEdit && !view) {
        showToast('视图不存在', 'error');
        return;
    }

    if (!isEdit) {
        const hasFilters = currentFilters && (
            currentFilters.keyword ||
            currentFilters.status ||
            currentFilters.assignedDept ||
            currentFilters.priority
        );
        if (!hasFilters) {
            showToast('请先设置筛选条件再保存视图', 'warning');
            return;
        }
    }

    const filters = isEdit ? view.filters : currentFilters;
    const name = isEdit ? view.name : '';

    const filterOptions = [
        { key: 'keyword', label: '关键词（标题/文号）', value: filters.keyword || '', displayValue: filters.keyword || '' },
        { key: 'status', label: '状态', value: filters.status || '', displayValue: filters.status ? getStatusLabelByNode(filters.status) : '' },
        { key: 'assignedDept', label: '承办科室', value: filters.assignedDept || '', displayValue: filters.assignedDept || '' },
        { key: 'priority', label: '紧急程度', value: filters.priority || '', displayValue: filters.priority ? (PRIORITY_LABELS[filters.priority] || filters.priority) : '' }
    ];

    modalTitle.textContent = isEdit ? '编辑筛选视图' : '保存筛选视图';
    modalBody.innerHTML = `
        <div class="form-group">
            <label class="form-label">视图名称 <span class="form-required">*</span></label>
            <input type="text" class="form-input" id="saveViewNameInput" placeholder="请输入视图名称" value="${escapeHtml(name)}">
        </div>
        <div class="form-group">
            <label class="form-label">选择要保存的筛选项</label>
            <div class="filter-options-list">
                ${filterOptions.map(opt => `
                    <label class="filter-option-item">
                        <input type="checkbox" class="filter-option-checkbox" data-field="${opt.key}"
                            ${opt.value ? 'checked' : ''} ${!opt.value && !isEdit ? 'disabled' : ''}>
                        <span class="filter-option-label">${opt.label}</span>
                        ${opt.value ? `<span class="filter-option-value">${escapeHtml(opt.displayValue)}</span>` : ''}
                    </label>
                `).join('')}
            </div>
        </div>
        <div style="text-align:right; margin-top:20px;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="doSaveView(${isEdit ? `'${viewId}'` : 'null'})">${isEdit ? '保存修改' : '保存'}</button>
        </div>
    `;

    modal.classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('saveViewNameInput').focus();
    }, 100);
}

function doSaveView(viewId) {
    const nameInput = document.getElementById('saveViewNameInput');
    const name = nameInput.value.trim();

    if (!name) {
        showToast('请输入视图名称', 'warning');
        nameInput.focus();
        return;
    }

    const checkboxes = document.querySelectorAll('.filter-option-checkbox:checked');
    const selectedFields = Array.from(checkboxes).map(cb => cb.dataset.field);

    if (selectedFields.length === 0) {
        showToast('请至少选择一个筛选项', 'warning');
        return;
    }

    const sourceFilters = viewId ? filterViewStore.getViewById(viewId).filters : currentFilters;
    const filtersToSave = {};
    selectedFields.forEach(field => {
        if (sourceFilters[field] !== undefined && sourceFilters[field] !== '' && sourceFilters[field] !== null) {
            filtersToSave[field] = sourceFilters[field];
        }
    });

    let result;
    if (viewId) {
        result = filterViewStore.updateView(viewId, name, filtersToSave);
    } else {
        result = filterViewStore.createView(name, filtersToSave);
    }

    if (result.success) {
        closeModal();
        currentFilterViewId = result.view.id;
        if (!viewId) {
            currentFilters = { ...result.view.filters };
        }
        renderDocList();
        showToast(viewId ? '视图修改成功' : '视图保存成功', 'success');
    } else {
        showToast(result.error, 'error');
    }
}

function applyFilterView(viewId) {
    if (viewId === null) {
        currentFilters = {};
        currentFilterViewId = null;
    } else {
        const view = filterViewStore.getViewById(viewId);
        if (!view) {
            showToast('视图不存在', 'error');
            return;
        }
        currentFilters = { ...view.filters };
        currentFilterViewId = viewId;
    }

    syncFilterControls();
    updateFilterViewTabs();
    document.getElementById('docListTable').innerHTML = renderDocTable();

    if (viewId) {
        const view = filterViewStore.getViewById(viewId);
        showToast('已切换到视图：' + view.name, 'success');
    }
}

function syncFilterControls() {
    if (document.getElementById('searchKeyword')) {
        document.getElementById('searchKeyword').value = currentFilters.keyword || '';
    }
    if (document.getElementById('searchStatus')) {
        document.getElementById('searchStatus').value = currentFilters.status || '';
    }
    if (document.getElementById('searchDept')) {
        document.getElementById('searchDept').value = currentFilters.assignedDept || '';
    }
    if (document.getElementById('searchPriority')) {
        document.getElementById('searchPriority').value = currentFilters.priority || '';
    }
    if (document.getElementById('searchCategory')) {
        document.getElementById('searchCategory').value = currentFilters.category || '';
    }
    if (document.getElementById('searchMode')) {
        const modeVal = currentFilters.isMultiDept === true ? 'multi' : (currentFilters.isMultiDept === false ? 'single' : '');
        document.getElementById('searchMode').value = modeVal;
    }
    if (document.getElementById('searchStartDate')) {
        document.getElementById('searchStartDate').value = currentFilters.startDate || '';
    }
    if (document.getElementById('searchEndDate')) {
        document.getElementById('searchEndDate').value = currentFilters.endDate || '';
    }
}

function updateFilterViewTabs() {
    const tabsContainer = document.getElementById('filterViewTabs');
    if (!tabsContainer) return;

    const tabs = tabsContainer.querySelectorAll('.filter-view-tab');
    tabs.forEach(tab => {
        const viewId = tab.dataset.viewId || null;
        if (currentFilterViewId === viewId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

function deleteFilterView(viewId) {
    const view = filterViewStore.getViewById(viewId);
    if (!view) return;

    if (!confirm(`确定要删除视图"${view.name}"吗？`)) {
        return;
    }

    const result = filterViewStore.deleteView(viewId);
    if (result.success) {
        if (currentFilterViewId === viewId) {
            currentFilterViewId = null;
            currentFilters = {};
            syncFilterControls();
        }
        renderDocList();
        showToast('视图已删除', 'success');
    } else {
        showToast(result.error, 'error');
    }
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

function renderStatistics() {
    const content = document.getElementById('contentArea');
    const stats = dataStore.getAnalyticsStats();

    const statusItems = Object.entries(stats.statusDistribution).map(([key, count]) => ({
        key,
        label: getStatusLabelByNode(key),
        count
    }));

    const deptItems = Object.entries(stats.deptDistribution)
        .filter(([_, count]) => count > 0)
        .map(([key, count]) => ({ key, label: key, count }))
        .sort((a, b) => b.count - a.count);

    const priorityItems = Object.entries(stats.priorityDistribution).map(([key, count]) => ({
        key,
        label: PRIORITY_LABELS[key] || key,
        count
    }));

    const categoryItems = Object.entries(stats.categoryDistribution)
        .filter(([_, count]) => count > 0)
        .map(([key, count]) => ({ key, label: key, count }))
        .sort((a, b) => b.count - a.count);

    const maxDeptCount = Math.max(...deptItems.map(d => d.count), 1);
    const maxCategoryCount = Math.max(...categoryItems.map(d => d.count), 1);
    const maxDayCount = Math.max(...stats.last30Days.map(d => d.count), 1);

    const statusColors = {
        [FLOW_NODES.REGISTER]: '#91d5ff',
        [FLOW_NODES.PROPOSE]: '#ffd591',
        [FLOW_NODES.ASSIGN]: '#ffc069',
        [FLOW_NODES.HANDLE]: '#ffa940',
        [FLOW_NODES.FEEDBACK]: '#ffa39e',
        [FLOW_NODES.COMPLETE]: '#b7eb8f'
    };

    const priorityColors = {
        'normal': '#52c41a',
        'high': '#fa8c16',
        'urgent': '#f5222d'
    };

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">公文统计分析</h2>
            <div class="page-subtitle">全局流转数据概览 · 实时统计</div>
        </div>

        <div class="stats-grid statistics-overview">
            <div class="stat-card stat-overview-card">
                <div class="stat-icon blue">📄</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">公文总数</div>
                </div>
            </div>
            <div class="stat-card stat-overview-card">
                <div class="stat-icon green">✅</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.completedCount}</div>
                    <div class="stat-label">已办结</div>
                </div>
            </div>
            <div class="stat-card stat-overview-card">
                <div class="stat-icon orange">⏳</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.total - stats.completedCount}</div>
                    <div class="stat-label">办理中</div>
                </div>
            </div>
            <div class="stat-card stat-overview-card">
                <div class="stat-icon purple">⏱️</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.avgHandleDays}<span style="font-size:14px;font-weight:400;"> 天</span></div>
                    <div class="stat-label">平均办理时长</div>
                </div>
            </div>
        </div>

        <div class="statistics-row">
            <div class="card statistics-card">
                <div class="card-header">
                    <span class="card-title">📊 按状态分布</span>
                </div>
                <div class="card-body">
                    <div class="status-distribution">
                        ${statusItems.map(item => `
                            <div class="distribution-item" onclick="goToListFromStats('status', '${item.key}')">
                                <div class="distribution-label">
                                    <span class="distribution-dot" style="background:${statusColors[item.key] || '#d9d9d9'}"></span>
                                    <span class="distribution-name">${item.label}</span>
                                </div>
                                <div class="distribution-value">
                                    <span class="distribution-count">${item.count}</span>
                                    <span class="distribution-arrow">→</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="card statistics-card">
                <div class="card-header">
                    <span class="card-title">🏢 按科室分布</span>
                </div>
                <div class="card-body">
                    <div class="bar-chart">
                        ${deptItems.length > 0 ? deptItems.map(item => `
                            <div class="bar-item" onclick="goToListFromStats('assignedDept', '${item.key}')">
                                <div class="bar-label">
                                    <span class="bar-name">${item.label}</span>
                                    <span class="bar-count">${item.count}</span>
                                </div>
                                <div class="bar-track">
                                    <div class="bar-fill bar-fill-dept" style="width:${(item.count / maxDeptCount * 100).toFixed(1)}%"></div>
                                </div>
                            </div>
                        `).join('') : '<div class="empty-state" style="padding:30px 0;"><p>暂无数据</p></div>'}
                    </div>
                </div>
            </div>
        </div>

        <div class="statistics-row">
            <div class="card statistics-card">
                <div class="card-header">
                    <span class="card-title">🚨 按紧急程度分布</span>
                </div>
                <div class="card-body">
                    <div class="priority-distribution">
                        ${priorityItems.map(item => `
                            <div class="priority-item" onclick="goToListFromStats('priority', '${item.key}')">
                                <div class="priority-ring" style="border-color:${priorityColors[item.key]}">
                                    <span class="priority-count">${item.count}</span>
                                    <span class="priority-label">${item.label}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="card statistics-card">
                <div class="card-header">
                    <span class="card-title">📑 按公文类别分布</span>
                </div>
                <div class="card-body">
                    <div class="bar-chart">
                        ${categoryItems.length > 0 ? categoryItems.map(item => `
                            <div class="bar-item" onclick="goToListFromStats('category', '${item.key === '未分类' ? '__none__' : item.key}')">
                                <div class="bar-label">
                                    <span class="bar-name">${item.label}</span>
                                    <span class="bar-count">${item.count}</span>
                                </div>
                                <div class="bar-track">
                                    <div class="bar-fill bar-fill-category" style="width:${(item.count / maxCategoryCount * 100).toFixed(1)}%"></div>
                                </div>
                            </div>
                        `).join('') : '<div class="empty-state" style="padding:30px 0;"><p>暂无数据</p></div>'}
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">📈 近30天登记量趋势</span>
                <span class="card-subtitle">共 ${stats.last30Days.reduce((s, d) => s + d.count, 0)} 件</span>
            </div>
            <div class="card-body">
                <div class="line-chart">
                    <div class="line-chart-bars">
                        ${stats.last30Days.map(item => {
                            const height = maxDayCount > 0 ? (item.count / maxDayCount * 100) : 0;
                            const showLabel = item.date.endsWith('01') || item.date.endsWith('15') || item.date === stats.last30Days[stats.last30Days.length - 1].date;
                            return `
                                <div class="line-bar-item" title="${item.date}: ${item.count}件" onclick="goToListFromStats('createdDate', '${item.date}')" role="button" tabindex="0">
                                    <div class="line-bar-value">${item.count > 0 ? item.count : ''}</div>
                                    <div class="line-bar-wrap">
                                        <div class="line-bar-fill" style="height:${height}%"></div>
                                    </div>
                                    <div class="line-bar-label">${showLabel ? item.date.slice(5) : ''}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function goToListFromStats(filterKey, filterValue) {
    const filters = {};
    if (filterKey && filterValue !== undefined && filterValue !== null && filterValue !== '') {
        if (filterKey === 'createdDate') {
            filters.startDate = filterValue;
            filters.endDate = filterValue;
        } else {
            filters[filterKey] = filterValue;
        }
    }
    navigateTo('list', { filters });
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
    userStore.getDepartments().forEach(d => {
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
    userStore.getDepartments().forEach(d => {
        if (d !== '办公室') {
            deptOptions.push({ value: d, label: d });
        }
    });

    const staffOptions = [{ value: '', label: '全部承办人' }];
    userStore.getUsersByRole(ROLES.STAFF).forEach(s => {
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
        const staff = userStore.getUsersByDept(dept).filter(u => u.role === ROLES.STAFF);
        staff.forEach(s => {
            options += `<option value="${s.id}">${s.name}</option>`;
        });
    } else {
        userStore.getUsersByRole(ROLES.STAFF).forEach(s => {
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

function renderAttachmentCenter() {
    const content = document.getElementById('contentArea');
    const stats = dataStore.getAttachmentStats();

    const nodeOptions = [{ value: '', label: '全部节点' }];
    Object.entries(NODE_LABELS).forEach(([key, label]) => {
        nodeOptions.push({ value: key, label: label });
    });

    const deptOptions = [{ value: '', label: '全部科室' }];
    userStore.getDepartments().forEach(d => deptOptions.push({ value: d, label: d }));

    const fileTypeOptions = [{ value: '', label: '全部类型' }];
    Object.entries(FILE_TYPE_LABELS).forEach(([key, label]) => {
        fileTypeOptions.push({ value: key, label: label });
    });

    const categoryOptions = [{ value: '', label: '全部分类' }];
    Object.entries(ATTACHMENT_CATEGORY_LABELS).forEach(([key, label]) => {
        categoryOptions.push({ value: key, label: label });
    });

    const uploaderOptions = [{ value: '', label: '全部上传人' }];
    userStore.getAllUsers().forEach(u => {
        uploaderOptions.push({ value: u.id, label: `${u.name}（${u.dept}）` });
    });

    const kw = currentAttachmentFilters.keyword || '';
    const node = currentAttachmentFilters.node || '';
    const uploaderId = currentAttachmentFilters.uploaderId || '';
    const uploaderDept = currentAttachmentFilters.uploaderDept || '';
    const fileType = currentAttachmentFilters.fileType || '';
    const category = currentAttachmentFilters.category || '';
    const startDate = currentAttachmentFilters.startDate || '';
    const endDate = currentAttachmentFilters.endDate || '';

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">附件管理中心</h2>
            <div class="page-subtitle">集中管理所有公文流转中的附件</div>
        </div>

        <div class="stats-grid attachment-stats-grid">
            <div class="stat-card attachment-stat-card">
                <div class="stat-icon blue">📎</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.total}</div>
                    <div class="stat-label">附件总数</div>
                </div>
            </div>
            <div class="stat-card attachment-stat-card">
                <div class="stat-icon green">📅</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.last7Days}</div>
                    <div class="stat-label">近7天新增</div>
                </div>
            </div>
            <div class="stat-card attachment-stat-card">
                <div class="stat-icon orange">📊</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.last30Days}</div>
                    <div class="stat-label">近30天新增</div>
                </div>
            </div>
            <div class="stat-card attachment-stat-card">
                <div class="stat-icon purple">📄</div>
                <div class="stat-info">
                    <div class="stat-number">${stats.byType.doc + stats.byType.pdf || 0}</div>
                    <div class="stat-label">文档类</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar attachment-search-bar">
                    <div class="form-group">
                        <label class="form-label">关键词</label>
                        <input type="text" class="form-input" id="attKeyword" placeholder="文件名、公文标题、文号"
                               value="${kw}"
                               onkeyup="if(event.key==='Enter') applyAttachmentFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">上传节点</label>
                        <select class="form-select" id="attNode" onchange="applyAttachmentFilters()">
                            ${nodeOptions.map(o => `<option value="${o.value}" ${o.value === node ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">上传科室</label>
                        <select class="form-select" id="attDept" onchange="updateAttachmentUploaderOptions(); applyAttachmentFilters()">
                            ${deptOptions.map(o => `<option value="${o.value}" ${o.value === uploaderDept ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">上传人</label>
                        <select class="form-select" id="attUploader" onchange="applyAttachmentFilters()">
                            ${uploaderOptions.map(o => `<option value="${o.value}" ${o.value === uploaderId ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">文件类型</label>
                        <select class="form-select" id="attFileType" onchange="applyAttachmentFilters()">
                            ${fileTypeOptions.map(o => `<option value="${o.value}" ${o.value === fileType ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">附件分类</label>
                        <select class="form-select" id="attCategory" onchange="applyAttachmentFilters()">
                            ${categoryOptions.map(o => `<option value="${o.value}" ${o.value === category ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">开始日期</label>
                        <input type="date" class="form-input" id="attStartDate" value="${startDate}" onchange="applyAttachmentFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">结束日期</label>
                        <input type="date" class="form-input" id="attEndDate" value="${endDate}" onchange="applyAttachmentFilters()">
                    </div>
                    <div class="search-actions">
                        <button class="btn btn-primary" onclick="applyAttachmentFilters()">🔍 查询</button>
                        <button class="btn btn-default" onclick="resetAttachmentFilters()">重置</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;" id="attachmentListTable">
                ${renderAttachmentTable()}
            </div>
        </div>
    `;
}

function applyAttachmentFilters() {
    currentAttachmentFilters = {
        keyword: document.getElementById('attKeyword').value.trim(),
        node: document.getElementById('attNode').value,
        uploaderId: document.getElementById('attUploader').value,
        uploaderDept: document.getElementById('attDept').value,
        fileType: document.getElementById('attFileType').value,
        category: document.getElementById('attCategory').value,
        startDate: document.getElementById('attStartDate').value,
        endDate: document.getElementById('attEndDate').value
    };
    document.getElementById('attachmentListTable').innerHTML = renderAttachmentTable();
}

function resetAttachmentFilters() {
    currentAttachmentFilters = {};
    document.getElementById('attKeyword').value = '';
    document.getElementById('attNode').value = '';
    document.getElementById('attDept').value = '';
    document.getElementById('attUploader').value = '';
    document.getElementById('attFileType').value = '';
    document.getElementById('attCategory').value = '';
    document.getElementById('attStartDate').value = '';
    document.getElementById('attEndDate').value = '';
    document.getElementById('attachmentListTable').innerHTML = renderAttachmentTable();
}

function updateAttachmentUploaderOptions() {
    const dept = document.getElementById('attDept').value;
    const uploaderSelect = document.getElementById('attUploader');

    let options = '<option value="">全部上传人</option>';

    if (dept) {
        const users = userStore.getUsersByDept(dept);
        users.forEach(u => {
            options += `<option value="${u.id}">${u.name}</option>`;
        });
    } else {
        userStore.getAllUsers().forEach(u => {
            options += `<option value="${u.id}">${u.name}（${u.dept}）</option>`;
        });
    }

    uploaderSelect.innerHTML = options;
}

function renderAttachmentTable() {
    const attachments = dataStore.listAttachments(currentAttachmentFilters);

    if (attachments.length === 0) {
        return '<div class="empty-state"><div class="empty-icon">📎</div><p>暂无符合条件的附件</p></div>';
    }

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>文件</th>
                        <th>类型</th>
                        <th>附件分类</th>
                        <th>所属公文</th>
                        <th>上传节点</th>
                        <th>上传人</th>
                        <th>上传科室</th>
                        <th>上传时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${attachments.map(att => `
                        <tr>
                            <td>
                                <div class="attachment-file-cell">
                                    <span class="attachment-file-icon">${att.fileIcon}</span>
                                    <div>
                                        <div class="attachment-file-name" title="${att.fileName}">${att.fileName}</div>
                                        ${att.remark ? `<div class="attachment-remark-text" title="${escapeHtml(att.remark)}">备注：${escapeHtml(att.remark)}</div>` : ''}
                                    </div>
                                </div>
                            </td>
                            <td><span class="file-type-badge file-type-${att.fileType}">${att.fileTypeLabel}</span></td>
                            <td><span class="att-category-badge att-cat-${att.category}">${att.categoryLabel}</span></td>
                            <td class="td-ellipsis" title="${att.docTitle}">
                                <div style="font-size:12px; color:#999; margin-bottom:2px;">${att.docId}</div>
                                <div>${att.docTitle}</div>
                            </td>
                            <td>
                                <span class="attachment-node-tag">${att.nodeLabel}</span>
                                ${att.isReturn ? '<span class="badge-return">退回</span>' : ''}
                                ${att.isResubmit ? '<span class="badge-resubmit">重提</span>' : ''}
                                ${att.handleType ? `<span class="badge-handle-${att.handleType}">${att.handleType === 'main' ? '主办' : '协办'}</span>` : ''}
                            </td>
                            <td>${att.uploaderName || '-'}</td>
                            <td>${att.uploaderDept || '-'}</td>
                            <td>${formatDateTime(att.uploadTime)}</td>
                            <td>
                                <a class="action-link" onclick="goToDocFromAttachment('${att.docId}', '${att.recordId}')">查看公文</a>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function goToDocFromAttachment(docId, recordId) {
    currentDocId = docId;
    isArchiveDetail = false;
    navigateTo('detail', { id: docId });
    setTimeout(() => {
        const recordEl = document.querySelector(`[data-record-id="${recordId}"]`);
        if (recordEl) {
            recordEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            recordEl.classList.add('timeline-highlight');
            setTimeout(() => {
                recordEl.classList.remove('timeline-highlight');
            }, 3000);
        }
    }, 100);
}

function renderRegisterForm() {
    clearDraftAutoSave();
    isDraftFormDirty = false;
    isDraftSaving = false;

    const content = document.getElementById('contentArea');
    const isEditDraft = !!currentDraftId;
    let draft = null;
    let pageTitle = '收文登记';
    let backButton = "navigateTo('list')";
    let backLabel = '返回列表';

    if (isEditDraft) {
        draft = dataStore.getDraft(currentDraftId);
        if (!draft) {
            content.innerHTML = '<div class="empty-state"><p>草稿不存在</p><button class="btn btn-primary" onclick="navigateTo(\'drafts\')">返回草稿箱</button></div>';
            return;
        }
        pageTitle = '编辑草稿';
        backButton = "navigateTo('drafts')";
        backLabel = '返回草稿箱';
        draftLastSavedAt = draft.updatedAt;
    } else {
        draftLastSavedAt = null;
    }

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">${pageTitle}</h2>
            <div class="page-header-actions">
                <span id="draftSaveStatus" class="draft-save-status hidden"></span>
                <button class="btn btn-default" onclick="${backButton}">${backLabel}</button>
            </div>
        </div>

        ${isEditDraft ? `<div class="draft-info-bar"><span class="draft-icon">📝</span><span id="draftLastSavedText">草稿最后保存时间：${formatDateTime(draft.updatedAt)}</span></div>` : ''}

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
                        <label class="form-label">办理期限</label>
                        <input type="date" class="form-input" id="regDeadline">
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
                            <option value="意见">意见</option>
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
                    <button class="btn btn-default" onclick="${backButton}" style="margin-right:8px;">取消</button>
                    <button class="btn btn-default" onclick="saveDraftManually()" style="margin-right:8px;" id="btnSaveDraft">💾 保存草稿</button>
                    <button class="btn btn-primary btn-lg" onclick="submitRegister()">${isEditDraft ? '提交草稿' : '提交登记'}</button>
                </div>
            </div>
        </div>
    `;

    if (isEditDraft && draft) {
        document.getElementById('regTitle').value = draft.title || '';
        document.getElementById('regFromUnit').value = draft.fromUnit || '';
        document.getElementById('regDocNumber').value = draft.docNumber || '';
        document.getElementById('regDocDate').value = draft.docDate || '';
        document.getElementById('regDeadline').value = draft.deadline || '';
        document.getElementById('regPriority').value = draft.priority || 'normal';
        document.getElementById('regCategory').value = draft.category || '';
        document.getElementById('regContent').value = draft.content || '';

        registerAttachments = [...(draft.attachments || [])];
        renderAttachmentList('regAttachmentsList', registerAttachments);
    } else {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('regDocDate').value = today;
    }

    setupDraftFormListeners();
}

function setupDraftFormListeners() {
    const formInputs = [
        'regTitle', 'regFromUnit', 'regDocNumber', 'regDocDate', 'regDeadline',
        'regPriority', 'regCategory', 'regContent'
    ];

    formInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', onDraftFormChange);
            el.addEventListener('change', onDraftFormChange);
        }
    });
}

function onDraftFormChange() {
    isDraftFormDirty = true;
    updateDraftSaveStatus('unsaved');
    scheduleAutoSave();
}

function scheduleAutoSave() {
    if (draftAutoSaveTimer) {
        clearTimeout(draftAutoSaveTimer);
    }
    draftAutoSaveTimer = setTimeout(() => {
        autoSaveDraft();
    }, 3000);
}

function clearDraftAutoSave() {
    if (draftAutoSaveTimer) {
        clearTimeout(draftAutoSaveTimer);
        draftAutoSaveTimer = null;
    }
}

function autoSaveDraft() {
    if (!isDraftFormDirty || isDraftSaving) return;

    const title = document.getElementById('regTitle')?.value.trim() || '';
    const fromUnit = document.getElementById('regFromUnit')?.value.trim() || '';
    const docNumber = document.getElementById('regDocNumber')?.value.trim() || '';
    const deadline = document.getElementById('regDeadline')?.value || '';
    const content = document.getElementById('regContent')?.value.trim() || '';

    if (!title && !fromUnit && !docNumber && !deadline && !content && registerAttachments.length === 0) {
        isDraftFormDirty = false;
        updateDraftSaveStatus('empty');
        return;
    }

    isDraftSaving = true;
    updateDraftSaveStatus('saving');

    const formData = getRegisterFormData();

    setTimeout(() => {
        try {
            if (currentDraftId) {
                const draft = dataStore.updateDraft(currentDraftId, formData, currentUser);
                if (draft) {
                    draftLastSavedAt = draft.updatedAt;
                    isDraftFormDirty = false;
                    updateDraftSaveStatus('saved');
                    updateDraftLastSavedText(draft.updatedAt);
                }
            } else {
                const draft = dataStore.createDraft(formData, currentUser);
                currentDraftId = draft.id;
                draftLastSavedAt = draft.updatedAt;
                isDraftFormDirty = false;
                updateDraftSaveStatus('saved');
                updateDraftInfoBar();
            }
        } catch (e) {
            console.error('自动保存失败', e);
            updateDraftSaveStatus('error');
        }
        isDraftSaving = false;
    }, 300);
}

function saveDraftManually() {
    clearDraftAutoSave();
    const title = document.getElementById('regTitle')?.value.trim() || '';
    const fromUnit = document.getElementById('regFromUnit')?.value.trim() || '';
    const docNumber = document.getElementById('regDocNumber')?.value.trim() || '';
    const deadline = document.getElementById('regDeadline')?.value || '';
    const content = document.getElementById('regContent')?.value.trim() || '';

    if (!title && !fromUnit && !docNumber && !deadline && !content && registerAttachments.length === 0) {
        showToast('请至少填写一项内容后再保存草稿', 'warning');
        return;
    }

    isDraftSaving = true;
    updateDraftSaveStatus('saving');

    const formData = getRegisterFormData();

    if (currentDraftId) {
        const draft = dataStore.updateDraft(currentDraftId, formData, currentUser);
        if (draft) {
            draftLastSavedAt = draft.updatedAt;
            isDraftFormDirty = false;
            isDraftSaving = false;
            updateDraftSaveStatus('saved');
            updateDraftLastSavedText(draft.updatedAt);
            showToast('草稿已保存');
        } else {
            isDraftSaving = false;
            updateDraftSaveStatus('error');
            showToast('保存失败', 'error');
        }
    } else {
        const draft = dataStore.createDraft(formData, currentUser);
        currentDraftId = draft.id;
        draftLastSavedAt = draft.updatedAt;
        isDraftFormDirty = false;
        isDraftSaving = false;
        updateDraftSaveStatus('saved');
        updateDraftInfoBar();
        showToast('草稿已保存');
    }
}

function updateDraftSaveStatus(status) {
    const statusEl = document.getElementById('draftSaveStatus');
    if (!statusEl) return;

    statusEl.classList.remove('hidden');

    switch (status) {
        case 'saving':
            statusEl.className = 'draft-save-status saving';
            statusEl.innerHTML = '⏳ 正在保存...';
            break;
        case 'saved':
            statusEl.className = 'draft-save-status saved';
            statusEl.innerHTML = '✓ 已自动保存';
            break;
        case 'unsaved':
            statusEl.className = 'draft-save-status unsaved';
            statusEl.innerHTML = '● 有未保存的更改';
            break;
        case 'error':
            statusEl.className = 'draft-save-status error';
            statusEl.innerHTML = '✗ 保存失败';
            break;
        case 'empty':
        default:
            statusEl.classList.add('hidden');
            break;
    }
}

function updateDraftLastSavedText(time) {
    const textEl = document.getElementById('draftLastSavedText');
    if (textEl) {
        textEl.textContent = '草稿最后保存时间：' + formatDateTime(time);
    }
}

function updateDraftInfoBar() {
    const infoBar = document.querySelector('.draft-info-bar');
    if (!infoBar && draftLastSavedAt) {
        const header = document.querySelector('.page-header');
        if (header) {
            const bar = document.createElement('div');
            bar.className = 'draft-info-bar';
            bar.innerHTML = `<span class="draft-icon">📝</span><span id="draftLastSavedText">草稿最后保存时间：${formatDateTime(draftLastSavedAt)}</span>`;
            header.after(bar);
        }
    }
}

function showAutoDraftPromptIfNeeded() {
    if (currentRole !== ROLES.OFFICE || currentDraftId) return;

    const drafts = dataStore.listDrafts({ userId: currentUser.id });
    if (!drafts.length) return;

    const draft = drafts[0];
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = '发现未提交草稿';
    modalBody.innerHTML = `
        <div class="draft-detail-item">
            <div class="draft-detail-label">最近保存</div>
            <div class="draft-detail-value">${formatDateTime(draft.updatedAt)}</div>
        </div>
        <div class="draft-detail-item">
            <div class="draft-detail-label">公文标题</div>
            <div class="draft-detail-value">${escapeHtml(draft.title || '（无标题）')}</div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div class="draft-detail-item">
                <div class="draft-detail-label">来文单位</div>
                <div class="draft-detail-value">${escapeHtml(draft.fromUnit || '-')}</div>
            </div>
            <div class="draft-detail-item">
                <div class="draft-detail-label">办理期限</div>
                <div class="draft-detail-value">${draft.deadline ? formatDate(draft.deadline) : '-'}</div>
            </div>
        </div>
        <div style="text-align:right; margin-top:20px;">
            <button class="btn btn-default" onclick="discardAutoDraft('${draft.id}')">放弃草稿</button>
            <button class="btn btn-primary" onclick="continueAutoDraft('${draft.id}')">继续编辑</button>
        </div>
    `;
    modal.classList.remove('hidden');
}

function continueAutoDraft(draftId) {
    closeModal();
    currentDraftId = draftId;
    renderNav();
    renderRegisterForm();
}

function discardAutoDraft(draftId) {
    const success = dataStore.deleteDraft(draftId, currentUser);
    if (!success) {
        showToast('放弃草稿失败', 'error');
        return;
    }
    closeModal();
    currentDraftId = null;
    isDraftFormDirty = false;
    draftLastSavedAt = null;
    registerAttachments = [];
    renderNav();
    renderRegisterForm();
    showToast('已放弃自动草稿');
}

function saveDraft() {
    saveDraftManually();
}

function handleFileSelect(input, listId) {
    const files = input.files;
    const list = document.getElementById(listId);

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachment = {
            name: file.name,
            size: formatFileSize(file.size),
            id: 'att_' + Date.now() + '_' + i,
            category: ATTACHMENT_CATEGORIES.OTHER,
            remark: ''
        };

        if (listId === 'regAttachmentsList') {
            registerAttachments.push(attachment);
            onDraftFormChange();
            renderAttachmentList('regAttachmentsList', registerAttachments);
        }
    }

    input.value = '';
}

function removeAttachment(id, listId) {
    if (listId === 'regAttachmentsList') {
        registerAttachments = registerAttachments.filter(a => a.id !== id);
        onDraftFormChange();
        renderAttachmentList('regAttachmentsList', registerAttachments);
    }
}

function renderAttachmentList(listId, attachments) {
    const list = document.getElementById(listId);
    if (!list) return;
    
    list.innerHTML = '';
    attachments.forEach(att => {
        const item = document.createElement('div');
        item.className = 'attachment-item attachment-item-editable';
        item.innerHTML = `
            <div class="attachment-item-header">
                <span class="attachment-icon">${getFileIcon(att.name)}</span>
                <span class="attachment-name" title="${att.name}">${att.name}</span>
                <span class="attachment-size">${att.size}</span>
                <a class="action-link action-delete" onclick="removeAttachment('${att.id}', '${listId}')">删除</a>
            </div>
            <div class="attachment-item-body">
                <div class="attachment-item-field">
                    <label class="attachment-item-label">附件分类：</label>
                    <select class="form-select form-select-sm" onchange="updateAttachmentCategory('${att.id}', '${listId}', this.value)">
                        ${Object.entries(ATTACHMENT_CATEGORY_LABELS).map(([key, label]) =>
                            `<option value="${key}" ${att.category === key ? 'selected' : ''}>${label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="attachment-item-field">
                    <label class="attachment-item-label">备注：</label>
                    <input type="text" class="form-input form-input-sm" placeholder="请输入备注" 
                           value="${escapeHtml(att.remark || '')}"
                           onchange="updateAttachmentRemark('${att.id}', '${listId}', this.value)">
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

function updateAttachmentCategory(attId, listId, category) {
    if (listId === 'regAttachmentsList') {
        const att = registerAttachments.find(a => a.id === attId);
        if (att) {
            att.category = category;
            onDraftFormChange();
        }
    }
}

function updateAttachmentRemark(attId, listId, remark) {
    if (listId === 'regAttachmentsList') {
        const att = registerAttachments.find(a => a.id === attId);
        if (att) {
            att.remark = remark;
            onDraftFormChange();
        }
    }
}

function getRegisterFormData() {
    return {
        title: document.getElementById('regTitle').value.trim(),
        fromUnit: document.getElementById('regFromUnit').value.trim(),
        docNumber: document.getElementById('regDocNumber').value.trim(),
        docDate: document.getElementById('regDocDate').value,
        deadline: document.getElementById('regDeadline').value,
        priority: document.getElementById('regPriority').value,
        category: document.getElementById('regCategory').value,
        content: document.getElementById('regContent').value.trim(),
        attachments: [...registerAttachments]
    };
}

function saveDraft() {
    const formData = getRegisterFormData();

    if (currentDraftId) {
        const draft = dataStore.updateDraft(currentDraftId, formData, currentUser);
        if (draft) {
            showToast('草稿已保存');
            renderRegisterForm();
        } else {
            showToast('保存失败', 'error');
        }
    } else {
        const draft = dataStore.createDraft(formData, currentUser);
        currentDraftId = draft.id;
        showToast('草稿已保存');
        renderRegisterForm();
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

    if (currentDraftId) {
        if (isDraftFormDirty) {
            const formData = getRegisterFormData();
            const updated = dataStore.updateDraft(currentDraftId, formData, currentUser);
            if (!updated) {
                showToast('保存最新修改失败，请重试', 'error');
                return;
            }
        }

        if (!confirm('确定要提交这篇草稿吗？\n\n提交后将：\n1. 生成正式的公文文号\n2. 自动进入待批示流程\n3. 从草稿箱中移除')) {
            return;
        }

        const result = dataStore.submitDraft(currentDraftId, currentUser);
        if (result && result.success) {
            registerAttachments = [];
            currentDraftId = null;
            clearDraftAutoSave();
            isDraftFormDirty = false;
            showToast('提交成功，已生成正式公文：' + result.doc.id);
            navigateTo('detail', { id: result.doc.id });
        } else {
            showToast(result && result.error ? result.error : '提交失败', 'error');
        }
    } else {
        if (!confirm('确定要提交这份公文登记吗？\n\n提交后将生成正式公文文号并进入待批示流程。')) {
            return;
        }

        const docData = getRegisterFormData();
        const doc = dataStore.createDoc(docData, currentUser);
        registerAttachments = [];
        showToast('收文登记成功：' + doc.id);
        navigateTo('detail', { id: doc.id });
    }
}

function renderDraftList() {
    const content = document.getElementById('contentArea');
    const keyword = currentDraftFilters.keyword || '';
    const priority = currentDraftFilters.priority || '';
    const category = currentDraftFilters.category || '';
    const dateFrom = currentDraftFilters.dateFrom || '';
    const dateTo = currentDraftFilters.dateTo || '';
    const sortField = currentDraftFilters.sortField || 'updatedAt';
    const sortOrder = currentDraftFilters.sortOrder || 'desc';

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">公文草稿箱</h2>
            <button class="btn btn-primary" onclick="navigateTo('register')">+ 新建草稿</button>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar draft-search-bar">
                    <div class="form-group">
                        <label class="form-label">关键词</label>
                        <input type="text" class="form-input" id="draftSearchKeyword" placeholder="标题、来文单位、来文字号"
                               value="${keyword}"
                               onkeyup="if(event.key==='Enter') applyDraftFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">紧急程度</label>
                        <select class="form-select" id="draftFilterPriority" onchange="applyDraftFilters()">
                            <option value="">全部</option>
                            <option value="normal" ${priority === 'normal' ? 'selected' : ''}>普通</option>
                            <option value="high" ${priority === 'high' ? 'selected' : ''}>加急</option>
                            <option value="urgent" ${priority === 'urgent' ? 'selected' : ''}>特急</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">公文类别</label>
                        <select class="form-select" id="draftFilterCategory" onchange="applyDraftFilters()">
                            <option value="">全部</option>
                            <option value="通知" ${category === '通知' ? 'selected' : ''}>通知</option>
                            <option value="请示" ${category === '请示' ? 'selected' : ''}>请示</option>
                            <option value="报告" ${category === '报告' ? 'selected' : ''}>报告</option>
                            <option value="批复" ${category === '批复' ? 'selected' : ''}>批复</option>
                            <option value="函" ${category === '函' ? 'selected' : ''}>函</option>
                            <option value="会议纪要" ${category === '会议纪要' ? 'selected' : ''}>会议纪要</option>
                            <option value="意见" ${category === '意见' ? 'selected' : ''}>意见</option>
                            <option value="其他" ${category === '其他' ? 'selected' : ''}>其他</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">保存日期起</label>
                        <input type="date" class="form-input" id="draftFilterDateFrom" value="${dateFrom}" onchange="applyDraftFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">保存日期止</label>
                        <input type="date" class="form-input" id="draftFilterDateTo" value="${dateTo}" onchange="applyDraftFilters()">
                    </div>
                    <div class="search-actions">
                        <button class="btn btn-primary" onclick="applyDraftFilters()">🔍 查询</button>
                        <button class="btn btn-default" onclick="resetDraftFilters()">重置</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;" id="draftListTable">
                ${renderDraftTable()}
            </div>
        </div>
    `;
}

function renderDraftTable() {
    const filters = {
        userId: currentUser.id,
        keyword: currentDraftFilters.keyword || '',
        priority: currentDraftFilters.priority || '',
        category: currentDraftFilters.category || '',
        dateFrom: currentDraftFilters.dateFrom || '',
        dateTo: currentDraftFilters.dateTo || '',
        sortField: currentDraftFilters.sortField || 'updatedAt',
        sortOrder: currentDraftFilters.sortOrder || 'desc'
    };

    const drafts = dataStore.listDrafts(filters);

    if (drafts.length === 0) {
        return `
            <div class="empty-state" style="padding:60px 20px;">
                <div class="empty-icon">📝</div>
                <p>暂无符合条件的草稿</p>
                <button class="btn btn-primary" onclick="navigateTo('register')">去登记新草稿</button>
            </div>
        `;
    }

    const sortField = currentDraftFilters.sortField || 'updatedAt';
    const sortOrder = currentDraftFilters.sortOrder || 'desc';

    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width:35%; cursor:pointer;" onclick="sortDrafts('title')">
                        公文标题 ${getSortIcon('title', sortField, sortOrder)}
                    </th>
                    <th style="width:15%; cursor:pointer;" onclick="sortDrafts('fromUnit')">
                        来文单位 ${getSortIcon('fromUnit', sortField, sortOrder)}
                    </th>
                    <th style="width:9%;">紧急程度</th>
                    <th style="width:10%; cursor:pointer;" onclick="sortDrafts('deadline')">
                        办理期限 ${getSortIcon('deadline', sortField, sortOrder)}
                    </th>
                    <th style="width:8%;">附件数</th>
                    <th style="width:12%; cursor:pointer;" onclick="sortDrafts('createdAt')">
                        创建时间 ${getSortIcon('createdAt', sortField, sortOrder)}
                    </th>
                    <th style="width:10%; cursor:pointer;" onclick="sortDrafts('updatedAt')">
                        最后保存 ${getSortIcon('updatedAt', sortField, sortOrder)}
                    </th>
                    <th style="width:10%;">操作</th>
                </tr>
            </thead>
            <tbody>
                ${drafts.map(draft => {
                    const attachmentCount = (draft.attachments && draft.attachments.length) || 0;
                    
                    return `
                        <tr class="draft-row" data-id="${draft.id}" ondblclick="viewDraftDetail('${draft.id}')">
                            <td>
                                <div class="doc-title-cell">
                                    <span class="draft-badge">草稿</span>
                                    <span class="doc-title-text">${draft.title || '（无标题）'}</span>
                                </div>
                                ${draft.docNumber ? `<div class="doc-subtitle">${draft.docNumber}</div>` : ''}
                            </td>
                            <td>${draft.fromUnit || '-'}</td>
                            <td>${getPriorityLabel(draft.priority)}</td>
                            <td>${draft.deadline ? formatDate(draft.deadline) : '-'}</td>
                            <td>${attachmentCount} 个</td>
                            <td>${formatDateTime(draft.createdAt)}</td>
                            <td>${formatDateTime(draft.updatedAt)}</td>
                            <td>
                                <div class="table-actions">
                                    <button class="btn btn-sm btn-default" onclick="viewDraftDetail('${draft.id}'); event.stopPropagation();">查看</button>
                                    <button class="btn btn-sm btn-default" onclick="editDraft('${draft.id}'); event.stopPropagation();">编辑</button>
                                    <button class="btn btn-sm btn-primary" onclick="submitDraftFromList('${draft.id}'); event.stopPropagation();">提交</button>
                                    <button class="btn btn-sm btn-danger" onclick="deleteDraftConfirm('${draft.id}'); event.stopPropagation();">删除</button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <div class="table-footer">共 ${drafts.length} 条草稿</div>
    `;
}

function getSortIcon(field, currentField, currentOrder) {
    if (field !== currentField) {
        return '↕';
    }
    return currentOrder === 'asc' ? '↑' : '↓';
}

function sortDrafts(field) {
    if (currentDraftFilters.sortField === field) {
        currentDraftFilters.sortOrder = currentDraftFilters.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentDraftFilters.sortField = field;
        currentDraftFilters.sortOrder = 'desc';
    }
    document.getElementById('draftListTable').innerHTML = renderDraftTable();
}

function applyDraftFilters() {
    currentDraftFilters.keyword = document.getElementById('draftSearchKeyword').value.trim();
    currentDraftFilters.priority = document.getElementById('draftFilterPriority').value;
    currentDraftFilters.category = document.getElementById('draftFilterCategory').value;
    currentDraftFilters.dateFrom = document.getElementById('draftFilterDateFrom').value;
    currentDraftFilters.dateTo = document.getElementById('draftFilterDateTo').value;
    document.getElementById('draftListTable').innerHTML = renderDraftTable();
}

function resetDraftFilters() {
    currentDraftFilters = {};
    renderDraftList();
}

function viewDraftDetail(draftId) {
    const draft = dataStore.getDraft(draftId);
    if (!draft) {
        showToast('草稿不存在', 'error');
        return;
    }

    const attachmentCount = (draft.attachments && draft.attachments.length) || 0;

    const modal = document.createElement('div');
    modal.className = 'draft-detail-modal';
    modal.id = 'draftDetailModal';
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeDraftDetailModal();
        }
    };

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-title">草稿详情</div>
                <span class="modal-close" onclick="closeDraftDetailModal()">×</span>
            </div>
            <div class="modal-body">
                <div class="draft-detail-item">
                    <div class="draft-detail-label">公文标题</div>
                    <div class="draft-detail-value">${draft.title || '（无标题）'}</div>
                </div>
                <div class="draft-detail-item">
                    <div class="draft-detail-label">来文单位</div>
                    <div class="draft-detail-value">${draft.fromUnit || '-'}</div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="draft-detail-item">
                        <div class="draft-detail-label">来文字号</div>
                        <div class="draft-detail-value">${draft.docNumber || '-'}</div>
                    </div>
                    <div class="draft-detail-item">
                        <div class="draft-detail-label">来文日期</div>
                        <div class="draft-detail-value">${draft.docDate || '-'}</div>
                    </div>
                    <div class="draft-detail-item">
                        <div class="draft-detail-label">办理期限</div>
                        <div class="draft-detail-value">${draft.deadline ? formatDate(draft.deadline) : '-'}</div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="draft-detail-item">
                        <div class="draft-detail-label">紧急程度</div>
                        <div class="draft-detail-value">${getPriorityLabel(draft.priority)}</div>
                    </div>
                    <div class="draft-detail-item">
                        <div class="draft-detail-label">公文类别</div>
                        <div class="draft-detail-value">${draft.category || '-'}</div>
                    </div>
                </div>
                <div class="draft-detail-item">
                    <div class="draft-detail-label">内容摘要</div>
                    <div class="draft-detail-value" style="white-space:pre-wrap;">${draft.content || '（无内容）'}</div>
                </div>
                <div class="draft-detail-item">
                    <div class="draft-detail-label">附件（${attachmentCount} 个）</div>
                    <div class="draft-detail-value">
                        ${attachmentCount > 0 ? draft.attachments.map(att => `
                            <div style="padding:4px 0;">📄 ${att.name} (${att.size})</div>
                        `).join('') : '（无附件）'}
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0;">
                    <div class="draft-detail-item">
                        <div class="draft-detail-label">创建时间</div>
                        <div class="draft-detail-value">${formatDateTime(draft.createdAt)}</div>
                    </div>
                    <div class="draft-detail-item">
                        <div class="draft-detail-label">最后保存</div>
                        <div class="draft-detail-value">${formatDateTime(draft.updatedAt)}</div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-default" onclick="closeDraftDetailModal()">关闭</button>
                <button class="btn btn-default" onclick="editDraft('${draft.id}')">编辑草稿</button>
                <button class="btn btn-primary" onclick="submitDraftFromDetail('${draft.id}')">提交草稿</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeDraftDetailModal();
        }
    }, { once: true });
}

function closeDraftDetailModal() {
    const modal = document.getElementById('draftDetailModal');
    if (modal) {
        modal.remove();
    }
}

function submitDraftFromDetail(draftId) {
    closeDraftDetailModal();
    submitDraftFromList(draftId);
}

function editDraft(draftId) {
    currentDraftId = draftId;
    registerAttachments = [];
    navigateTo('draftEdit', { draftId: draftId });
}

function submitDraftFromList(draftId) {
    const draft = dataStore.getDraft(draftId);
    if (!draft) {
        showToast('草稿不存在', 'error');
        return;
    }

    let missingFields = [];
    if (!draft.title || !draft.title.trim()) {
        missingFields.push('公文标题');
    }
    if (!draft.fromUnit || !draft.fromUnit.trim()) {
        missingFields.push('来文单位');
    }

    if (missingFields.length > 0) {
        if (confirm(`提交前请先补充以下必填项：\n\n${missingFields.join('、')}\n\n是否现在去编辑？`)) {
            editDraft(draftId);
        }
        return;
    }

    if (!confirm('确定要提交这篇草稿吗？\n\n提交后将：\n1. 生成正式的公文文号\n2. 自动进入待批示流程\n3. 从草稿箱中移除')) {
        return;
    }

    const result = dataStore.submitDraft(draftId, currentUser);
    if (result && result.success) {
        showToast('提交成功，已生成正式公文：' + result.doc.id);
        renderDraftList();
        renderNav();
        setTimeout(() => {
            navigateTo('detail', { id: result.doc.id });
        }, 500);
    } else {
        showToast(result && result.error ? result.error : '提交失败', 'error');
    }
}

function deleteDraftConfirm(draftId) {
    const draft = dataStore.getDraft(draftId);
    if (!draft) {
        showToast('草稿不存在', 'error');
        return;
    }

    if (!confirm(`确定要删除草稿「${draft.title || '（无标题）'}」吗？\n\n删除后无法恢复。`)) {
        return;
    }

    const success = dataStore.deleteDraft(draftId, currentUser);
    if (success) {
        showToast('草稿已删除');
        renderDraftList();
        renderNav();
    } else {
        showToast('删除失败', 'error');
    }
}

function renderDocDetail() {
    const doc = dataStore.getDoc(currentDocId);
    if (!doc) {
        document.getElementById('contentArea').innerHTML = '<div class="empty-state"><p>公文不存在</p></div>';
        return;
    }

    const canOperate = dataStore.canOperate(doc, currentRole, currentUser) && !isArchiveDetail;
    const canSupervise = dataStore.canSupervise(doc, currentRole, currentUser) && !isArchiveDetail;
    const canReturn = dataStore.canReturn(doc, currentRole, currentUser) && !isArchiveDetail;
    const canResubmit = dataStore.canResubmit(doc, currentRole, currentUser) && !isArchiveDetail;
    const content = document.getElementById('contentArea');

    let actionButton = '';
    if (canResubmit) {
        let resubmitLabel = '重提';
        if (doc.currentNode === FLOW_NODES.REGISTER) {
            resubmitLabel = '补充登记并重提';
        } else if (doc.currentNode === FLOW_NODES.FEEDBACK) {
            resubmitLabel = '补充反馈并重提';
        }
        actionButton = `<button class="btn btn-primary" onclick="showResubmitModal()">${resubmitLabel}</button>`;
    } else if (canOperate) {
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

    let returnButton = '';
    if (canReturn) {
        returnButton = `<button class="btn btn-danger" onclick="showReturnModal()">↩️ 退回</button>`;
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
    if (doc.isReturned) {
        statusBadgeExtra += '<span class="return-badge">已退回</span>';
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
                ${returnButton ? returnButton + ' ' : ''}
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
                        <span class="detail-label">原文附件 <span style="color:#999; font-weight:normal;">（来自：${NODE_LABELS[FLOW_NODES.REGISTER]} · ${registerRecord.operatorName}）</span></span>
                        <div class="attachment-list">
                            ${registerRecord.attachments.map(a => `
                                <div class="attachment-item attachment-item-detail">
                                    <div class="attachment-item-main">
                                        <span class="attachment-icon">${getFileIcon(a.name)}</span>
                                        <span class="attachment-name" title="${a.name}">${a.name}</span>
                                        <span class="attachment-size">${a.size}</span>
                                        <span class="file-type-badge file-type-${getFileType(a.name)}">${getFileTypeLabel(a.name)}</span>
                                        <span class="att-category-badge att-cat-${a.category || ATTACHMENT_CATEGORIES.OTHER}">${getAttachmentCategoryLabel(a.category)}</span>
                                    </div>
                                    ${a.remark ? `<div class="attachment-item-remark"><span class="remark-label">备注：</span>${escapeHtml(a.remark)}</div>` : ''}
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
        const normalRecords = records.filter(r => !r.isReturn && !r.isResubmit);
        const returnRecords = records.filter(r => r.isReturn);
        const resubmitRecords = records.filter(r => r.isResubmit);
        const hasNormal = normalRecords.length > 0;
        const isCurrent = doc.currentNode === node && !hasNormal && !doc.isReturned;
        const isReturnedCurrent = doc.currentNode === node && doc.isReturned;
        const isPending = nodes.indexOf(doc.currentNode) < index;

        let dotClass = '';
        if (hasNormal) {
            dotClass = 'completed';
        } else if (isReturnedCurrent) {
            dotClass = 'returned';
        } else if (isCurrent || isPending) {
            dotClass = 'pending';
        }

        let contentHtml = '';

        if (records.length > 0 || isCurrent || isReturnedCurrent) {
            contentHtml = '<div class="timeline-content">';
            contentHtml += `<div class="timeline-title">${NODE_LABELS[node]}</div>`;

            if (node === FLOW_NODES.HANDLE && doc.isMultiDept) {
                contentHtml += renderMultiHandleTimelineContent(doc, normalRecords);
            } else {
                const allRecords = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));

                allRecords.forEach(record => {
                    const isReturn = record.isReturn;
                    const isResubmit = record.isResubmit;
                    const recordClass = isReturn ? 'timeline-return-record' : (isResubmit ? 'timeline-resubmit-record' : 'timeline-normal-record');

                    contentHtml += `<div class="${recordClass}" data-record-id="${record.id}">`;

                    if (isReturn) {
                        contentHtml += `<div class="timeline-record-label">↩️ 退回至${NODE_LABELS[record.returnToNode]}</div>`;
                    } else if (isResubmit) {
                        contentHtml += `<div class="timeline-record-label">↪️ 重提至${NODE_LABELS[record.resubmitToNode]}</div>`;
                    }

                    contentHtml += `
                        <div class="timeline-meta">
                            ${record.operatorName}（${record.operatorDept}） · ${formatDateTime(record.time)}
                        </div>
                    `;

                    if (record.comment) {
                        contentHtml += `<div class="timeline-comment">${record.comment}</div>`;
                    }

                    if (record.assignedDept) {
                        contentHtml += `<div class="timeline-meta" style="margin-top:6px;">分派至：${record.assignedDept} - ${record.assignedUserName}</div>`;
                    }
                    if (record.isMultiDept) {
                        contentHtml += `<div class="timeline-meta" style="margin-top:4px;"><span class="badge-multi">多科室协办</span></div>`;
                    }

                    if (record.attachments && record.attachments.length > 0) {
                        contentHtml += `
                            <div class="timeline-attachment">
                                <div style="font-size:12px; color:#888; margin-bottom:8px;">
                                    附件（${record.attachments.length}个）
                                    <span style="margin-left:8px; color:#aaa;">上传人：${record.operatorName}</span>
                                </div>
                                ${record.attachments.map(a => `
                                    <div class="attachment-item timeline-attachment-item timeline-attachment-item-extended">
                                        <div class="attachment-item-main">
                                            <span class="attachment-icon">${getFileIcon(a.name)}</span>
                                            <span class="attachment-name" title="${a.name}">${a.name}</span>
                                            <span class="attachment-size">${a.size}</span>
                                            <span class="file-type-badge file-type-${getFileType(a.name)}">${getFileTypeLabel(a.name)}</span>
                                            <span class="att-category-badge att-cat-${a.category || ATTACHMENT_CATEGORIES.OTHER}">${getAttachmentCategoryLabel(a.category)}</span>
                                        </div>
                                        ${a.remark ? `<div class="attachment-item-remark"><span class="remark-label">备注：</span>${escapeHtml(a.remark)}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }

                    contentHtml += '</div>';
                });
            }

            if (returnRecords.length > 0 && node === FLOW_NODES.HANDLE && doc.isMultiDept) {
                returnRecords.forEach(record => {
                    contentHtml += `
                        <div class="timeline-return-record" data-record-id="${record.id}">
                            <div class="timeline-record-label">↩️ 退回至${NODE_LABELS[record.returnToNode]}</div>
                            <div class="timeline-meta">
                                ${record.operatorName}（${record.operatorDept}） · ${formatDateTime(record.time)}
                            </div>
                            ${record.comment ? `<div class="timeline-comment">${record.comment}</div>` : ''}
                        </div>
                    `;
                });
            }

            if (resubmitRecords.length > 0 && node === FLOW_NODES.HANDLE && doc.isMultiDept) {
                resubmitRecords.forEach(record => {
                    contentHtml += `
                        <div class="timeline-resubmit-record" data-record-id="${record.id}">
                            <div class="timeline-record-label">↪️ 重提至${NODE_LABELS[record.resubmitToNode]}</div>
                            <div class="timeline-meta">
                                ${record.operatorName}（${record.operatorDept}） · ${formatDateTime(record.time)}
                            </div>
                            ${record.comment ? `<div class="timeline-comment">${record.comment}</div>` : ''}
                        </div>
                    `;
                });
            }

            if (isReturnedCurrent && !records.some(r => r.isReturn)) {
                contentHtml += '<div class="timeline-meta" style="opacity:0.7;">退回待处理中...</div>';
            } else if (isCurrent && !hasNormal) {
                contentHtml += '<div class="timeline-meta" style="opacity:0.7;">等待处理中...</div>';
            }

            contentHtml += '</div>';
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
            <div class="handle-record-item ${isCompleted ? 'completed' : 'pending'}" ${flowRecord ? `data-record-id="${flowRecord.id}"` : ''}>
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
                                <div style="font-size:12px; color:#888; margin-bottom:8px;">
                                    附件（${flowRecord.attachments.length}个）
                                    <span style="margin-left:8px; color:#aaa;">上传人：${flowRecord.operatorName}</span>
                                </div>
                                ${flowRecord.attachments.map(a => `
                                    <div class="attachment-item timeline-attachment-item timeline-attachment-item-extended">
                                        <div class="attachment-item-main">
                                            <span class="attachment-icon">${getFileIcon(a.name)}</span>
                                            <span class="attachment-name" title="${a.name}">${a.name}</span>
                                            <span class="attachment-size">${a.size}</span>
                                            <span class="file-type-badge file-type-${getFileType(a.name)}">${getFileTypeLabel(a.name)}</span>
                                            <span class="att-category-badge att-cat-${a.category || ATTACHMENT_CATEGORIES.OTHER}">${getAttachmentCategoryLabel(a.category)}</span>
                                        </div>
                                        ${a.remark ? `<div class="attachment-item-remark"><span class="remark-label">备注：</span>${escapeHtml(a.remark)}</div>` : ''}
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
            const deptOptions = userStore.getStaffDepartments().map(d => `<option value="${d}">${d}</option>`).join('');
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

    const staff = userStore.getUsersByDept(dept).filter(u => u.role === ROLES.STAFF);
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

    const staff = userStore.getUsersByDept(dept).filter(u => u.role === ROLES.STAFF);
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
    const deptOptions = userStore.getStaffDepartments().map(d =>
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

    const staff = userStore.getUsersByDept(dept).filter(u => u.role === ROLES.STAFF);
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

    const staffUser = userStore.getUserById(staffId);
    if (!staffUser) {
        showToast('用户不存在', 'error');
        return;
    }
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
                const staffUser = userStore.getUserById(staffId);
                if (!staffUser) {
                    showToast('用户不存在', 'error');
                    return;
                }
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
                const mainStaffUser = userStore.getUserById(mainStaffId);
                if (!mainStaffUser) {
                    showToast('用户不存在', 'error');
                    return;
                }
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

function showReturnModal() {
    const doc = dataStore.getDoc(currentDocId);
    if (!doc) return;

    let returnTarget = '';
    let tipText = '';

    if (doc.currentNode === FLOW_NODES.PROPOSE || doc.currentNode === FLOW_NODES.ASSIGN) {
        returnTarget = '办公室（补充登记）';
        tipText = '退回后，办公室人员需要补充登记信息后重提，流程将重新进入拟办环节。';
    } else if (doc.currentNode === FLOW_NODES.COMPLETE) {
        returnTarget = '承办人（补充反馈）';
        tipText = '退回后，承办人需要补充反馈内容后重提，流程将重新进入待归档环节。';
    }

    document.getElementById('modalTitle').textContent = '退回公文';
    document.getElementById('modalBody').innerHTML = `
        <div class="return-info">
            <p><strong>公文标题：</strong>${doc.title}</p>
            <p><strong>当前环节：</strong>${NODE_LABELS[doc.currentNode]}</p>
            <p><strong>退回至：</strong><span class="text-danger">${returnTarget}</span></p>
        </div>
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>退回原因</label>
            <textarea class="form-textarea" id="returnReason" rows="5" placeholder="请输入退回原因..."></textarea>
        </div>
        <p style="color:#888; font-size:12px;">${tipText}</p>
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-danger" onclick="submitReturn()">确认退回</button>
        </div>
    `;
    document.getElementById('modal').classList.remove('hidden');
}

function submitReturn() {
    const reason = document.getElementById('returnReason').value.trim();
    if (!reason) {
        showToast('请输入退回原因', 'error');
        return;
    }

    const result = dataStore.returnDoc(currentDocId, reason, currentUser, currentRole);
    if (result) {
        closeModal();
        showToast('退回成功！');
        renderDocDetail();
        renderNav();
    } else {
        showToast('操作失败，请重试', 'error');
    }
}

function showResubmitModal() {
    const doc = dataStore.getDoc(currentDocId);
    if (!doc) return;

    resubmitAttachments = [];

    const lastReturnRecord = doc.returnRecords && doc.returnRecords.length > 0
        ? doc.returnRecords.filter(r => r.type === RETURN_TYPES.RETURN).slice(-1)[0]
        : null;

    let bodyHtml = '';
    let title = '';

    if (doc.currentNode === FLOW_NODES.REGISTER) {
        title = '补充登记并重提';
        const priorityOptions = ['normal', 'high', 'urgent'];
        const priorityLabels = { normal: '普通', high: '加急', urgent: '特急' };
        const categoryOptions = ['', '通知', '请示', '报告', '批复', '函', '会议纪要', '其他'];

        bodyHtml = `
            ${lastReturnRecord ? `
            <div class="return-reason-box" style="margin-bottom:20px;">
                <div class="return-reason-title">📌 退回原因（${lastReturnRecord.operatorName} · ${formatDateTime(lastReturnRecord.time)}）</div>
                <div class="return-reason-content">${lastReturnRecord.reason}</div>
            </div>
            ` : ''}
            <div class="detail-grid">
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span>公文标题</label>
                    <input type="text" class="form-input" id="resubmitTitle" value="${escapeHtml(doc.title)}">
                </div>
                <div class="form-group">
                    <label class="form-label"><span class="required">*</span>来文单位</label>
                    <input type="text" class="form-input" id="resubmitFromUnit" value="${escapeHtml(doc.fromUnit || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">来文字号</label>
                    <input type="text" class="form-input" id="resubmitDocNumber" value="${escapeHtml(doc.docNumber || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">来文日期</label>
                    <input type="date" class="form-input" id="resubmitDocDate" value="${doc.docDate || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">紧急程度</label>
                    <select class="form-select" id="resubmitPriority">
                        ${priorityOptions.map(p => `<option value="${p}" ${doc.priority === p ? 'selected' : ''}>${priorityLabels[p]}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">公文类别</label>
                    <select class="form-select" id="resubmitCategory">
                        ${categoryOptions.map(c => `<option value="${c}" ${doc.category === c ? 'selected' : ''}>${c || '请选择'}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group full-width">
                    <label class="form-label">公文内容摘要</label>
                    <textarea class="form-textarea" id="resubmitContent" rows="4">${escapeHtml(doc.content || '')}</textarea>
                </div>
                <div class="form-group full-width">
                    <label class="form-label">附件上传</label>
                    <div class="upload-area" onclick="document.getElementById('resubmitAttachmentsInput').click()">
                        <div class="upload-icon">📎</div>
                        <div class="upload-text">点击上传附件，或拖拽文件到此处</div>
                        <input type="file" id="resubmitAttachmentsInput" multiple onchange="handleResubmitFileSelect(this)">
                    </div>
                    <div class="attachment-list" id="resubmitAttachmentsList" style="margin-top:12px;"></div>
                </div>
            </div>
            <p style="color:#888; font-size:12px; margin-top:12px;">补充登记后，公文将重新进入拟办环节，由领导批示。</p>
        `;
    } else if (doc.currentNode === FLOW_NODES.FEEDBACK) {
        title = '补充反馈并重提';
        const isMulti = doc.isMultiDept;
        const label = isMulti ? '最终反馈意见' : '反馈意见';
        const placeholder = isMulti ? '请输入最终办理结果反馈...' : '请输入办理结果反馈...';
        const tipText = '补充反馈后，公文将重新进入待归档环节，由办公室归档。';

        bodyHtml = `
            ${lastReturnRecord ? `
            <div class="return-reason-box" style="margin-bottom:20px;">
                <div class="return-reason-title">📌 退回原因（${lastReturnRecord.operatorName} · ${formatDateTime(lastReturnRecord.time)}）</div>
                <div class="return-reason-content">${lastReturnRecord.reason}</div>
            </div>
            ` : ''}
            <div class="form-group">
                <label class="form-label"><span class="required">*</span>${label}</label>
                <textarea class="form-textarea" id="resubmitComment" rows="5" placeholder="${placeholder}"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">反馈附件</label>
                <div class="upload-area" onclick="document.getElementById('resubmitAttachmentsInput').click()">
                    <div class="upload-icon">📎</div>
                    <div class="upload-text">点击上传反馈相关附件</div>
                    <input type="file" id="resubmitAttachmentsInput" multiple onchange="handleResubmitFileSelect(this)">
                </div>
                <div class="attachment-list" id="resubmitAttachmentsList" style="margin-top:12px;"></div>
            </div>
            <p style="color:#888; font-size:12px;">${tipText}</p>
        `;
    }

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml + `
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitResubmit()">确认重提</button>
        </div>
    `;
    document.getElementById('modal').classList.remove('hidden');
}

function handleResubmitFileSelect(input) {
    const files = input.files;
    const list = document.getElementById('resubmitAttachmentsList');

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachment = {
            name: file.name,
            size: formatFileSize(file.size),
            id: 'att_' + Date.now() + '_' + i
        };
        resubmitAttachments.push(attachment);

        const item = document.createElement('div');
        item.className = 'attachment-item';
        item.innerHTML = `
            <span class="attachment-icon">📄</span>
            <span class="attachment-name">${attachment.name}</span>
            <span class="attachment-size">${attachment.size}</span>
            <button type="button" class="attachment-remove" onclick="removeResubmitAttachment('${attachment.id}', this)">×</button>
        `;
        list.appendChild(item);
    }
}

function removeResubmitAttachment(id, btn) {
    resubmitAttachments = resubmitAttachments.filter(a => a.id !== id);
    btn.parentElement.remove();
}

function submitResubmit() {
    const doc = dataStore.getDoc(currentDocId);
    if (!doc) return;

    let result = null;

    if (doc.currentNode === FLOW_NODES.REGISTER) {
        const title = document.getElementById('resubmitTitle').value.trim();
        const fromUnit = document.getElementById('resubmitFromUnit').value.trim();

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
            docNumber: document.getElementById('resubmitDocNumber').value.trim(),
            docDate: document.getElementById('resubmitDocDate').value,
            priority: document.getElementById('resubmitPriority').value,
            category: document.getElementById('resubmitCategory').value,
            content: document.getElementById('resubmitContent').value.trim(),
            attachments: resubmitAttachments,
            comment: '补充登记后重提'
        };

        result = dataStore.resubmitRegisterDoc(currentDocId, docData, currentUser, currentRole);
    } else if (doc.currentNode === FLOW_NODES.FEEDBACK) {
        const comment = document.getElementById('resubmitComment').value.trim();
        if (!comment) {
            showToast('请输入反馈意见', 'error');
            return;
        }

        result = dataStore.feedbackDoc(currentDocId, comment, resubmitAttachments, currentUser);
    }

    if (result) {
        closeModal();
        showToast('重提成功！');
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

let userManageTab = 'departments';
let userManageShowInactive = false;

function renderUserManage() {
    const content = document.getElementById('contentArea');

    const depts = userStore.getDepartments();
    const deptCount = depts.length;
    const userCount = userStore.getAllUsers().length;
    const inactiveCount = userStore.getAllUsersWithInactive().filter(u => !u.active).length;

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">角色与人员管理</h2>
            <div class="page-subtitle">科室设置 · 人员维护 · 角色分配</div>
        </div>

        <div class="user-manage-stats">
            <div class="user-stat-card">
                <div class="user-stat-icon dept">🏢</div>
                <div class="user-stat-info">
                    <div class="user-stat-number">${deptCount}</div>
                    <div class="user-stat-label">科室数量</div>
                </div>
            </div>
            <div class="user-stat-card">
                <div class="user-stat-icon user">👥</div>
                <div class="user-stat-info">
                    <div class="user-stat-number">${userCount}</div>
                    <div class="user-stat-label">在职人员</div>
                </div>
            </div>
            <div class="user-stat-card">
                <div class="user-stat-icon inactive">📋</div>
                <div class="user-stat-info">
                    <div class="user-stat-number">${inactiveCount}</div>
                    <div class="user-stat-label">已停用</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="user-manage-tabs">
                <div class="tab-item ${userManageTab === 'departments' ? 'active' : ''}" onclick="switchUserManageTab('departments')">
                    <span>🏢</span> 科室管理
                </div>
                <div class="tab-item ${userManageTab === 'users' ? 'active' : ''}" onclick="switchUserManageTab('users')">
                    <span>👤</span> 人员管理
                </div>
            </div>
            <div class="card-body user-manage-content">
                <div id="userManageTabContent"></div>
            </div>
        </div>
    `;

    renderUserManageTabContent();
}

function switchUserManageTab(tab) {
    userManageTab = tab;
    renderUserManage();
}

function renderUserManageTabContent() {
    const container = document.getElementById('userManageTabContent');
    if (!container) return;

    if (userManageTab === 'departments') {
        container.innerHTML = renderDepartmentManage();
    } else {
        container.innerHTML = renderUserManageList();
    }
}

function renderDepartmentManage() {
    const depts = userStore.getDepartments();

    return `
        <div class="manage-toolbar">
            <div class="toolbar-title">科室列表</div>
            <button class="btn btn-primary btn-sm" onclick="showAddDepartmentModal()">
                + 新增科室
            </button>
        </div>

        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width:60px;">序号</th>
                        <th>科室名称</th>
                        <th style="width:100px;">人员数</th>
                        <th style="width:180px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${depts.length > 0 ? depts.map((dept, index) => {
                        const userCount = userStore.getUsersByDept(dept).length;
                        return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>
                                <span class="dept-tag">${dept}</span>
                            </td>
                            <td>${userCount} 人</td>
                            <td>
                                <div class="actions">
                                    <a class="action-link" onclick="showEditDepartmentModal('${dept}')">编辑</a>
                                    <a class="action-link danger" onclick="confirmDeleteDepartment('${dept}')">删除</a>
                                </div>
                            </td>
                        </tr>
                    `}).join('') : `
                        <tr>
                            <td colspan="4">
                                <div class="empty-state"><div class="empty-icon">🏢</div><p>暂无科室，请点击上方按钮添加</p></div>
                            </td>
                        </tr>
                    `}
                </tbody>
            </table>
        </div>
    `;
}

function renderUserManageList() {
    const depts = userStore.getDepartments();
    const deptFilter = document.getElementById('userDeptFilter') ? document.getElementById('userDeptFilter').value : '';
    const roleFilter = document.getElementById('userRoleFilter') ? document.getElementById('userRoleFilter').value : '';
    const keyword = document.getElementById('userKeyword') ? document.getElementById('userKeyword').value.trim() : '';

    let users = userManageShowInactive
        ? userStore.getAllUsersWithInactive()
        : userStore.getAllUsers();

    if (deptFilter) {
        users = users.filter(u => u.dept === deptFilter);
    }
    if (roleFilter) {
        users = users.filter(u => u.role === roleFilter);
    }
    if (keyword) {
        const kw = keyword.toLowerCase();
        users = users.filter(u =>
            u.name.toLowerCase().includes(kw) ||
            u.id.toLowerCase().includes(kw)
        );
    }

    return `
        <div class="manage-toolbar">
            <div class="toolbar-filters">
                <div class="form-group form-group-sm">
                    <label class="form-label">科室</label>
                    <select class="form-select" id="userDeptFilter" onchange="renderUserManageTabContent()">
                        <option value="">全部科室</option>
                        ${depts.map(d => `<option value="${d}" ${d === deptFilter ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group form-group-sm">
                    <label class="form-label">角色</label>
                    <select class="form-select" id="userRoleFilter" onchange="renderUserManageTabContent()">
                        <option value="">全部角色</option>
                        <option value="${ROLES.OFFICE}" ${ROLES.OFFICE === roleFilter ? 'selected' : ''}>${ROLE_LABELS[ROLES.OFFICE]}</option>
                        <option value="${ROLES.LEADER}" ${ROLES.LEADER === roleFilter ? 'selected' : ''}>${ROLE_LABELS[ROLES.LEADER]}</option>
                        <option value="${ROLES.STAFF}" ${ROLES.STAFF === roleFilter ? 'selected' : ''}>${ROLE_LABELS[ROLES.STAFF]}</option>
                    </select>
                </div>
                <div class="form-group form-group-sm">
                    <label class="form-label">关键词</label>
                    <input type="text" class="form-input" id="userKeyword" placeholder="姓名/工号"
                           value="${keyword}"
                           onkeyup="if(event.key==='Enter') renderUserManageTabContent()">
                </div>
                <label class="checkbox-inline">
                    <input type="checkbox" id="showInactiveUsers" ${userManageShowInactive ? 'checked' : ''}
                           onchange="toggleShowInactiveUsers()">
                    显示已停用人员
                </label>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showAddUserModal()">
                + 新增人员
            </button>
        </div>

        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width:60px;">序号</th>
                        <th>工号</th>
                        <th>姓名</th>
                        <th>科室</th>
                        <th>角色</th>
                        <th style="width:100px;">状态</th>
                        <th style="width:200px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.length > 0 ? users.map((user, index) => {
                        const roleLabel = ROLE_LABELS[user.role] || user.role;
                        const roleClass = `role-${user.role}`;
                        const statusBadge = user.active
                            ? '<span class="status-badge status-active">在职</span>'
                            : '<span class="status-badge status-inactive">已停用</span>';
                        return `
                        <tr class="${!user.active ? 'row-inactive' : ''}">
                            <td>${index + 1}</td>
                            <td><code>${user.id}</code></td>
                            <td><strong>${user.name}</strong></td>
                            <td><span class="dept-tag">${user.dept}</span></td>
                            <td><span class="role-badge ${roleClass}">${roleLabel}</span></td>
                            <td>${statusBadge}</td>
                            <td>
                                <div class="actions">
                                    <a class="action-link" onclick="showEditUserModal('${user.id}')">编辑</a>
                                    ${user.active
                                        ? `<a class="action-link danger" onclick="confirmDeleteUser('${user.id}')">停用</a>`
                                        : `<a class="action-link" onclick="confirmRestoreUser('${user.id}')">恢复</a>`
                                    }
                                </div>
                            </td>
                        </tr>
                    `}).join('') : `
                        <tr>
                            <td colspan="7">
                                <div class="empty-state"><div class="empty-icon">👤</div><p>暂无人员</p></div>
                            </td>
                        </tr>
                    `}
                </tbody>
            </table>
        </div>
    `;
}

function toggleShowInactiveUsers() {
    userManageShowInactive = document.getElementById('showInactiveUsers').checked;
    renderUserManageTabContent();
}

function showAddDepartmentModal() {
    const modalHtml = `
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>科室名称</label>
            <input type="text" class="form-input" id="deptNameInput" placeholder="请输入科室名称">
        </div>
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitAddDepartment()">确认添加</button>
        </div>
    `;

    document.getElementById('modalTitle').textContent = '新增科室';
    document.getElementById('modalBody').innerHTML = modalHtml;
    document.getElementById('modal').classList.remove('hidden');

    setTimeout(() => {
        document.getElementById('deptNameInput').focus();
    }, 100);
}

function submitAddDepartment() {
    const name = document.getElementById('deptNameInput').value.trim();
    const result = userStore.addDepartment(name);
    if (result.success) {
        closeModal();
        showToast('科室添加成功');
        renderUserManageTabContent();
    } else {
        showToast(result.error || '添加失败', 'error');
    }
}

function showEditDepartmentModal(oldName) {
    const modalHtml = `
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>科室名称</label>
            <input type="text" class="form-input" id="deptNameInput" value="${oldName}">
        </div>
        <div class="form-tip">
            <p style="color:#888; font-size:12px; margin:0;">
                修改科室名称后，该科室下所有人员的科室信息将同步更新。
            </p>
        </div>
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitEditDepartment('${oldName}')">确认修改</button>
        </div>
    `;

    document.getElementById('modalTitle').textContent = '编辑科室';
    document.getElementById('modalBody').innerHTML = modalHtml;
    document.getElementById('modal').classList.remove('hidden');
}

function submitEditDepartment(oldName) {
    const newName = document.getElementById('deptNameInput').value.trim();
    const result = userStore.updateDepartment(oldName, newName);
    if (result.success) {
        closeModal();
        showToast('科室修改成功');
        renderUserManageTabContent();
    } else {
        showToast(result.error || '修改失败', 'error');
    }
}

function confirmDeleteDepartment(name) {
    if (!confirm(`确定要删除科室"${name}"吗？\n\n注意：只有该科室下没有在职人员时才能删除。`)) {
        return;
    }
    const result = userStore.deleteDepartment(name);
    if (result.success) {
        showToast('科室删除成功');
        renderUserManageTabContent();
    } else {
        showToast(result.error || '删除失败', 'error');
    }
}

function showAddUserModal() {
    const depts = userStore.getDepartments();

    const modalHtml = `
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>姓名</label>
            <input type="text" class="form-input" id="userNameInput" placeholder="请输入姓名">
        </div>
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>科室</label>
            <select class="form-select" id="userDeptSelect">
                <option value="">请选择科室</option>
                ${depts.map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>角色</label>
            <select class="form-select" id="userRoleSelect">
                <option value="">请选择角色</option>
                <option value="${ROLES.OFFICE}">${ROLE_LABELS[ROLES.OFFICE]}</option>
                <option value="${ROLES.LEADER}">${ROLE_LABELS[ROLES.LEADER]}</option>
                <option value="${ROLES.STAFF}">${ROLE_LABELS[ROLES.STAFF]}</option>
            </select>
        </div>
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitAddUser()">确认添加</button>
        </div>
    `;

    document.getElementById('modalTitle').textContent = '新增人员';
    document.getElementById('modalBody').innerHTML = modalHtml;
    document.getElementById('modal').classList.remove('hidden');

    setTimeout(() => {
        document.getElementById('userNameInput').focus();
    }, 100);
}

function submitAddUser() {
    const name = document.getElementById('userNameInput').value.trim();
    const dept = document.getElementById('userDeptSelect').value;
    const role = document.getElementById('userRoleSelect').value;

    const result = userStore.addUser({ name, dept, role });
    if (result.success) {
        closeModal();
        showToast('人员添加成功');
        renderUserManageTabContent();
    } else {
        showToast(result.error || '添加失败', 'error');
    }
}

function showEditUserModal(userId) {
    const user = userStore.getUserById(userId);
    if (!user) {
        showToast('用户不存在', 'error');
        return;
    }

    const depts = userStore.getDepartments();

    const modalHtml = `
        <div class="form-group">
            <label class="form-label">工号</label>
            <input type="text" class="form-input" value="${user.id}" readonly style="background:#f5f5f5;">
        </div>
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>姓名</label>
            <input type="text" class="form-input" id="userNameInput" value="${user.name}">
        </div>
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>科室</label>
            <select class="form-select" id="userDeptSelect">
                ${depts.map(d => `<option value="${d}" ${d === user.dept ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label"><span class="required">*</span>角色</label>
            <select class="form-select" id="userRoleSelect">
                <option value="${ROLES.OFFICE}" ${ROLES.OFFICE === user.role ? 'selected' : ''}>${ROLE_LABELS[ROLES.OFFICE]}</option>
                <option value="${ROLES.LEADER}" ${ROLES.LEADER === user.role ? 'selected' : ''}>${ROLE_LABELS[ROLES.LEADER]}</option>
                <option value="${ROLES.STAFF}" ${ROLES.STAFF === user.role ? 'selected' : ''}>${ROLE_LABELS[ROLES.STAFF]}</option>
            </select>
        </div>
        <div class="form-tip">
            <p style="color:#888; font-size:12px; margin:0;">
                修改人员信息后，历史公文中已记录的姓名不会受影响。
            </p>
        </div>
        <div class="modal-footer" style="margin: 20px -24px -20px; padding: 14px 24px; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-default" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" onclick="submitEditUser('${userId}')">确认修改</button>
        </div>
    `;

    document.getElementById('modalTitle').textContent = '编辑人员';
    document.getElementById('modalBody').innerHTML = modalHtml;
    document.getElementById('modal').classList.remove('hidden');
}

function submitEditUser(userId) {
    const name = document.getElementById('userNameInput').value.trim();
    const dept = document.getElementById('userDeptSelect').value;
    const role = document.getElementById('userRoleSelect').value;

    const result = userStore.updateUser(userId, { name, dept, role });
    if (result.success) {
        closeModal();
        showToast('人员信息修改成功');
        renderUserManageTabContent();
    } else {
        showToast(result.error || '修改失败', 'error');
    }
}

function confirmDeleteUser(userId) {
    const user = userStore.getUserById(userId);
    if (!user) return;

    if (!confirm(`确定要停用人员"${user.name}"吗？\n\n停用后：\n• 登录时将无法选择该用户\n• 分办时将无法选择该用户\n• 历史公文中已记录的姓名会保留`)) {
        return;
    }
    const result = userStore.deleteUser(userId);
    if (result.success) {
        showToast('人员已停用');
        renderUserManageTabContent();
    } else {
        showToast(result.error || '操作失败', 'error');
    }
}

function confirmRestoreUser(userId) {
    const user = userStore.getUserById(userId);
    if (!user) return;

    if (!confirm(`确定要恢复人员"${user.name}"吗？`)) {
        return;
    }
    const result = userStore.restoreUser(userId);
    if (result.success) {
        showToast('人员已恢复');
        renderUserManageTabContent();
    } else {
        showToast(result.error || '操作失败', 'error');
    }
}

document.addEventListener('DOMContentLoaded', init);
