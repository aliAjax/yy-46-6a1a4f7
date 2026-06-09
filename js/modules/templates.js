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
    DocFlow.Core.ModalHelper.submit({
        fields: [
            { id: 'newTemplateType', key: 'type', label: '模板类型', required: true },
            { id: 'newTemplateTitle', key: 'title', label: '模板标题', required: true },
            { id: 'newTemplateContent', key: 'content', label: '模板内容', required: true }
        ],
        submit: function (values) {
            templateStore.addTemplate(currentUser.id, values);
            return true;
        },
        successMessage: '模板添加成功！',
        refresh: [renderTemplateList]
    });
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
