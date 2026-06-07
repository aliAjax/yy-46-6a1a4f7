const STORAGE_KEY = 'doc_flow_system';

const ROLES = {
    OFFICE: 'office',
    LEADER: 'leader',
    STAFF: 'staff'
};

const ROLE_LABELS = {
    [ROLES.OFFICE]: '办公室人员',
    [ROLES.LEADER]: '领导',
    [ROLES.STAFF]: '科室承办人'
};

const FLOW_NODES = {
    REGISTER: 'register',
    PROPOSE: 'propose',
    ASSIGN: 'assign',
    HANDLE: 'handle',
    FEEDBACK: 'feedback',
    COMPLETE: 'complete'
};

const NODE_LABELS = {
    [FLOW_NODES.REGISTER]: '收文登记',
    [FLOW_NODES.PROPOSE]: '拟办',
    [FLOW_NODES.ASSIGN]: '分办',
    [FLOW_NODES.HANDLE]: '承办',
    [FLOW_NODES.FEEDBACK]: '反馈',
    [FLOW_NODES.COMPLETE]: '办结'
};

const NODE_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed'
};

const USERS = {
    [ROLES.OFFICE]: [
        { id: 'office1', name: '张秘书', dept: '办公室' },
        { id: 'office2', name: '李文员', dept: '办公室' }
    ],
    [ROLES.LEADER]: [
        { id: 'leader1', name: '王局长', dept: '局领导' },
        { id: 'leader2', name: '赵副局长', dept: '局领导' }
    ],
    [ROLES.STAFF]: [
        { id: 'staff1', name: '陈科长', dept: '综合科' },
        { id: 'staff2', name: '刘干事', dept: '综合科' },
        { id: 'staff3', name: '周主任', dept: '业务科' },
        { id: 'staff4', name: '吴干事', dept: '业务科' },
        { id: 'staff5', name: '郑科长', dept: '法规科' },
        { id: 'staff6', name: '孙干事', dept: '法规科' }
    ]
};

const DEPARTMENTS = ['综合科', '业务科', '法规科', '办公室'];

const PRIORITY_DAYS = {
    'normal': 5,
    'high': 3,
    'urgent': 1
};

const PRIORITY_LABELS = {
    'normal': '普通',
    'high': '加急',
    'urgent': '特急'
};

const WARNING_STATUS = {
    NORMAL: 'normal',
    APPROACHING: 'approaching',
    OVERDUE: 'overdue'
};

const WARNING_STATUS_LABELS = {
    [WARNING_STATUS.NORMAL]: '正常',
    [WARNING_STATUS.APPROACHING]: '临期',
    [WARNING_STATUS.OVERDUE]: '超期'
};

const HANDLE_TYPES = {
    MAIN: 'main',
    CO: 'co'
};

const HANDLE_TYPE_LABELS = {
    [HANDLE_TYPES.MAIN]: '主办',
    [HANDLE_TYPES.CO]: '协办'
};

const HANDLE_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed'
};

const HANDLE_STATUS_LABELS = {
    [HANDLE_STATUS.PENDING]: '待办理',
    [HANDLE_STATUS.COMPLETED]: '已完成'
};

function getDeadline(doc) {
    if (!doc.deadline) return null;
    return doc.deadline;
}

