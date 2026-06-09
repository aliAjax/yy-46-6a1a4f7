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

