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
    DocFlow.Core.ModalHelper.submit({
        fields: [
            { id: 'deptNameInput', key: 'name', label: '科室名称', required: true }
        ],
        submit: function (values) { return userStore.addDepartment(values.name); },
        successMessage: '科室添加成功',
        errorMessage: '添加失败',
        refresh: [renderUserManageTabContent]
    });
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
    DocFlow.Core.ModalHelper.submit({
        fields: [
            { id: 'deptNameInput', key: 'name', label: '科室名称', required: true }
        ],
        submit: function (values) { return userStore.updateDepartment(oldName, values.name); },
        successMessage: '科室修改成功',
        errorMessage: '修改失败',
        refresh: [renderUserManageTabContent]
    });
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
    DocFlow.Core.ModalHelper.submit({
        fields: [
            { id: 'userNameInput', key: 'name', label: '姓名', required: true },
            { id: 'userDeptSelect', key: 'dept', label: '科室', required: true },
            { id: 'userRoleSelect', key: 'role', label: '角色', required: true }
        ],
        submit: function (values) { return userStore.addUser(values); },
        successMessage: '人员添加成功',
        errorMessage: '添加失败',
        refresh: [renderUserManageTabContent]
    });
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
    DocFlow.Core.ModalHelper.submit({
        fields: [
            { id: 'userNameInput', key: 'name', label: '姓名', required: true },
            { id: 'userDeptSelect', key: 'dept', label: '科室', required: true },
            { id: 'userRoleSelect', key: 'role', label: '角色', required: true }
        ],
        submit: function (values) { return userStore.updateUser(userId, values); },
        successMessage: '人员信息修改成功',
        errorMessage: '修改失败',
        refresh: [renderUserManageTabContent]
    });
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