function getRemainingDays(doc) {
    if (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived) {
        return null;
    }
    if (!doc.deadline) return null;

    const now = new Date();
    const deadline = new Date(doc.deadline);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function getWarningStatus(doc) {
    if (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived) {
        return null;
    }
    const remainingDays = getRemainingDays(doc);
    if (remainingDays === null) return null;

    if (remainingDays < 0) {
        return WARNING_STATUS.OVERDUE;
    } else if (remainingDays <= 1) {
        return WARNING_STATUS.APPROACHING;
    }
    return WARNING_STATUS.NORMAL;
}

function getWarningStatusLabel(doc) {
    const status = getWarningStatus(doc);
    if (status === null) return '-';
    return WARNING_STATUS_LABELS[status];
}

function getWarningStatusClass(doc) {
    const status = getWarningStatus(doc);
    if (status === null) return '';
    return `warning-${status}`;
}

function calculateDeadline(priority, assignTime) {
    const days = PRIORITY_DAYS[priority] || PRIORITY_DAYS['normal'];
    const baseTime = assignTime ? new Date(assignTime) : new Date();
    const deadline = new Date(baseTime.getTime() + days * 24 * 60 * 60 * 1000);
    return deadline.toISOString();
}

function getDocStatusLabel(doc) {
    if (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived) {
        return '已办结';
    }
    const statusMap = {
        [FLOW_NODES.REGISTER]: '待登记',
        [FLOW_NODES.PROPOSE]: '待批示',
        [FLOW_NODES.ASSIGN]: '待分办',
        [FLOW_NODES.HANDLE]: '待承办',
        [FLOW_NODES.FEEDBACK]: '待反馈',
        [FLOW_NODES.COMPLETE]: '待归档'
    };
    return statusMap[doc.currentNode] || '未知';
}

function getDocStatusClass(doc) {
    if (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived) {
        return 'status-completed';
    }
    if (doc.currentNode === FLOW_NODES.COMPLETE) {
        return 'status-pending';
    }
    return 'status-processing';
}

function getStatusLabelByNode(node) {
    const statusMap = {
        [FLOW_NODES.REGISTER]: '待登记',
        [FLOW_NODES.PROPOSE]: '待批示',
        [FLOW_NODES.ASSIGN]: '待分办',
        [FLOW_NODES.HANDLE]: '待承办',
        [FLOW_NODES.FEEDBACK]: '待反馈',
        [FLOW_NODES.COMPLETE]: '已办结'
    };
    return statusMap[node] || '未知';
}

function isMultiDeptDoc(doc) {
    return !!(doc && doc.isMultiDept);
}

function getMainHandler(doc) {
    if (!doc || !doc.handleRecords) return null;
    return doc.handleRecords.find(r => r.type === HANDLE_TYPES.MAIN) || null;
}

function getCoHandlers(doc) {
    if (!doc || !doc.handleRecords) return [];
    return doc.handleRecords.filter(r => r.type === HANDLE_TYPES.CO);
}

function getAllHandlerUserIds(doc) {
    if (!doc || !doc.handleRecords) return [];
    return doc.handleRecords.map(r => r.userId);
}

function getHandlerRecord(doc, userId) {
    if (!doc || !doc.handleRecords) return null;
    return doc.handleRecords.find(r => r.userId === userId) || null;
}

function isMainHandler(doc, userId) {
    const main = getMainHandler(doc);
    return main && main.userId === userId;
}

function isCoHandler(doc, userId) {
    return !!getCoHandlers(doc).find(r => r.userId === userId);
}

function isHandler(doc, userId) {
    return !!getHandlerRecord(doc, userId);
}

function allCoHandlersCompleted(doc) {
    const coHandlers = getCoHandlers(doc);
    if (coHandlers.length === 0) return true;
    return coHandlers.every(r => r.status === HANDLE_STATUS.COMPLETED);
}

function getCoHandleProgress(doc) {
    const coHandlers = getCoHandlers(doc);
    if (coHandlers.length === 0) return { completed: 0, total: 0, percent: 100 };
    const completed = coHandlers.filter(r => r.status === HANDLE_STATUS.COMPLETED).length;
    return {
        completed,
        total: coHandlers.length,
        percent: Math.round((completed / coHandlers.length) * 100)
    };
}

class DataStore {
    constructor() {
        this.docs = [];
        this.currentUser = null;
        this.currentRole = null;
        this.load();
    }

    load() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.docs = parsed.docs || [];
                this.migrateData();
            } catch (e) {
                this.docs = [];
            }
        }
    }

    migrateData() {
        let changed = false;
        this.docs.forEach(doc => {
            if (doc.archived === undefined) {
                doc.archived = false;
                if (doc.currentNode === FLOW_NODES.COMPLETE) {
                    const hasCompleteRecord = doc.flowRecords &&
                        doc.flowRecords.some(r => r.node === FLOW_NODES.COMPLETE);
                    if (hasCompleteRecord) {
                        doc.archived = true;
                    }
                }
                changed = true;
            }
            doc.flowRecords = doc.flowRecords || [];

            if (doc.deadline === undefined) {
                doc.deadline = null;
                const assignRecord = doc.flowRecords.find(r => r.node === FLOW_NODES.ASSIGN);
                if (assignRecord && doc.currentNode !== FLOW_NODES.COMPLETE) {
                    doc.deadline = calculateDeadline(doc.priority, assignRecord.time);
                } else if (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived) {
                    doc.deadline = null;
                }
                changed = true;
            }

            if (doc.supervisionRecords === undefined) {
                doc.supervisionRecords = [];
                changed = true;
            }

            if (doc.isMultiDept === undefined) {
                doc.isMultiDept = false;
                changed = true;
            }

            if (doc.handleRecords === undefined) {
                doc.handleRecords = [];
                if (doc.assignedDept && doc.assignedUser) {
                    doc.handleRecords.push({
                        id: 'hr_' + Date.now() + '_main',
                        type: HANDLE_TYPES.MAIN,
                        dept: doc.assignedDept,
                        userId: doc.assignedUser,
                        userName: doc.assignedUserName || '',
                        status: HANDLE_STATUS.PENDING,
                        comment: '',
                        attachments: [],
                        submitTime: null
                    });
                }
                changed = true;
            }

            if (doc.assignedUser && doc.handleRecords.length > 0) {
                const mainRecord = doc.handleRecords.find(r => r.type === HANDLE_TYPES.MAIN);
                if (mainRecord && mainRecord.userId !== doc.assignedUser) {
                    mainRecord.userId = doc.assignedUser;
                    mainRecord.userName = doc.assignedUserName || '';
                    mainRecord.dept = doc.assignedDept;
                    changed = true;
                }
            }
        });
        if (changed) {
            this.save();
        }
    }

    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            docs: this.docs
        }));
    }

    generateDocId() {
        const now = new Date();
        const year = now.getFullYear();
        const count = this.docs.filter(d => d.id.startsWith(`GW-${year}-`)).length + 1;
        return `GW-${year}-${String(count).padStart(4, '0')}`;
    }

    createDoc(docData, creator) {
        const now = new Date().toISOString();
        const doc = {
            id: this.generateDocId(),
            title: docData.title,
            fromUnit: docData.fromUnit,
            docNumber: docData.docNumber,
            docDate: docData.docDate,
            priority: docData.priority || 'normal',
            category: docData.category || '',
            content: docData.content || '',
            currentNode: FLOW_NODES.PROPOSE,
            assignedDept: null,
            assignedUser: null,
            assignedUserName: null,
            isMultiDept: false,
            handleRecords: [],
            deadline: null,
            archived: false,
            createdAt: now,
            createdBy: creator.id,
            createdByName: creator.name,
            supervisionRecords: [],
            flowRecords: [{
                node: FLOW_NODES.REGISTER,
                status: NODE_STATUS.COMPLETED,
                operatorId: creator.id,
                operatorName: creator.name,
                operatorDept: creator.dept,
                time: now,
                comment: '收文登记完成',
                attachments: docData.attachments || []
            }]
        };
        this.docs.unshift(doc);
        this.save();

        messageStore.createMessage({
            type: MESSAGE_TYPES.NEW_DOC_PROPOSE,
            title: '新公文待批示',
            content: `《${doc.title}》已登记，请您批示`,
            docId: doc.id,
            docTitle: doc.title,
            fromUserId: creator.id,
            fromUserName: creator.name,
            toRole: ROLES.LEADER
        });

        return doc;
    }

    getDoc(id) {
        return this.docs.find(d => d.id === id);
    }

    listDocs(filters = {}) {
        let result = [...this.docs];

        if (filters.keyword) {
            const kw = filters.keyword.toLowerCase();
            result = result.filter(d =>
                d.title.toLowerCase().includes(kw) ||
                d.id.toLowerCase().includes(kw) ||
                d.fromUnit.toLowerCase().includes(kw)
            );
        }

        if (filters.status) {
            result = result.filter(d => d.currentNode === filters.status);
        }

        if (filters.assignedDept) {
            result = result.filter(d => {
                if (d.isMultiDept && d.handleRecords) {
                    return d.handleRecords.some(r => r.dept === filters.assignedDept);
                }
                return d.assignedDept === filters.assignedDept;
            });
        }

        if (filters.isMultiDept !== undefined) {
            result = result.filter(d => d.isMultiDept === filters.isMultiDept);
        }

        if (filters.assignedUser) {
            result = result.filter(d => {
                if (d.isMultiDept && d.handleRecords) {
                    return d.handleRecords.some(r => r.userId === filters.assignedUser);
                }
                return d.assignedUser === filters.assignedUser;
            });
        }

        return result;
    }

    listArchivedDocs(filters = {}) {
        let result = this.docs.filter(d => d.currentNode === FLOW_NODES.COMPLETE && d.archived);

        if (filters.title) {
            const kw = filters.title.toLowerCase();
            result = result.filter(d => d.title.toLowerCase().includes(kw));
        }

        if (filters.docNumber) {
            const kw = filters.docNumber.toLowerCase();
            result = result.filter(d =>
                d.id.toLowerCase().includes(kw) ||
                (d.docNumber && d.docNumber.toLowerCase().includes(kw))
            );
        }

        if (filters.fromUnit) {
            const kw = filters.fromUnit.toLowerCase();
            result = result.filter(d => d.fromUnit.toLowerCase().includes(kw));
        }

        if (filters.category) {
            result = result.filter(d => d.category === filters.category);
        }

        if (filters.assignedDept) {
            result = result.filter(d => {
                if (d.isMultiDept && d.handleRecords) {
                    return d.handleRecords.some(r => r.dept === filters.assignedDept);
                }
                return d.assignedDept === filters.assignedDept;
            });
        }

        if (filters.isMultiDept !== undefined) {
            result = result.filter(d => d.isMultiDept === filters.isMultiDept);
        }

        return result;
    }

    proposeDoc(docId, comment, operator) {
        const doc = this.getDoc(docId);
        if (!doc || doc.currentNode !== FLOW_NODES.PROPOSE) return null;

        const now = new Date().toISOString();
        doc.flowRecords.push({
            node: FLOW_NODES.PROPOSE,
            status: NODE_STATUS.COMPLETED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: comment,
            attachments: []
        });

        doc.currentNode = FLOW_NODES.ASSIGN;
        this.save();
        return doc;
    }

    assignDoc(docId, dept, userId, userName, comment, operator) {
        return this.assignDocMulti(docId, {
            mainDept: dept,
            mainUserId: userId,
            mainUserName: userName,
            coHandlers: [],
            comment: comment
        }, operator);
    }

    assignDocMulti(docId, assignData, operator) {
        const doc = this.getDoc(docId);
        if (!doc || doc.currentNode !== FLOW_NODES.ASSIGN) return null;

        const now = new Date().toISOString();
        const { mainDept, mainUserId, mainUserName, coHandlers = [], comment } = assignData;
        const isMulti = coHandlers && coHandlers.length > 0;

        doc.flowRecords.push({
            node: FLOW_NODES.ASSIGN,
            status: NODE_STATUS.COMPLETED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: comment,
            attachments: [],
            assignedDept: mainDept,
            assignedUserId: mainUserId,
            assignedUserName: mainUserName,
            isMultiDept: isMulti,
            coHandlers: coHandlers
        });

        doc.assignedDept = mainDept;
        doc.assignedUser = mainUserId;
        doc.assignedUserName = mainUserName;
        doc.isMultiDept = isMulti;
        doc.deadline = calculateDeadline(doc.priority, now);

        doc.handleRecords = [];

        doc.handleRecords.push({
            id: 'hr_main_' + Date.now(),
            type: HANDLE_TYPES.MAIN,
            dept: mainDept,
            userId: mainUserId,
            userName: mainUserName,
            status: HANDLE_STATUS.PENDING,
            comment: '',
            attachments: [],
            submitTime: null
        });

        coHandlers.forEach((co, index) => {
            doc.handleRecords.push({
                id: 'hr_co_' + Date.now() + '_' + index,
                type: HANDLE_TYPES.CO,
                dept: co.dept,
                userId: co.userId,
                userName: co.userName,
                status: HANDLE_STATUS.PENDING,
                comment: '',
                attachments: [],
                submitTime: null
            });
        });

        doc.currentNode = FLOW_NODES.HANDLE;
        this.save();

        doc.handleRecords.forEach(hr => {
            const isMain = hr.type === HANDLE_TYPES.MAIN;
            messageStore.createMessage({
                type: MESSAGE_TYPES.DOC_ASSIGNED,
                title: isMain ? '新公文主办' : '新公文协办',
                content: `《${doc.title}》已分派给您${isMain ? '主办' : '协办'}`,
                docId: doc.id,
                docTitle: doc.title,
                fromUserId: operator.id,
                fromUserName: operator.name,
                toUserId: hr.userId
            });
        });

        return doc;
    }

    handleDoc(docId, comment, attachments, operator) {
        const doc = this.getDoc(docId);
        if (!doc || doc.currentNode !== FLOW_NODES.HANDLE) return null;

        const handlerRecord = getHandlerRecord(doc, operator.id);
        if (!handlerRecord) return null;

        const now = new Date().toISOString();

        handlerRecord.status = HANDLE_STATUS.COMPLETED;
        handlerRecord.comment = comment;
        handlerRecord.attachments = attachments || [];
        handlerRecord.submitTime = now;

        const isMain = handlerRecord.type === HANDLE_TYPES.MAIN;

        doc.flowRecords.push({
            node: FLOW_NODES.HANDLE,
            status: NODE_STATUS.COMPLETED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: comment,
            attachments: attachments || [],
            handleType: handlerRecord.type,
            handleDept: handlerRecord.dept
        });

        const allCompleted = doc.handleRecords.every(r => r.status === HANDLE_STATUS.COMPLETED);

        if (allCompleted) {
            doc.currentNode = FLOW_NODES.FEEDBACK;
        }

        this.save();

        if (isMain) {
            messageStore.createMessage({
                type: MESSAGE_TYPES.DOC_HANDLED,
                title: '公文办理中',
                content: `《${doc.title}》主办人已提交办理进展`,
                docId: doc.id,
                docTitle: doc.title,
                fromUserId: operator.id,
                fromUserName: operator.name,
                toRole: ROLES.LEADER
            });
        } else {
            const mainHandler = getMainHandler(doc);
            if (mainHandler) {
                messageStore.createMessage({
                    type: MESSAGE_TYPES.DOC_HANDLED,
                    title: '协办意见已提交',
                    content: `《${doc.title}》${handlerRecord.dept}已提交协办意见`,
                    docId: doc.id,
                    docTitle: doc.title,
                    fromUserId: operator.id,
                    fromUserName: operator.name,
                    toUserId: mainHandler.userId
                });
            }
        }

        return doc;
    }

    feedbackDoc(docId, comment, attachments, operator) {
        const doc = this.getDoc(docId);
        if (!doc || doc.currentNode !== FLOW_NODES.FEEDBACK) return null;

        if (doc.isMultiDept && !isMainHandler(doc, operator.id)) {
            return null;
        }

        if (!doc.isMultiDept && doc.assignedUser !== operator.id) {
            return null;
        }

        const now = new Date().toISOString();
        doc.flowRecords.push({
            node: FLOW_NODES.FEEDBACK,
            status: NODE_STATUS.COMPLETED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: comment,
            attachments: attachments || []
        });

        doc.currentNode = FLOW_NODES.COMPLETE;
        this.save();

        messageStore.createMessage({
            type: MESSAGE_TYPES.DOC_COMPLETED,
            title: '公文待归档',
            content: `《${doc.title}》已办结，请归档`,
            docId: doc.id,
            docTitle: doc.title,
            fromUserId: operator.id,
            fromUserName: operator.name,
            toRole: ROLES.OFFICE
        });

        messageStore.createMessage({
            type: MESSAGE_TYPES.DOC_FEEDBACK,
            title: '公文已反馈',
            content: `《${doc.title}》主办人已提交最终反馈`,
            docId: doc.id,
            docTitle: doc.title,
            fromUserId: operator.id,
            fromUserName: operator.name,
            toRole: ROLES.LEADER
        });

        return doc;
    }

    completeDoc(docId, comment, operator) {
        const doc = this.getDoc(docId);
        if (!doc || doc.currentNode !== FLOW_NODES.COMPLETE || doc.archived) return null;

        const now = new Date().toISOString();
        doc.flowRecords.push({
            node: FLOW_NODES.COMPLETE,
            status: NODE_STATUS.COMPLETED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: comment,
            attachments: []
        });

        doc.archived = true;
        this.save();

        messageStore.createMessage({
            type: MESSAGE_TYPES.DOC_ARCHIVED,
            title: '公文已归档',
            content: `《${doc.title}》已完成归档`,
            docId: doc.id,
            docTitle: doc.title,
            fromUserId: operator.id,
            fromUserName: operator.name,
            toRole: ROLES.LEADER
        });

        const userIds = getAllHandlerUserIds(doc);
        if (userIds.length > 0) {
            userIds.forEach(userId => {
                messageStore.createMessage({
                    type: MESSAGE_TYPES.DOC_ARCHIVED,
                    title: '公文已归档',
                    content: `《${doc.title}》已完成归档`,
                    docId: doc.id,
                    docTitle: doc.title,
                    fromUserId: operator.id,
                    fromUserName: operator.name,
                    toUserId: userId
                });
            });
        } else if (doc.assignedUser) {
            messageStore.createMessage({
                type: MESSAGE_TYPES.DOC_ARCHIVED,
                title: '公文已归档',
                content: `《${doc.title}》已完成归档`,
                docId: doc.id,
                docTitle: doc.title,
                fromUserId: operator.id,
                fromUserName: operator.name,
                toUserId: doc.assignedUser
            });
        }

        return doc;
    }

    addSupervisionRecord(docId, content, operator, role) {
        const doc = this.getDoc(docId);
        if (!doc) return null;

        if (!this.canSupervise(doc, role, operator)) {
            return null;
        }

        const now = new Date().toISOString();
        const record = {
            id: 'sup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            content: content,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now
        };

        doc.supervisionRecords = doc.supervisionRecords || [];
        doc.supervisionRecords.push(record);
        this.save();

        const handlerUserIds = getAllHandlerUserIds(doc);
        if (handlerUserIds.length > 0) {
            handlerUserIds.forEach(userId => {
                messageStore.createMessage({
                    type: MESSAGE_TYPES.SUPERVISION,
                    title: '督办提醒',
                    content: `《${doc.title}》收到新的督办记录，请及时处理`,
                    docId: doc.id,
                    docTitle: doc.title,
                    fromUserId: operator.id,
                    fromUserName: operator.name,
                    toUserId: userId
                });
            });
        } else if (doc.assignedUser) {
            messageStore.createMessage({
                type: MESSAGE_TYPES.SUPERVISION,
                title: '督办提醒',
                content: `《${doc.title}》收到新的督办记录，请及时处理`,
                docId: doc.id,
                docTitle: doc.title,
                fromUserId: operator.id,
                fromUserName: operator.name,
                toUserId: doc.assignedUser
            });
        }

        return record;
    }

    listSupervisionDocs(filters = {}) {
        let result = this.docs.filter(d =>
            d.currentNode !== FLOW_NODES.REGISTER &&
            !(d.currentNode === FLOW_NODES.COMPLETE && d.archived)
        );

        if (filters.keyword) {
            const kw = filters.keyword.toLowerCase();
            result = result.filter(d =>
                d.title.toLowerCase().includes(kw) ||
                d.id.toLowerCase().includes(kw) ||
                d.fromUnit.toLowerCase().includes(kw)
            );
        }

        if (filters.assignedDept) {
            result = result.filter(d => {
                if (d.isMultiDept && d.handleRecords) {
                    return d.handleRecords.some(r => r.dept === filters.assignedDept);
                }
                return d.assignedDept === filters.assignedDept;
            });
        }

        if (filters.assignedUser) {
            result = result.filter(d => {
                if (d.isMultiDept && d.handleRecords) {
                    return d.handleRecords.some(r => r.userId === filters.assignedUser);
                }
                return d.assignedUser === filters.assignedUser;
            });
        }

        if (filters.warningStatus) {
            result = result.filter(d => getWarningStatus(d) === filters.warningStatus);
        }

        if (filters.currentNode) {
            result = result.filter(d => d.currentNode === filters.currentNode);
        }

        result.sort((a, b) => {
            const statusA = getWarningStatus(a);
            const statusB = getWarningStatus(b);
            const priority = { overdue: 0, approaching: 1, normal: 2, null: 3 };
            const pA = priority[statusA] !== undefined ? priority[statusA] : 3;
            const pB = priority[statusB] !== undefined ? priority[statusB] : 3;
            if (pA !== pB) return pA - pB;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        return result;
    }

    getSupervisionStats(role, user) {
        const stats = {
            total: 0,
            normal: 0,
            approaching: 0,
            overdue: 0,
            myOverdue: 0
        };

        const activeDocs = this.docs.filter(d =>
            d.currentNode !== FLOW_NODES.REGISTER &&
            !(d.currentNode === FLOW_NODES.COMPLETE && d.archived)
        );

        activeDocs.forEach(doc => {
            const status = getWarningStatus(doc);
            stats.total++;
            if (status === WARNING_STATUS.NORMAL) {
                stats.normal++;
            } else if (status === WARNING_STATUS.APPROACHING) {
                stats.approaching++;
            } else if (status === WARNING_STATUS.OVERDUE) {
                stats.overdue++;
            }

            if (role === ROLES.STAFF && user) {
                const handlerRecord = getHandlerRecord(doc, user.id);
                if (handlerRecord && handlerRecord.status === HANDLE_STATUS.PENDING) {
                    if (status === WARNING_STATUS.OVERDUE) {
                        stats.myOverdue++;
                    }
                }
            }
        });

        return stats;
    }

    canSupervise(doc, role, user) {
        if (!doc || !user) return false;
        if (role !== ROLES.OFFICE) return false;
        if (doc.currentNode === FLOW_NODES.REGISTER) return false;
        if (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived) return false;
        if (!doc.deadline) return false;
        const warningStatus = getWarningStatus(doc);
        return warningStatus === WARNING_STATUS.OVERDUE;
    }

    getStats(role, user) {
        const stats = {
            total: this.docs.length,
            pending: 0,
            processing: 0,
            completed: 0,
            myPending: 0
        };

        this.docs.forEach(doc => {
            if (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived) {
                stats.completed++;
            } else {
                stats.processing++;
            }

            if (role === ROLES.OFFICE) {
                if (doc.currentNode === FLOW_NODES.COMPLETE && !doc.archived) {
                    stats.myPending++;
                }
            } else if (role === ROLES.LEADER) {
                if (doc.currentNode === FLOW_NODES.PROPOSE || doc.currentNode === FLOW_NODES.ASSIGN) {
                    stats.myPending++;
                }
            } else if (role === ROLES.STAFF && user) {
                const handlerRecord = getHandlerRecord(doc, user.id);
                if (handlerRecord && handlerRecord.status === HANDLE_STATUS.PENDING &&
                    (doc.currentNode === FLOW_NODES.HANDLE || doc.currentNode === FLOW_NODES.FEEDBACK)) {
                    if (handlerRecord.type === HANDLE_TYPES.MAIN) {
                        stats.myPending++;
                    } else if (handlerRecord.type === HANDLE_TYPES.CO && doc.currentNode === FLOW_NODES.HANDLE) {
                        stats.myPending++;
                    }
                }
            }
        });

        return stats;
    }

    canOperate(doc, role, user) {
        if (!doc || !user) return false;

        switch (doc.currentNode) {
            case FLOW_NODES.PROPOSE:
                return role === ROLES.LEADER;
            case FLOW_NODES.ASSIGN:
                return role === ROLES.LEADER;
            case FLOW_NODES.HANDLE:
                if (role !== ROLES.STAFF) return false;
                const handleRecord = getHandlerRecord(doc, user.id);
                return handleRecord && handleRecord.status === HANDLE_STATUS.PENDING;
            case FLOW_NODES.FEEDBACK:
                if (role !== ROLES.STAFF) return false;
                if (doc.isMultiDept) {
                    return isMainHandler(doc, user.id);
                }
                return doc.assignedUser === user.id;
            case FLOW_NODES.COMPLETE:
                return role === ROLES.OFFICE && !doc.archived;
            default:
                return false;
        }
    }

    initMockData() {
        if (this.docs.length > 0) return;

        const now = Date.now();

        this.docs = [
            {
                id: 'GW-2025-0001',
                title: '关于组织开展2025年度工作总结的通知',
                fromUnit: '市人民政府办公室',
                docNumber: '市政办发〔2025〕12号',
                docDate: '2025-01-15',
                priority: 'high',
                category: '通知',
                content: '各科室、各下属单位：\n\n根据市政府工作安排，现就开展2025年度工作总结有关事项通知如下：\n一、总结内容\n二、报送要求\n三、时间安排\n\n请各单位认真组织落实。',
                currentNode: FLOW_NODES.COMPLETE,
                assignedDept: '综合科',
                assignedUser: 'staff1',
                assignedUserName: '陈科长',
                deadline: null,
                archived: true,
                createdAt: new Date(now - 86400000 * 10).toISOString(),
                createdBy: 'office1',
                createdByName: '张秘书',
                supervisionRecords: [],
                flowRecords: [
                    {
                        node: FLOW_NODES.REGISTER,
                        status: 'completed',
                        operatorId: 'office1',
                        operatorName: '张秘书',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 10).toISOString(),
                        comment: '收文登记',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.PROPOSE,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 9).toISOString(),
                        comment: '请综合科牵头，各科室配合做好年度总结工作。',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.ASSIGN,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 9).toISOString(),
                        comment: '交由综合科陈科长负责办理。',
                        attachments: [],
                        assignedDept: '综合科',
                        assignedUserId: 'staff1',
                        assignedUserName: '陈科长'
                    },
                    {
                        node: FLOW_NODES.HANDLE,
                        status: 'completed',
                        operatorId: 'staff1',
                        operatorName: '陈科长',
                        operatorDept: '综合科',
                        time: new Date(now - 86400000 * 7).toISOString(),
                        comment: '已组织各科室开展总结撰写工作，目前进展顺利。',
                        attachments: [{ name: '年度工作安排表.pdf', size: '245KB' }]
                    },
                    {
                        node: FLOW_NODES.FEEDBACK,
                        status: 'completed',
                        operatorId: 'staff1',
                        operatorName: '陈科长',
                        operatorDept: '综合科',
                        time: new Date(now - 86400000 * 3).toISOString(),
                        comment: '已完成年度总结初稿，报送领导审阅。',
                        attachments: [{ name: '2025年度工作总结.docx', size: '1.2MB' }]
                    },
                    {
                        node: FLOW_NODES.COMPLETE,
                        status: 'completed',
                        operatorId: 'office1',
                        operatorName: '张秘书',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 2).toISOString(),
                        comment: '文件已归档。',
                        attachments: []
                    }
                ]
            },
            {
                id: 'GW-2025-0002',
                title: '关于申请专项经费的请示',
                fromUnit: '市发展和改革委员会',
                docNumber: '市发改〔2025〕28号',
                docDate: '2025-02-10',
                priority: 'high',
                category: '请示',
                content: '市政府：\n\n为推进我市重点项目建设，特申请专项经费500万元，用于项目前期工作。\n\n妥否，请批示。',
                currentNode: FLOW_NODES.ASSIGN,
                assignedDept: null,
                assignedUser: null,
                assignedUserName: null,
                deadline: null,
                archived: false,
                createdAt: new Date(now - 86400000 * 5).toISOString(),
                createdBy: 'office2',
                createdByName: '李文员',
                supervisionRecords: [],
                flowRecords: [
                    {
                        node: FLOW_NODES.REGISTER,
                        status: 'completed',
                        operatorId: 'office2',
                        operatorName: '李文员',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 5).toISOString(),
                        comment: '收文登记',
                        attachments: [{ name: '经费申请附件.xlsx', size: '56KB' }]
                    },
                    {
                        node: FLOW_NODES.PROPOSE,
                        status: 'completed',
                        operatorId: 'leader2',
                        operatorName: '赵副局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 4).toISOString(),
                        comment: '此件重要，请王局长阅示，建议交由业务科会同法规科研究办理。',
                        attachments: []
                    }
                ]
            },
            {
                id: 'GW-2025-0003',
                title: '关于开展安全生产检查的通知',
                fromUnit: '市应急管理局',
                docNumber: '市应急〔2025〕15号',
                docDate: '2025-02-20',
                priority: 'normal',
                category: '通知',
                content: '各单位：\n\n为贯彻落实安全生产工作要求，决定在全市范围内开展安全生产大检查。',
                currentNode: FLOW_NODES.HANDLE,
                assignedDept: '业务科',
                assignedUser: 'staff3',
                assignedUserName: '周主任',
                deadline: new Date(now - 86400000 * 7).toISOString(),
                archived: false,
                createdAt: new Date(now - 86400000 * 12).toISOString(),
                createdBy: 'office1',
                createdByName: '张秘书',
                supervisionRecords: [
                    {
                        id: 'sup_mock_1',
                        content: '该文件已超期，请业务科尽快办理并说明原因。',
                        operatorId: 'office1',
                        operatorName: '张秘书',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 1).toISOString()
                    }
                ],
                flowRecords: [
                    {
                        node: FLOW_NODES.REGISTER,
                        status: 'completed',
                        operatorId: 'office1',
                        operatorName: '张秘书',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 12).toISOString(),
                        comment: '收文登记',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.PROPOSE,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 11.5).toISOString(),
                        comment: '请业务科牵头落实。',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.ASSIGN,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 11.5).toISOString(),
                        comment: '交由业务科周主任办理。',
                        attachments: [],
                        assignedDept: '业务科',
                        assignedUserId: 'staff3',
                        assignedUserName: '周主任'
                    }
                ]
            },
            {
                id: 'GW-2025-0004',
                title: '关于报送月度工作报表的通知',
                fromUnit: '市统计局',
                docNumber: '市统〔2025〕6号',
                docDate: '2025-02-25',
                priority: 'normal',
                category: '通知',
                content: '各有关单位：\n\n请于每月5日前报送上月工作统计报表。',
                currentNode: FLOW_NODES.FEEDBACK,
                assignedDept: '综合科',
                assignedUser: 'staff2',
                assignedUserName: '刘干事',
                deadline: new Date(now + 86400000 * 0.5).toISOString(),
                archived: false,
                createdAt: new Date(now - 86400000 * 5).toISOString(),
                createdBy: 'office2',
                createdByName: '李文员',
                supervisionRecords: [],
                flowRecords: [
                    {
                        node: FLOW_NODES.REGISTER,
                        status: 'completed',
                        operatorId: 'office2',
                        operatorName: '李文员',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 5).toISOString(),
                        comment: '收文登记',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.PROPOSE,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 4.5).toISOString(),
                        comment: '请综合科按时报送。',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.ASSIGN,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 4.5).toISOString(),
                        comment: '交由综合科刘干事办理。',
                        attachments: [],
                        assignedDept: '综合科',
                        assignedUserId: 'staff2',
                        assignedUserName: '刘干事'
                    },
                    {
                        node: FLOW_NODES.HANDLE,
                        status: 'completed',
                        operatorId: 'staff2',
                        operatorName: '刘干事',
                        operatorDept: '综合科',
                        time: new Date(now - 86400000 * 2).toISOString(),
                        comment: '已完成报表数据的统计和整理工作。',
                        attachments: [{ name: '月度数据统计.xlsx', size: '89KB' }]
                    }
                ]
            },
            {
                id: 'GW-2025-0005',
                title: '关于召开工作会议的通知',
                fromUnit: '市人民政府',
                docNumber: '市府明电〔2025〕3号',
                docDate: '2025-03-01',
                priority: 'urgent',
                category: '通知',
                content: '各单位：\n\n定于3月5日上午9:00在市政府会议厅召开全市工作会议，请主要负责人参加。',
                currentNode: FLOW_NODES.PROPOSE,
                assignedDept: null,
                assignedUser: null,
                assignedUserName: null,
                deadline: null,
                archived: false,
                createdAt: new Date(now - 86400000 * 0.5).toISOString(),
                createdBy: 'office1',
                createdByName: '张秘书',
                supervisionRecords: [],
                flowRecords: [
                    {
                        node: FLOW_NODES.REGISTER,
                        status: 'completed',
                        operatorId: 'office1',
                        operatorName: '张秘书',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 0.5).toISOString(),
                        comment: '急件，特急办理！',
                        attachments: []
                    }
                ]
            },
            {
                id: 'GW-2025-0006',
                title: '关于加强信息化建设工作的意见',
                fromUnit: '市大数据发展管理局',
                docNumber: '市数发〔2025〕8号',
                docDate: '2025-02-28',
                priority: 'high',
                category: '意见',
                content: '各单位：\n\n为加快推进我市政务信息化建设，提升政务服务水平，现就加强信息化建设工作提出以下意见...',
                currentNode: FLOW_NODES.HANDLE,
                assignedDept: '法规科',
                assignedUser: 'staff5',
                assignedUserName: '郑科长',
                deadline: new Date(now - 86400000 * 2).toISOString(),
                archived: false,
                createdAt: new Date(now - 86400000 * 7).toISOString(),
                createdBy: 'office2',
                createdByName: '李文员',
                supervisionRecords: [
                    {
                        id: 'sup_mock_2',
                        content: '加急件即将到期，请法规科加快办理进度。',
                        operatorId: 'office1',
                        operatorName: '张秘书',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 0.5).toISOString()
                    }
                ],
                flowRecords: [
                    {
                        node: FLOW_NODES.REGISTER,
                        status: 'completed',
                        operatorId: 'office2',
                        operatorName: '李文员',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 7).toISOString(),
                        comment: '收文登记',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.PROPOSE,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 6).toISOString(),
                        comment: '请法规科牵头研究，提出落实意见。',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.ASSIGN,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 5).toISOString(),
                        comment: '交由法规科郑科长办理。',
                        attachments: [],
                        assignedDept: '法规科',
                        assignedUserId: 'staff5',
                        assignedUserName: '郑科长'
                    }
                ]
            },
            {
                id: 'GW-2025-0007',
                title: '关于做好2025年度预算编制工作的通知',
                fromUnit: '市财政局',
                docNumber: '市财预〔2025〕15号',
                docDate: '2025-03-02',
                priority: 'normal',
                category: '通知',
                content: '各预算单位：\n\n根据《预算法》有关规定，现就做好2025年度部门预算编制工作通知如下...',
                currentNode: FLOW_NODES.HANDLE,
                assignedDept: '综合科',
                assignedUser: 'staff1',
                assignedUserName: '陈科长',
                deadline: new Date(now + 86400000 * 3).toISOString(),
                archived: false,
                createdAt: new Date(now - 86400000 * 2).toISOString(),
                createdBy: 'office1',
                createdByName: '张秘书',
                supervisionRecords: [],
                flowRecords: [
                    {
                        node: FLOW_NODES.REGISTER,
                        status: 'completed',
                        operatorId: 'office1',
                        operatorName: '张秘书',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 2).toISOString(),
                        comment: '收文登记',
                        attachments: [{ name: '预算编制说明.pdf', size: '320KB' }]
                    },
                    {
                        node: FLOW_NODES.PROPOSE,
                        status: 'completed',
                        operatorId: 'leader2',
                        operatorName: '赵副局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 1.5).toISOString(),
                        comment: '请综合科牵头，各科室配合做好预算编制工作。',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.ASSIGN,
                        status: 'completed',
                        operatorId: 'leader2',
                        operatorName: '赵副局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 1.5).toISOString(),
                        comment: '交由综合科陈科长负责办理。',
                        attachments: [],
                        assignedDept: '综合科',
                        assignedUserId: 'staff1',
                        assignedUserName: '陈科长'
                    }
                ]
            }
        ];

        this.save();
    }
}

