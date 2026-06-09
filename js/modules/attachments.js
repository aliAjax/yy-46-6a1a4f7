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
    DocFlow.Core.FilterHelper.apply({
        fields: {
            keyword: { id: 'attKeyword' },
            node: { id: 'attNode' },
            uploaderId: { id: 'attUploader' },
            uploaderDept: { id: 'attDept' },
            fileType: { id: 'attFileType' },
            category: { id: 'attCategory' },
            startDate: { id: 'attStartDate' },
            endDate: { id: 'attEndDate' }
        },
        setter: function (filters) { currentAttachmentFilters = filters; },
        render: function () {
            document.getElementById('attachmentListTable').innerHTML = renderAttachmentTable();
        }
    });
}

function resetAttachmentFilters() {
    DocFlow.Core.FilterHelper.reset({
        fields: {
            keyword: { id: 'attKeyword' },
            node: { id: 'attNode' },
            uploaderId: { id: 'attUploader' },
            uploaderDept: { id: 'attDept' },
            fileType: { id: 'attFileType' },
            category: { id: 'attCategory' },
            startDate: { id: 'attStartDate' },
            endDate: { id: 'attEndDate' }
        },
        setter: function (filters) { currentAttachmentFilters = filters; },
        render: function () {
            document.getElementById('attachmentListTable').innerHTML = renderAttachmentTable();
        }
    });
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
