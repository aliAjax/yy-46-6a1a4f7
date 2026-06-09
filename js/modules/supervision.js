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
    DocFlow.Core.FilterHelper.apply({
        fields: {
            keyword: { id: 'supKeyword' },
            assignedDept: { id: 'supDept' },
            assignedUser: { id: 'supStaff' },
            warningStatus: { id: 'supWarningStatus' }
        },
        setter: function (filters) { currentSupervisionFilters = filters; },
        render: function () {
            document.getElementById('supervisionListTable').innerHTML = renderSupervisionTable();
        }
    });
}

function resetSupervisionFilters() {
    DocFlow.Core.FilterHelper.reset({
        fields: {
            keyword: { id: 'supKeyword' },
            assignedDept: { id: 'supDept' },
            assignedUser: { id: 'supStaff' },
            warningStatus: { id: 'supWarningStatus' }
        },
        setter: function (filters) { currentSupervisionFilters = filters; },
        render: function () {
            document.getElementById('supervisionListTable').innerHTML = renderSupervisionTable();
        }
    });
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