const dataStore = new DataStore();
dataStore.initMockData();

const TEMPLATE_TYPES = {
    PROPOSE: 'propose',
    ASSIGN: 'assign',
    HANDLE: 'handle',
    FEEDBACK: 'feedback'
};

const TEMPLATE_TYPE_LABELS = {
    [TEMPLATE_TYPES.PROPOSE]: '批示意见',
    [TEMPLATE_TYPES.ASSIGN]: '分办意见',
    [TEMPLATE_TYPES.HANDLE]: '办理意见',
    [TEMPLATE_TYPES.FEEDBACK]: '反馈意见'
};

const TEMPLATE_STORAGE_KEY = 'doc_flow_templates';

class TemplateStore {
    constructor() {
        this.templates = {};
        this.load();
    }

    load() {
        const data = localStorage.getItem(TEMPLATE_STORAGE_KEY);
        if (data) {
            try {
                this.templates = JSON.parse(data);
            } catch (e) {
                this.templates = {};
            }
        }
    }

    save() {
        localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(this.templates));
    }

    getUserTemplates(userId, type = null) {
        const userTemplates = this.templates[userId] || [];
        if (type) {
            return userTemplates
                .filter(t => t.type === type)
                .sort((a, b) => b.useCount - a.useCount || b.createdAt - a.createdAt);
        }
        return userTemplates.sort((a, b) => b.useCount - a.useCount || b.createdAt - a.createdAt);
    }

    addTemplate(userId, templateData) {
        if (!this.templates[userId]) {
            this.templates[userId] = [];
        }
        const template = {
            id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: templateData.title,
            content: templateData.content,
            type: templateData.type,
            useCount: 0,
            createdAt: Date.now()
        };
        this.templates[userId].push(template);
        this.save();
        return template;
    }

    deleteTemplate(userId, templateId) {
        if (!this.templates[userId]) return false;
        const index = this.templates[userId].findIndex(t => t.id === templateId);
        if (index === -1) return false;
        this.templates[userId].splice(index, 1);
        this.save();
        return true;
    }

    useTemplate(userId, templateId) {
        if (!this.templates[userId]) return null;
        const template = this.templates[userId].find(t => t.id === templateId);
        if (!template) return null;
        template.useCount = (template.useCount || 0) + 1;
        this.save();
        return template;
    }

    initMockTemplates() {
        const hasAny = Object.keys(this.templates).some(k => this.templates[k].length > 0);
        if (hasAny) return;

        this.templates = {
            leader1: [
                { id: 'tpl_l1_1', title: '请相关科室研究办理', content: '请相关科室认真研究，按要求办理落实。', type: TEMPLATE_TYPES.PROPOSE, useCount: 5, createdAt: Date.now() - 86400000 * 10 },
                { id: 'tpl_l1_2', title: '请综合科牵头办理', content: '请综合科牵头，会同相关科室研究办理，及时反馈结果。', type: TEMPLATE_TYPES.PROPOSE, useCount: 3, createdAt: Date.now() - 86400000 * 8 },
                { id: 'tpl_l1_3', title: '同意，按程序办理', content: '同意，按程序办理。', type: TEMPLATE_TYPES.ASSIGN, useCount: 8, createdAt: Date.now() - 86400000 * 5 },
                { id: 'tpl_l1_4', title: '请业务科承办', content: '请业务科负责承办，按要求推进相关工作。', type: TEMPLATE_TYPES.ASSIGN, useCount: 2, createdAt: Date.now() - 86400000 * 3 }
            ],
            leader2: [
                { id: 'tpl_l2_1', title: '请王局长阅示', content: '此件重要，请王局长阅示。', type: TEMPLATE_TYPES.PROPOSE, useCount: 4, createdAt: Date.now() - 86400000 * 7 }
            ],
            staff1: [
                { id: 'tpl_s1_1', title: '已按要求办理', content: '已按要求完成相关工作，现报送办理结果。', type: TEMPLATE_TYPES.HANDLE, useCount: 6, createdAt: Date.now() - 86400000 * 6 },
                { id: 'tpl_s1_2', title: '工作进展顺利', content: '各项工作正在有序推进，总体进展顺利。', type: TEMPLATE_TYPES.HANDLE, useCount: 2, createdAt: Date.now() - 86400000 * 4 },
                { id: 'tpl_s1_3', title: '办理完成，请审阅', content: '已完成全部办理工作，相关材料已整理完毕，请领导审阅。', type: TEMPLATE_TYPES.FEEDBACK, useCount: 4, createdAt: Date.now() - 86400000 * 2 }
            ],
            staff3: [
                { id: 'tpl_s3_1', title: '业务办理标准模板', content: '已按照业务规范和相关要求完成办理工作，具体情况如下：\n一、办理情况\n二、主要成效\n三、下一步计划', type: TEMPLATE_TYPES.HANDLE, useCount: 3, createdAt: Date.now() - 86400000 * 5 }
            ]
        };
        this.save();
    }
}

