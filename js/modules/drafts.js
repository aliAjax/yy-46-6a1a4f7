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
        'regTitle', 'regFromUnit', 'regDocNumber', 'regDocDate',
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

    if (!title && !fromUnit && registerAttachments.length === 0) {
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

    if (!title && !fromUnit && registerAttachments.length === 0) {
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
                    <th style="width:10%;">紧急程度</th>
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
    DocFlow.Core.FilterHelper.apply({
        fields: {
            keyword: { id: 'draftSearchKeyword' },
            priority: { id: 'draftFilterPriority' },
            category: { id: 'draftFilterCategory' },
            dateFrom: { id: 'draftFilterDateFrom' },
            dateTo: { id: 'draftFilterDateTo' }
        },
        setter: function (filters) {
            currentDraftFilters = {
                ...currentDraftFilters,
                ...filters
            };
        },
        render: function () {
            document.getElementById('draftListTable').innerHTML = renderDraftTable();
        }
    });
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
