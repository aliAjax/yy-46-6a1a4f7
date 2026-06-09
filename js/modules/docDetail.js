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
    DocFlow.Core.ModalHelper.submit({
        fields: [
            { id: 'supContent', key: 'content', label: '督办内容', required: true }
        ],
        submit: function (values) {
            return dataStore.addSupervisionRecord(currentDocId, values.content, currentUser, currentRole);
        },
        successMessage: '督办记录已添加！',
        refresh: [renderDocDetail, renderNav]
    });
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
    DocFlow.Core.ModalHelper.submit({
        fields: [
            { id: 'returnReason', key: 'reason', label: '退回原因', required: true }
        ],
        submit: function (values) {
            return dataStore.returnDoc(currentDocId, values.reason, currentUser, currentRole);
        },
        successMessage: '退回成功！',
        refresh: [renderDocDetail, renderNav]
    });
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