const templateStore = new TemplateStore();
templateStore.initMockTemplates();

const MESSAGE_TYPES = {
    NEW_DOC_PROPOSE: 'new_doc_propose',
    DOC_ASSIGNED: 'doc_assigned',
    DOC_HANDLED: 'doc_handled',
    DOC_FEEDBACK: 'doc_feedback',
    DOC_COMPLETED: 'doc_completed',
    DOC_ARCHIVED: 'doc_archived',
    SUPERVISION: 'supervision'
};

const MESSAGE_TYPE_LABELS = {
    [MESSAGE_TYPES.NEW_DOC_PROPOSE]: '待批示',
    [MESSAGE_TYPES.DOC_ASSIGNED]: '新交办',
    [MESSAGE_TYPES.DOC_HANDLED]: '办理中',
    [MESSAGE_TYPES.DOC_FEEDBACK]: '已反馈',
    [MESSAGE_TYPES.DOC_COMPLETED]: '待归档',
    [MESSAGE_TYPES.DOC_ARCHIVED]: '已归档',
    [MESSAGE_TYPES.SUPERVISION]: '督办'
};

const MESSAGE_STORAGE_KEY = 'doc_flow_messages';

class MessageStore {
    constructor() {
        this.messages = [];
        this.load();
    }

    load() {
        const data = localStorage.getItem(MESSAGE_STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.messages = parsed.messages || [];
            } catch (e) {
                this.messages = [];
            }
        }
    }

    save() {
        localStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify({
            messages: this.messages
        }));
    }

    generateId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    createMessage(messageData) {
        const now = new Date().toISOString();
        const message = {
            id: this.generateId(),
            type: messageData.type,
            title: messageData.title,
            content: messageData.content,
            docId: messageData.docId,
            docTitle: messageData.docTitle,
            fromUserId: messageData.fromUserId,
            fromUserName: messageData.fromUserName,
            toUserId: messageData.toUserId || null,
            toRole: messageData.toRole || null,
            read: false,
            createdAt: now
        };
        this.messages.unshift(message);
        this.save();
        return message;
    }

    getMessagesForUser(role, user) {
        return this.messages.filter(msg => {
            if (msg.toUserId && msg.toUserId === user.id) {
                return true;
            }
            if (msg.toRole && msg.toRole === role) {
                return true;
            }
            return false;
        });
    }

    getUnreadCount(role, user) {
        return this.getMessagesForUser(role, user).filter(m => !m.read).length;
    }

    getRecentMessages(role, user, limit = 5) {
        return this.getMessagesForUser(role, user).slice(0, limit);
    }

    markAsRead(messageId) {
        const msg = this.messages.find(m => m.id === messageId);
        if (msg && !msg.read) {
            msg.read = true;
            this.save();
            return true;
        }
        return false;
    }

    markAllAsRead(role, user) {
        const userMessages = this.getMessagesForUser(role, user);
        userMessages.forEach(msg => {
            msg.read = true;
        });
        this.save();
        return userMessages.length;
    }

    getMessage(id) {
        return this.messages.find(m => m.id === id);
    }

    initMockMessages() {
        if (this.messages.length > 0) return;

        const now = Date.now();

        this.messages = [
            {
                id: 'msg_001',
                type: MESSAGE_TYPES.NEW_DOC_PROPOSE,
                title: '新公文待批示',
                content: '《关于召开工作会议的通知》已登记，请您批示',
                docId: 'GW-2025-0005',
                docTitle: '关于召开工作会议的通知',
                fromUserId: 'office1',
                fromUserName: '张秘书',
                toUserId: null,
                toRole: ROLES.LEADER,
                read: false,
                createdAt: new Date(now - 86400000 * 0.3).toISOString()
            },
            {
                id: 'msg_002',
                type: MESSAGE_TYPES.NEW_DOC_PROPOSE,
                title: '新公文待批示',
                content: '《关于申请专项经费的请示》已登记，请您批示',
                docId: 'GW-2025-0002',
                docTitle: '关于申请专项经费的请示',
                fromUserId: 'office2',
                fromUserName: '李文员',
                toUserId: null,
                toRole: ROLES.LEADER,
                read: true,
                createdAt: new Date(now - 86400000 * 4).toISOString()
            },
            {
                id: 'msg_003',
                type: MESSAGE_TYPES.DOC_ASSIGNED,
                title: '新公文交办',
                content: '《关于开展安全生产检查的通知》已分派给您办理',
                docId: 'GW-2025-0003',
                docTitle: '关于开展安全生产检查的通知',
                fromUserId: 'leader1',
                fromUserName: '王局长',
                toUserId: 'staff3',
                toRole: null,
                read: false,
                createdAt: new Date(now - 86400000 * 2.5).toISOString()
            },
            {
                id: 'msg_004',
                type: MESSAGE_TYPES.DOC_ASSIGNED,
                title: '新公文交办',
                content: '《关于报送月度工作报表的通知》已分派给您办理',
                docId: 'GW-2025-0004',
                docTitle: '关于报送月度工作报表的通知',
                fromUserId: 'leader1',
                fromUserName: '王局长',
                toUserId: 'staff2',
                toRole: null,
                read: true,
                createdAt: new Date(now - 86400000 * 1.8).toISOString()
            },
            {
                id: 'msg_005',
                type: MESSAGE_TYPES.DOC_COMPLETED,
                title: '公文待归档',
                content: '《关于组织开展2025年度工作总结的通知》已办结，请归档',
                docId: 'GW-2025-0001',
                docTitle: '关于组织开展2025年度工作总结的通知',
                fromUserId: 'staff1',
                fromUserName: '陈科长',
                toUserId: null,
                toRole: ROLES.OFFICE,
                read: true,
                createdAt: new Date(now - 86400000 * 2).toISOString()
            },
            {
                id: 'msg_006',
                type: MESSAGE_TYPES.DOC_FEEDBACK,
                title: '公文已反馈',
                content: '《关于报送月度工作报表的通知》承办人已提交反馈',
                docId: 'GW-2025-0004',
                docTitle: '关于报送月度工作报表的通知',
                fromUserId: 'staff2',
                fromUserName: '刘干事',
                toUserId: null,
                toRole: ROLES.LEADER,
                read: false,
                createdAt: new Date(now - 86400000 * 1).toISOString()
            }
        ];

        this.save();
    }
}

