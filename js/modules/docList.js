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
    DocFlow.Core.FilterHelper.apply({
        fields: {
            keyword: { id: 'searchKeyword' },
            status: { id: 'searchStatus' },
            assignedDept: { id: 'searchDept' },
            priority: { id: 'searchPriority' },
            category: { id: 'searchCategory' },
            startDate: { id: 'searchStartDate' },
            endDate: { id: 'searchEndDate' },
            isMultiDept: {
                id: 'searchMode',
                transform: function (value) {
                    if (value === 'multi') return true;
                    if (value === 'single') return false;
                    return undefined;
                }
            }
        },
        setter: function (filters) {
            currentFilters = filters;
            currentFilterViewId = null;
        },
        beforeRender: updateFilterViewTabs,
        render: function () {
            document.getElementById('docListTable').innerHTML = renderDocTable();
        }
    });
}

function resetFilters() {
    DocFlow.Core.FilterHelper.reset({
        fields: {
            keyword: { id: 'searchKeyword' },
            status: { id: 'searchStatus' },
            assignedDept: { id: 'searchDept' },
            priority: { id: 'searchPriority' },
            category: { id: 'searchCategory' },
            isMultiDept: { id: 'searchMode' },
            startDate: { id: 'searchStartDate' },
            endDate: { id: 'searchEndDate' }
        },
        setter: function (filters) {
            currentFilters = filters;
            currentFilterViewId = null;
        },
        beforeRender: updateFilterViewTabs,
        render: function () {
            document.getElementById('docListTable').innerHTML = renderDocTable();
        }
    });
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
    DocFlow.Core.FilterHelper.apply({
        fields: {
            title: { id: 'archiveTitle' },
            docNumber: { id: 'archiveDocNumber' },
            fromUnit: { id: 'archiveFromUnit' },
            category: { id: 'archiveCategory' },
            assignedDept: { id: 'archiveDept' }
        },
        setter: function (filters) { currentArchiveFilters = filters; },
        render: function () {
            document.getElementById('archiveListTable').innerHTML = renderArchiveTable();
        }
    });
}

function resetArchiveFilters() {
    DocFlow.Core.FilterHelper.reset({
        fields: {
            title: { id: 'archiveTitle' },
            docNumber: { id: 'archiveDocNumber' },
            fromUnit: { id: 'archiveFromUnit' },
            category: { id: 'archiveCategory' },
            assignedDept: { id: 'archiveDept' }
        },
        setter: function (filters) { currentArchiveFilters = filters; },
        render: function () {
            document.getElementById('archiveListTable').innerHTML = renderArchiveTable();
        }
    });
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