const messageStore = new MessageStore();
messageStore.initMockMessages();

const IMPORT_BATCH_STORAGE_KEY = 'doc_flow_import_batches';

const IMPORT_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

const IMPORT_STATUS_LABELS = {
    [IMPORT_STATUS.PENDING]: '待导入',
    [IMPORT_STATUS.COMPLETED]: '已完成',
    [IMPORT_STATUS.FAILED]: '导入失败'
};

class ImportBatchStore {
    constructor() {
        this.batches = [];
        this.load();
    }

    load() {
        const data = localStorage.getItem(IMPORT_BATCH_STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.batches = parsed.batches || [];
            } catch (e) {
                this.batches = [];
            }
        }
    }

    save() {
        localStorage.setItem(IMPORT_BATCH_STORAGE_KEY, JSON.stringify({
            batches: this.batches
        }));
    }

    generateBatchId() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const count = this.batches.filter(b =>
            b.id.startsWith(`IMP-${year}${month}${day}`)
        ).length + 1;
        return `IMP-${year}${month}${day}-${String(count).padStart(3, '0')}`;
    }

    createBatch(batchData, creator) {
        const now = new Date().toISOString();
        const batch = {
            id: this.generateBatchId(),
            fileName: batchData.fileName,
            fileType: batchData.fileType,
            totalCount: batchData.totalCount || 0,
            successCount: 0,
            failCount: 0,
            status: IMPORT_STATUS.PENDING,
            items: batchData.items || [],
            errors: [],
            createdAt: now,
            createdBy: creator.id,
            createdByName: creator.name
        };
        this.batches.unshift(batch);
        this.save();
        return batch;
    }

    getBatch(id) {
        return this.batches.find(b => b.id === id);
    }

    listBatches(filters = {}) {
        let result = [...this.batches];

        if (filters.keyword) {
            const kw = filters.keyword.toLowerCase();
            result = result.filter(b =>
                b.id.toLowerCase().includes(kw) ||
                b.fileName.toLowerCase().includes(kw)
            );
        }

        if (filters.status) {
            result = result.filter(b => b.status === filters.status);
        }

        return result;
    }

    updateBatchStatus(batchId, status, successCount, failCount, errors = []) {
        const batch = this.getBatch(batchId);
        if (!batch) return null;

        batch.status = status;
        batch.successCount = successCount;
        batch.failCount = failCount;
        batch.errors = errors;
        this.save();
        return batch;
    }

    batchCreateDocs(batchId, creator) {
        const batch = this.getBatch(batchId);
        if (!batch) return { success: 0, failed: 0, errors: [] };

        const validItems = batch.items.filter(item => item.valid);
        const errors = [];
        let successCount = 0;

        validItems.forEach((item, index) => {
            try {
                const docData = {
                    title: item.data.title,
                    fromUnit: item.data.fromUnit,
                    docNumber: item.data.docNumber || '',
                    docDate: item.data.docDate || '',
                    priority: item.data.priority || 'normal',
                    category: item.data.category || '',
                    content: item.data.content || ''
                };
                const doc = dataStore.createDoc(docData, creator);
                item.docId = doc.id;
                successCount++;
            } catch (e) {
                errors.push({
                    row: index + 1,
                    message: '创建公文失败：' + e.message
                });
            }
        });

        const failCount = batch.items.filter(item => !item.valid).length + errors.length;
        const allErrors = [
            ...batch.items.filter(item => !item.valid).map(item => ({
                row: item.rowIndex,
                message: item.errors.join('；')
            })),
            ...errors
        ];

        this.updateBatchStatus(
            batchId,
            failCount === batch.items.length ? IMPORT_STATUS.FAILED : IMPORT_STATUS.COMPLETED,
            successCount,
            failCount,
            allErrors
        );

        return { success: successCount, failed: failCount, errors: allErrors };
    }

    checkDocNumberExists(docNumber) {
        if (!docNumber || docNumber.trim() === '') return false;
        return dataStore.docs.some(d => d.docNumber === docNumber);
    }

    validateImportItem(itemData, rowIndex, existingDocNumbers = new Set()) {
        const errors = [];
        const title = itemData.title == null ? '' : String(itemData.title).trim();
        const fromUnit = itemData.fromUnit == null ? '' : String(itemData.fromUnit).trim();
        const docDate = itemData.docDate == null ? '' : String(itemData.docDate).trim();
        const priority = itemData.priority == null ? '' : String(itemData.priority).trim();
        const docNumber = itemData.docNumber == null ? '' : String(itemData.docNumber).trim();

        itemData.title = title;
        itemData.fromUnit = fromUnit;
        itemData.docDate = docDate;
        itemData.docNumber = docNumber;

        if (title === '') {
            errors.push('标题不能为空');
        }

        if (fromUnit === '') {
            errors.push('来文单位不能为空');
        }

        if (docDate === '') {
            errors.push('来文日期不能为空');
        } else {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(docDate)) {
                errors.push('来文日期格式不正确，应为 YYYY-MM-DD');
            } else {
                const d = new Date(docDate);
                if (isNaN(d.getTime())) {
                    errors.push('来文日期无效');
                }
            }
        }

        const validPriorities = ['normal', 'high', 'urgent'];
        if (priority === '') {
            errors.push('紧急程度不能为空');
        } else if (!validPriorities.includes(priority)) {
            const priorityMap = {
                '普通': 'normal',
                '加急': 'high',
                '特急': 'urgent',
                '一般': 'normal',
                '紧急': 'urgent'
            };
            if (priorityMap[priority]) {
                itemData.priority = priorityMap[priority];
            } else {
                errors.push('紧急程度不正确，应为普通/加急/特急');
            }
        } else {
            itemData.priority = priority;
        }

        if (docNumber !== '') {
            if (this.checkDocNumberExists(docNumber)) {
                errors.push('来文字号已存在，重复');
            }
            if (existingDocNumbers.has(docNumber)) {
                errors.push('导入文件内来文字号重复');
            }
            existingDocNumbers.add(docNumber);
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            data: itemData,
            rowIndex: rowIndex,
            docId: null
        };
    }
}

const importBatchStore = new ImportBatchStore();
