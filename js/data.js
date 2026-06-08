const STORAGE_KEY = 'doc_flow_system';
const DRAFT_STORAGE_KEY = 'doc_flow_drafts';

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
    COMPLETED: 'completed',
    RETURNED: 'returned'
};

const RETURN_TYPES = {
    RETURN: 'return',
    RESUBMIT: 'resubmit'
};

const RETURN_TYPE_LABELS = {
    [RETURN_TYPES.RETURN]: '退回',
    [RETURN_TYPES.RESUBMIT]: '重提'
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

const USER_STORAGE_KEY = 'doc_flow_users';

class UserStore {
    constructor() {
        this.departments = [];
        this.users = [];
        this.load();
    }

    load() {
        const data = localStorage.getItem(USER_STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.departments = parsed.departments || [];
                this.users = parsed.users || [];
                this.migrateData();
            } catch (e) {
                this.departments = [];
                this.users = [];
            }
        }
        if (this.departments.length === 0 && this.users.length === 0) {
            this.migrateFromDefaults();
        }
    }

    migrateData() {
        let changed = false;
        this.users.forEach(user => {
            if (user.role === undefined) {
                user.role = this.inferRole(user);
                changed = true;
            }
            if (user.active === undefined) {
                user.active = true;
                changed = true;
            }
        });
        if (changed) {
            this.save();
        }
    }

    inferRole(user) {
        if (!user.dept) return ROLES.STAFF;
        if (user.dept === '办公室') return ROLES.OFFICE;
        if (user.dept === '局领导') return ROLES.LEADER;
        return ROLES.STAFF;
    }

    migrateFromDefaults() {
        const allDepts = new Set(DEPARTMENTS);
        Object.entries(USERS).forEach(([role, users]) => {
            users.forEach(user => {
                if (user.dept) allDepts.add(user.dept);
            });
        });
        this.departments = [...allDepts];
        this.users = [];
        Object.entries(USERS).forEach(([role, users]) => {
            users.forEach(user => {
                this.users.push({
                    id: user.id,
                    name: user.name,
                    dept: user.dept,
                    role: role,
                    active: true
                });
            });
        });
        this.save();
    }

    save() {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
            departments: this.departments,
            users: this.users
        }));
    }

    getDepartments() {
        return [...this.departments];
    }

    getStaffDepartments() {
        return this.departments.filter(d => d !== '局领导' && d !== '办公室');
    }

    addDepartment(name) {
        if (!name || !name.trim()) {
            return { success: false, error: '科室名称不能为空' };
        }
        name = name.trim();
        if (this.departments.includes(name)) {
            return { success: false, error: '科室名称已存在' };
        }
        this.departments.push(name);
        this.save();
        return { success: true };
    }

    updateDepartment(oldName, newName) {
        if (!newName || !newName.trim()) {
            return { success: false, error: '科室名称不能为空' };
        }
        newName = newName.trim();
        if (oldName === newName) return { success: true };
        if (this.departments.includes(newName)) {
            return { success: false, error: '科室名称已存在' };
        }
        const idx = this.departments.indexOf(oldName);
        if (idx === -1) {
            return { success: false, error: '科室不存在' };
        }
        this.departments[idx] = newName;
        this.users.forEach(user => {
            if (user.dept === oldName) {
                user.dept = newName;
            }
        });
        this.save();
        return { success: true };
    }

    deleteDepartment(name) {
        const idx = this.departments.indexOf(name);
        if (idx === -1) {
            return { success: false, error: '科室不存在' };
        }
        const deptUsers = this.users.filter(u => u.dept === name && u.active);
        if (deptUsers.length > 0) {
            return { success: false, error: '该科室下还有在职人员，无法删除' };
        }
        this.departments.splice(idx, 1);
        this.save();
        return { success: true };
    }

    getUsersByRole(role) {
        return this.users.filter(u => u.role === role && u.active);
    }

    getUsersByDept(dept) {
        return this.users.filter(u => u.dept === dept && u.active);
    }

    getAllUsers() {
        return this.users.filter(u => u.active);
    }

    getAllUsersWithInactive() {
        return [...this.users];
    }

    getUserById(id) {
        return this.users.find(u => u.id === id) || null;
    }

    getUserDisplay(userId, fallbackName = '') {
        const user = this.getUserById(userId);
        if (user) {
            return user.name;
        }
        return fallbackName || userId || '-';
    }

    generateUserId(role) {
        const prefix = role || 'user';
        const existing = this.users.filter(u => u.id.startsWith(prefix));
        const maxNum = existing.reduce((max, u) => {
            const num = parseInt(u.id.replace(prefix, ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        return `${prefix}${maxNum + 1}`;
    }

    addUser(userData) {
        const { name, dept, role } = userData;
        if (!name || !name.trim()) {
            return { success: false, error: '姓名不能为空' };
        }
        if (!dept) {
            return { success: false, error: '请选择科室' };
        }
        if (!role) {
            return { success: false, error: '请选择角色' };
        }
        if (!this.departments.includes(dept)) {
            return { success: false, error: '科室不存在' };
        }
        const id = this.generateUserId(role);
        const user = {
            id: id,
            name: name.trim(),
            dept: dept,
            role: role,
            active: true
        };
        this.users.push(user);
        this.save();
        return { success: true, user };
    }

    updateUser(userId, userData) {
        const user = this.getUserById(userId);
        if (!user) {
            return { success: false, error: '用户不存在' };
        }
        if (userData.name !== undefined) {
            if (!userData.name.trim()) {
                return { success: false, error: '姓名不能为空' };
            }
            user.name = userData.name.trim();
        }
        if (userData.dept !== undefined) {
            if (!this.departments.includes(userData.dept)) {
                return { success: false, error: '科室不存在' };
            }
            user.dept = userData.dept;
        }
        if (userData.role !== undefined) {
            user.role = userData.role;
        }
        this.save();
        return { success: true, user };
    }

    deleteUser(userId) {
        const user = this.getUserById(userId);
        if (!user) {
            return { success: false, error: '用户不存在' };
        }
        user.active = false;
        this.save();
        return { success: true };
    }

    restoreUser(userId) {
        const user = this.getUserById(userId);
        if (!user) {
            return { success: false, error: '用户不存在' };
        }
        user.active = true;
        this.save();
        return { success: true };
    }

    initMockData() {
        if (this.users.length > 0 || this.departments.length > 0) return;
        this.migrateFromDefaults();
    }
}

const userStore = new UserStore();
userStore.initMockData();

const DOC_CATEGORIES = ['通知', '请示', '报告', '批复', '函', '会议纪要', '意见', '其他'];

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

const TRANSFER_TYPES = {
    DOC: 'doc',
    DRAFT: 'draft',
    MESSAGE: 'message'
};

const TRANSFER_TYPE_LABELS = {
    [TRANSFER_TYPES.DOC]: '未完成公文',
    [TRANSFER_TYPES.DRAFT]: '草稿',
    [TRANSFER_TYPES.MESSAGE]: '未读消息'
};

const FILE_TYPES = {
    DOC: 'doc',
    XLS: 'xls',
    PPT: 'ppt',
    PDF: 'pdf',
    IMAGE: 'image',
    ZIP: 'zip',
    OTHER: 'other'
};

const FILE_TYPE_LABELS = {
    [FILE_TYPES.DOC]: '文档',
    [FILE_TYPES.XLS]: '表格',
    [FILE_TYPES.PPT]: '演示',
    [FILE_TYPES.PDF]: 'PDF',
    [FILE_TYPES.IMAGE]: '图片',
    [FILE_TYPES.ZIP]: '压缩包',
    [FILE_TYPES.OTHER]: '其他'
};

const FILE_TYPE_EXTENSIONS = {
    [FILE_TYPES.DOC]: ['doc', 'docx', 'wps', 'txt', 'rtf'],
    [FILE_TYPES.XLS]: ['xls', 'xlsx', 'csv'],
    [FILE_TYPES.PPT]: ['ppt', 'pptx'],
    [FILE_TYPES.PDF]: ['pdf'],
    [FILE_TYPES.IMAGE]: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'],
    [FILE_TYPES.ZIP]: ['zip', 'rar', '7z', 'tar', 'gz']
};

const ATTACHMENT_CATEGORIES = {
    MAIN: 'main',
    INSTRUCTION: 'instruction',
    REFERENCE: 'reference',
    OTHER: 'other'
};

const ATTACHMENT_CATEGORY_LABELS = {
    [ATTACHMENT_CATEGORIES.MAIN]: '正文',
    [ATTACHMENT_CATEGORIES.INSTRUCTION]: '批示件',
    [ATTACHMENT_CATEGORIES.REFERENCE]: '参考材料',
    [ATTACHMENT_CATEGORIES.OTHER]: '其他'
};

const ATTACHMENT_CATEGORY_COLORS = {
    [ATTACHMENT_CATEGORIES.MAIN]: '#c41e3a',
    [ATTACHMENT_CATEGORIES.INSTRUCTION]: '#fa8c16',
    [ATTACHMENT_CATEGORIES.REFERENCE]: '#1890ff',
    [ATTACHMENT_CATEGORIES.OTHER]: '#8c8c8c'
};

function getAttachmentCategoryLabel(category) {
    return ATTACHMENT_CATEGORY_LABELS[category] || '未分类';
}

function getFileType(fileName) {
    if (!fileName) return FILE_TYPES.OTHER;
    const ext = fileName.split('.').pop().toLowerCase();
    for (const [type, exts] of Object.entries(FILE_TYPE_EXTENSIONS)) {
        if (exts.includes(ext)) {
            return type;
        }
    }
    return FILE_TYPES.OTHER;
}

function getFileTypeLabel(fileName) {
    return FILE_TYPE_LABELS[getFileType(fileName)] || FILE_TYPE_LABELS[FILE_TYPES.OTHER];
}

function getFileIcon(fileName) {
    const type = getFileType(fileName);
    const icons = {
        [FILE_TYPES.DOC]: '📄',
        [FILE_TYPES.XLS]: '📊',
        [FILE_TYPES.PPT]: '📽️',
        [FILE_TYPES.PDF]: '📕',
        [FILE_TYPES.IMAGE]: '🖼️',
        [FILE_TYPES.ZIP]: '📦',
        [FILE_TYPES.OTHER]: '📎'
    };
    return icons[type] || '📎';
}

function extractDocAttachments(doc) {
    const attachments = [];
    if (!doc || !doc.flowRecords) return attachments;

    doc.flowRecords.forEach((record, recordIndex) => {
        if (record.attachments && record.attachments.length > 0) {
            record.attachments.forEach((att, attIndex) => {
                attachments.push({
                    id: `${doc.id}_${record.id}_${attIndex}`,
                    docId: doc.id,
                    docTitle: doc.title,
                    fileName: att.name,
                    fileSize: att.size,
                    fileType: getFileType(att.name),
                    fileTypeLabel: getFileTypeLabel(att.name),
                    fileIcon: getFileIcon(att.name),
                    category: att.category || ATTACHMENT_CATEGORIES.OTHER,
                    categoryLabel: getAttachmentCategoryLabel(att.category),
                    remark: att.remark || '',
                    node: record.node,
                    nodeLabel: NODE_LABELS[record.node] || record.node,
                    uploaderId: record.operatorId,
                    uploaderName: record.operatorName,
                    uploaderDept: record.operatorDept,
                    uploadTime: record.time,
                    recordId: record.id,
                    isReturn: record.isReturn || false,
                    isResubmit: record.isResubmit || false,
                    handleType: record.handleType || null,
                    handleDept: record.handleDept || null
                });
            });
        }
    });

    return attachments;
}

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
    if (doc.isReturned) {
        return '已退回';
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
    if (doc.isReturned) {
        return 'status-returned';
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
        this.drafts = [];
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

        const draftData = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (draftData) {
            try {
                const parsed = JSON.parse(draftData);
                this.drafts = parsed.drafts || [];
            } catch (e) {
                this.drafts = [];
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

            if (doc.transferRecords === undefined) {
                doc.transferRecords = [];
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

            if (doc.returnRecords === undefined) {
                doc.returnRecords = [];
                changed = true;
            }

            if (doc.isReturned === undefined) {
                doc.isReturned = false;
                changed = true;
            }

            if (doc.flowRecords) {
                doc.flowRecords.forEach((record, idx) => {
                    if (!record.id) {
                        record.id = `rec_${doc.id}_${idx}_${record.node}`;
                        changed = true;
                    }
                    if (record.attachments && record.attachments.length > 0) {
                        record.attachments.forEach(att => {
                            if (att.category === undefined) {
                                att.category = ATTACHMENT_CATEGORIES.OTHER;
                                changed = true;
                            }
                            if (att.remark === undefined) {
                                att.remark = '';
                                changed = true;
                            }
                        });
                    }
                });
            }

            if (doc.handleRecords && doc.handleRecords.length > 0) {
                doc.handleRecords.forEach(hr => {
                    if (hr.attachments && hr.attachments.length > 0) {
                        hr.attachments.forEach(att => {
                            if (att.category === undefined) {
                                att.category = ATTACHMENT_CATEGORIES.OTHER;
                                changed = true;
                            }
                            if (att.remark === undefined) {
                                att.remark = '';
                                changed = true;
                            }
                        });
                    }
                });
            }
        });
        if (changed) {
            this.save();
        }

        this.migrateDrafts();
    }

    migrateDrafts() {
        let changed = false;
        this.drafts.forEach(draft => {
            if (draft.attachments === undefined) {
                draft.attachments = [];
                changed = true;
            }
            if (draft.attachments && draft.attachments.length > 0) {
                draft.attachments.forEach(att => {
                    if (att.category === undefined) {
                        att.category = ATTACHMENT_CATEGORIES.OTHER;
                        changed = true;
                    }
                    if (att.remark === undefined) {
                        att.remark = '';
                        changed = true;
                    }
                });
            }
            if (draft.priority === undefined) {
                draft.priority = 'normal';
                changed = true;
            }
            if (draft.category === undefined) {
                draft.category = '';
                changed = true;
            }
            if (draft.content === undefined) {
                draft.content = '';
                changed = true;
            }
            if (draft.createdBy === undefined && draft.creatorId) {
                draft.createdBy = draft.creatorId;
                changed = true;
            }
            if (draft.createdByName === undefined && draft.creatorName) {
                draft.createdByName = draft.creatorName;
                changed = true;
            }
            if (draft.createdAt === undefined) {
                draft.createdAt = draft.updatedAt || new Date().toISOString();
                changed = true;
            }
            if (draft.status === undefined) {
                draft.status = 'draft';
                changed = true;
            }
            if (draft.transferRecords === undefined) {
                draft.transferRecords = [];
                changed = true;
            }
        });
        if (changed) {
            this.saveDrafts();
        }
    }

    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            docs: this.docs
        }));
    }

    saveDrafts() {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
            drafts: this.drafts
        }));
    }

    generateDraftId() {
        return 'draft_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    }

    generateDocId() {
        const now = new Date();
        const year = now.getFullYear();
        const count = this.docs.filter(d => d.id.startsWith(`GW-${year}-`)).length + 1;
        return `GW-${year}-${String(count).padStart(4, '0')}`;
    }

    generateRecordId(docId) {
        return `rec_${docId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    createDoc(docData, creator) {
        const now = new Date().toISOString();
        const docId = this.generateDocId();
        const doc = {
            id: docId,
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
            returnRecords: [],
            isReturned: false,
            flowRecords: [{
                id: this.generateRecordId(docId),
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

        if (filters.priority) {
            result = result.filter(d => d.priority === filters.priority);
        }

        if (filters.category) {
            if (filters.category === '__none__') {
                result = result.filter(d => !d.category || d.category === '');
            } else if (filters.category === '其他') {
                result = result.filter(d => d.category && d.category !== '' && !DOC_CATEGORIES.slice(0, -1).includes(d.category));
            } else {
                result = result.filter(d => d.category === filters.category);
            }
        }

        if (filters.startDate) {
            result = result.filter(d => {
                if (!d.createdAt) return false;
                return new Date(d.createdAt) >= new Date(filters.startDate + 'T00:00:00');
            });
        }

        if (filters.endDate) {
            result = result.filter(d => {
                if (!d.createdAt) return false;
                return new Date(d.createdAt) <= new Date(filters.endDate + 'T23:59:59');
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
            if (filters.category === '__none__') {
                result = result.filter(d => !d.category || d.category === '');
            } else if (filters.category === '其他') {
                result = result.filter(d => d.category && d.category !== '' && !DOC_CATEGORIES.slice(0, -1).includes(d.category));
            } else {
                result = result.filter(d => d.category === filters.category);
            }
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
            id: this.generateRecordId(docId),
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

        if (isMulti) {
            const coUserIds = coHandlers.map(c => c.userId);
            if (new Set(coUserIds).size !== coUserIds.length) {
                return null;
            }
            if (coUserIds.includes(mainUserId)) {
                return null;
            }
        }

        doc.flowRecords.push({
            id: this.generateRecordId(docId),
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

        const isMain = handlerRecord.type === HANDLE_TYPES.MAIN;

        if (doc.isMultiDept && isMain) {
            return null;
        }

        const now = new Date().toISOString();

        handlerRecord.status = HANDLE_STATUS.COMPLETED;
        handlerRecord.comment = comment;
        handlerRecord.attachments = attachments || [];
        handlerRecord.submitTime = now;

        doc.flowRecords.push({
            id: this.generateRecordId(docId),
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

        const allCoCompleted = allCoHandlersCompleted(doc);

        if (doc.isMultiDept && allCoCompleted) {
            doc.currentNode = FLOW_NODES.FEEDBACK;
        } else if (!doc.isMultiDept) {
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
                if (allCoCompleted && doc.isMultiDept) {
                    messageStore.createMessage({
                        type: MESSAGE_TYPES.DOC_HANDLED,
                        title: '所有协办已完成',
                        content: `《${doc.title}》所有协办科室均已提交意见，请您提交最终反馈`,
                        docId: doc.id,
                        docTitle: doc.title,
                        fromUserId: operator.id,
                        fromUserName: operator.name,
                        toUserId: mainHandler.userId
                    });
                } else {
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
        const isResubmit = doc.isReturned;

        if (doc.isMultiDept) {
            const mainHandler = getMainHandler(doc);
            if (mainHandler) {
                mainHandler.status = HANDLE_STATUS.COMPLETED;
                mainHandler.comment = comment;
                mainHandler.attachments = attachments || [];
                mainHandler.submitTime = now;
            }
        }

        const flowRecord = {
            id: this.generateRecordId(docId),
            node: FLOW_NODES.FEEDBACK,
            status: NODE_STATUS.COMPLETED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: comment,
            attachments: attachments || []
        };

        if (isResubmit) {
            flowRecord.isResubmit = true;
            flowRecord.resubmitToNode = FLOW_NODES.COMPLETE;

            const resubmitRecord = {
                id: 'ret_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: RETURN_TYPES.RESUBMIT,
                fromNode: FLOW_NODES.FEEDBACK,
                toNode: FLOW_NODES.COMPLETE,
                reason: comment,
                operatorId: operator.id,
                operatorName: operator.name,
                operatorDept: operator.dept,
                time: now
            };

            doc.returnRecords = doc.returnRecords || [];
            doc.returnRecords.push(resubmitRecord);

            doc.isReturned = false;
        }

        doc.flowRecords.push(flowRecord);

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
            id: this.generateRecordId(docId),
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
                if (doc.currentNode === FLOW_NODES.REGISTER && doc.isReturned) {
                    stats.myPending++;
                }
            } else if (role === ROLES.LEADER) {
                if (doc.currentNode === FLOW_NODES.PROPOSE || doc.currentNode === FLOW_NODES.ASSIGN) {
                    stats.myPending++;
                }
            } else if (role === ROLES.STAFF && user) {
                if (this.canOperate(doc, role, user) || this.canResubmit(doc, role, user)) {
                    stats.myPending++;
                }
            }
        });

        return stats;
    }

    getAnalyticsStats() {
        const stats = {
            total: this.docs.length,
            statusDistribution: {},
            deptDistribution: {},
            priorityDistribution: {},
            categoryDistribution: {},
            last30Days: [],
            avgHandleDays: 0,
            completedCount: 0
        };

        Object.values(FLOW_NODES).forEach(node => {
            stats.statusDistribution[node] = 0;
        });

        userStore.getDepartments().forEach(dept => {
            stats.deptDistribution[dept] = 0;
        });

        Object.keys(PRIORITY_LABELS).forEach(p => {
            stats.priorityDistribution[p] = 0;
        });

        DOC_CATEGORIES.forEach(c => {
            stats.categoryDistribution[c] = 0;
        });
        stats.categoryDistribution['未分类'] = 0;

        const now = new Date();
        const last30DaysMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            last30DaysMap[dateStr] = 0;
        }

        let totalHandleDays = 0;
        let completedCount = 0;

        this.docs.forEach(doc => {
            stats.statusDistribution[doc.currentNode] = (stats.statusDistribution[doc.currentNode] || 0) + 1;

            if (doc.assignedDept) {
                stats.deptDistribution[doc.assignedDept] = (stats.deptDistribution[doc.assignedDept] || 0) + 1;
            }
            if (doc.isMultiDept && doc.handleRecords) {
                doc.handleRecords.forEach(hr => {
                    if (hr.dept && hr.dept !== doc.assignedDept) {
                        stats.deptDistribution[hr.dept] = (stats.deptDistribution[hr.dept] || 0) + 1;
                    }
                });
            }

            stats.priorityDistribution[doc.priority] = (stats.priorityDistribution[doc.priority] || 0) + 1;

            if (doc.category && stats.categoryDistribution.hasOwnProperty(doc.category)) {
                stats.categoryDistribution[doc.category]++;
            } else if (!doc.category) {
                stats.categoryDistribution['未分类']++;
            } else {
                stats.categoryDistribution['其他']++;
            }

            const createDate = doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : null;
            if (createDate && last30DaysMap.hasOwnProperty(createDate)) {
                last30DaysMap[createDate]++;
            }

            if (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived) {
                const registerRecord = doc.flowRecords.find(r => r.node === FLOW_NODES.REGISTER);
                const completeRecord = doc.flowRecords.find(r => r.node === FLOW_NODES.COMPLETE);
                if (registerRecord && completeRecord && registerRecord.time && completeRecord.time) {
                    const startTime = new Date(registerRecord.time).getTime();
                    const endTime = new Date(completeRecord.time).getTime();
                    const days = Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));
                    totalHandleDays += days;
                    completedCount++;
                }
            }
        });

        stats.last30Days = Object.entries(last30DaysMap).map(([date, count]) => ({
            date,
            count
        }));

        stats.completedCount = completedCount;
        stats.avgHandleDays = completedCount > 0 ? Math.round((totalHandleDays / completedCount) * 10) / 10 : 0;

        return stats;
    }

    listAttachments(filters = {}) {
        let allAttachments = [];

        this.docs.forEach(doc => {
            const docAttachments = extractDocAttachments(doc);
            allAttachments = allAttachments.concat(docAttachments);
        });

        if (filters.keyword) {
            const kw = filters.keyword.toLowerCase();
            allAttachments = allAttachments.filter(a =>
                a.fileName.toLowerCase().includes(kw) ||
                a.docTitle.toLowerCase().includes(kw) ||
                a.docId.toLowerCase().includes(kw)
            );
        }

        if (filters.docId) {
            allAttachments = allAttachments.filter(a => a.docId === filters.docId);
        }

        if (filters.node) {
            allAttachments = allAttachments.filter(a => a.node === filters.node);
        }

        if (filters.uploaderId) {
            allAttachments = allAttachments.filter(a => a.uploaderId === filters.uploaderId);
        }

        if (filters.uploaderDept) {
            allAttachments = allAttachments.filter(a => a.uploaderDept === filters.uploaderDept);
        }

        if (filters.fileType) {
            allAttachments = allAttachments.filter(a => a.fileType === filters.fileType);
        }

        if (filters.category) {
            allAttachments = allAttachments.filter(a => a.category === filters.category);
        }

        if (filters.startDate) {
            allAttachments = allAttachments.filter(a => {
                if (!a.uploadTime) return false;
                return new Date(a.uploadTime) >= new Date(filters.startDate + 'T00:00:00');
            });
        }

        if (filters.endDate) {
            allAttachments = allAttachments.filter(a => {
                if (!a.uploadTime) return false;
                return new Date(a.uploadTime) <= new Date(filters.endDate + 'T23:59:59');
            });
        }

        allAttachments.sort((a, b) => {
            const timeA = a.uploadTime ? new Date(a.uploadTime).getTime() : 0;
            const timeB = b.uploadTime ? new Date(b.uploadTime).getTime() : 0;
            return timeB - timeA;
        });

        return allAttachments;
    }

    getAttachmentStats() {
        const allAttachments = this.listAttachments();
        const stats = {
            total: allAttachments.length,
            byType: {},
            byCategory: {},
            byNode: {},
            byDept: {},
            last7Days: 0,
            last30Days: 0
        };

        Object.values(FILE_TYPES).forEach(type => {
            stats.byType[type] = 0;
        });

        Object.values(ATTACHMENT_CATEGORIES).forEach(cat => {
            stats.byCategory[cat] = 0;
        });

        Object.values(FLOW_NODES).forEach(node => {
            stats.byNode[node] = 0;
        });

        userStore.getDepartments().forEach(dept => {
            stats.byDept[dept] = 0;
        });

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

        allAttachments.forEach(att => {
            stats.byType[att.fileType] = (stats.byType[att.fileType] || 0) + 1;
            stats.byCategory[att.category] = (stats.byCategory[att.category] || 0) + 1;
            stats.byNode[att.node] = (stats.byNode[att.node] || 0) + 1;
            if (att.uploaderDept) {
                stats.byDept[att.uploaderDept] = (stats.byDept[att.uploaderDept] || 0) + 1;
            }

            if (att.uploadTime) {
                const uploadTime = new Date(att.uploadTime);
                if (uploadTime >= sevenDaysAgo) {
                    stats.last7Days++;
                }
                if (uploadTime >= thirtyDaysAgo) {
                    stats.last30Days++;
                }
            }
        });

        return stats;
    }

    canReturn(doc, role, user) {
        if (!doc || !user || doc.archived || doc.isReturned) return false;

        if (role === ROLES.LEADER) {
            return doc.currentNode === FLOW_NODES.PROPOSE || doc.currentNode === FLOW_NODES.ASSIGN;
        }

        if (role === ROLES.OFFICE) {
            return doc.currentNode === FLOW_NODES.COMPLETE && !doc.archived;
        }

        return false;
    }

    canResubmit(doc, role, user) {
        if (!doc || !user || !doc.isReturned) return false;

        if (role === ROLES.OFFICE) {
            return doc.currentNode === FLOW_NODES.REGISTER;
        }

        if (role === ROLES.STAFF) {
            if (doc.currentNode === FLOW_NODES.FEEDBACK) {
                if (doc.isMultiDept) {
                    return isMainHandler(doc, user.id);
                }
                return doc.assignedUser === user.id;
            }
        }

        return false;
    }

    returnDoc(docId, reason, operator, role) {
        const doc = this.getDoc(docId);
        if (!doc || !this.canReturn(doc, role, operator)) return null;

        const now = new Date().toISOString();
        const fromNode = doc.currentNode;
        let toNode = null;

        if (doc.currentNode === FLOW_NODES.PROPOSE || doc.currentNode === FLOW_NODES.ASSIGN) {
            toNode = FLOW_NODES.REGISTER;
        } else if (doc.currentNode === FLOW_NODES.COMPLETE) {
            toNode = FLOW_NODES.FEEDBACK;
        }

        if (!toNode) return null;

        const returnRecord = {
            id: 'ret_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: RETURN_TYPES.RETURN,
            fromNode: fromNode,
            toNode: toNode,
            reason: reason,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now
        };

        doc.returnRecords = doc.returnRecords || [];
        doc.returnRecords.push(returnRecord);

        doc.flowRecords.push({
            id: this.generateRecordId(docId),
            node: fromNode,
            status: NODE_STATUS.RETURNED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: reason,
            attachments: [],
            isReturn: true,
            returnToNode: toNode
        });

        doc.currentNode = toNode;
        doc.isReturned = true;

        this.save();

        if (toNode === FLOW_NODES.REGISTER) {
            messageStore.createMessage({
                type: MESSAGE_TYPES.DOC_RETURNED,
                title: '公文被退回',
                content: `《${doc.title}》被退回，请补充登记后重提`,
                docId: doc.id,
                docTitle: doc.title,
                fromUserId: operator.id,
                fromUserName: operator.name,
                toRole: ROLES.OFFICE
            });
        } else if (toNode === FLOW_NODES.FEEDBACK) {
            const handlerUserIds = getAllHandlerUserIds(doc);
            handlerUserIds.forEach(userId => {
                messageStore.createMessage({
                    type: MESSAGE_TYPES.DOC_RETURNED,
                    title: '公文被退回',
                    content: `《${doc.title}》被退回，请补充反馈后重提`,
                    docId: doc.id,
                    docTitle: doc.title,
                    fromUserId: operator.id,
                    fromUserName: operator.name,
                    toUserId: userId
                });
            });
            if (doc.assignedUser && !handlerUserIds.includes(doc.assignedUser)) {
                messageStore.createMessage({
                    type: MESSAGE_TYPES.DOC_RETURNED,
                    title: '公文被退回',
                    content: `《${doc.title}》被退回，请补充反馈后重提`,
                    docId: doc.id,
                    docTitle: doc.title,
                    fromUserId: operator.id,
                    fromUserName: operator.name,
                    toUserId: doc.assignedUser
                });
            }
        }

        return doc;
    }

    resubmitRegisterDoc(docId, docData, operator, role) {
        const doc = this.getDoc(docId);
        if (!doc || !this.canResubmit(doc, role, operator)) return null;
        if (doc.currentNode !== FLOW_NODES.REGISTER) return null;

        const now = new Date().toISOString();
        const fromNode = doc.currentNode;
        const toNode = FLOW_NODES.PROPOSE;

        if (docData.title !== undefined) doc.title = docData.title;
        if (docData.fromUnit !== undefined) doc.fromUnit = docData.fromUnit;
        if (docData.docNumber !== undefined) doc.docNumber = docData.docNumber;
        if (docData.docDate !== undefined) doc.docDate = docData.docDate;
        if (docData.priority !== undefined) doc.priority = docData.priority;
        if (docData.category !== undefined) doc.category = docData.category;
        if (docData.content !== undefined) doc.content = docData.content;

        const resubmitRecord = {
            id: 'ret_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: RETURN_TYPES.RESUBMIT,
            fromNode: fromNode,
            toNode: toNode,
            reason: docData.comment || '补充登记后重提',
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now
        };

        doc.returnRecords = doc.returnRecords || [];
        doc.returnRecords.push(resubmitRecord);

        doc.flowRecords.push({
            id: this.generateRecordId(docId),
            node: fromNode,
            status: NODE_STATUS.COMPLETED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: docData.comment || '补充登记后重提',
            attachments: docData.attachments || [],
            isResubmit: true,
            resubmitToNode: toNode
        });

        doc.currentNode = toNode;
        doc.isReturned = false;

        this.save();

        messageStore.createMessage({
            type: MESSAGE_TYPES.DOC_RESUBMITTED,
            title: '公文已重提',
            content: `《${doc.title}》已补充登记并重提，请批示`,
            docId: doc.id,
            docTitle: doc.title,
            fromUserId: operator.id,
            fromUserName: operator.name,
            toRole: ROLES.LEADER
        });

        return doc;
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
                if (!handleRecord || handleRecord.status !== HANDLE_STATUS.PENDING) {
                    return false;
                }
                if (doc.isMultiDept && handleRecord.type === HANDLE_TYPES.MAIN) {
                    return false;
                }
                return true;
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

    getPendingDocsForUser(userId) {
        return this.docs.filter(doc => {
            if (!doc || (doc.currentNode === FLOW_NODES.COMPLETE && doc.archived)) {
                return false;
            }
            if (doc.currentNode === FLOW_NODES.REGISTER && doc.isReturned && doc.createdBy === userId) {
                return true;
            }
            if ((doc.currentNode === FLOW_NODES.PROPOSE || doc.currentNode === FLOW_NODES.ASSIGN) &&
                doc.flowRecords &&
                doc.flowRecords.some(r => r.operatorId === userId)) {
                return true;
            }
            if (doc.currentNode === FLOW_NODES.HANDLE || doc.currentNode === FLOW_NODES.FEEDBACK) {
                if (doc.currentNode === FLOW_NODES.FEEDBACK && doc.assignedUser === userId) {
                    return true;
                }
                return !!(doc.handleRecords || []).find(r => r.userId === userId && r.status === HANDLE_STATUS.PENDING);
            }
            if (doc.currentNode === FLOW_NODES.COMPLETE && !doc.archived && doc.createdBy === userId) {
                return true;
            }
            return false;
        });
    }

    getTransferSummary(userId) {
        const docs = this.getPendingDocsForUser(userId).map(doc => ({
            id: doc.id,
            title: doc.title,
            node: doc.currentNode,
            nodeLabel: getDocStatusLabel(doc),
            assignedDept: doc.assignedDept || '',
            assignedUserName: doc.assignedUserName || ''
        }));
        const drafts = this.drafts.filter(d => d.createdBy === userId).map(d => ({
            id: d.id,
            title: d.title || '（无标题）',
            updatedAt: d.updatedAt
        }));
        const unreadMessages = messageStore.getUnreadMessagesForUserId(userId).map(m => ({
            id: m.id,
            title: m.title,
            docTitle: m.docTitle || '',
            createdAt: m.createdAt
        }));

        return {
            docs,
            drafts,
            messages: unreadMessages,
            total: docs.length + drafts.length + unreadMessages.length
        };
    }

    getTransferReceivers(user) {
        if (!user) return [];
        return userStore.getAllUsers()
            .filter(candidate => {
                if (candidate.id === user.id) return false;
                if (candidate.role === user.role) return true;
                return candidate.dept === user.dept;
            })
            .map(candidate => ({
                id: candidate.id,
                name: candidate.name,
                dept: candidate.dept,
                role: candidate.role,
                roleLabel: ROLE_LABELS[candidate.role] || candidate.role,
                matchType: candidate.role === user.role ? '同角色' : '同科室'
            }));
    }

    transferUserWork(userId, receiverId, operator) {
        const fromUser = userStore.getUserById(userId);
        const toUser = userStore.getUserById(receiverId);
        if (!fromUser || !toUser) {
            return { success: false, error: '移交人员不存在' };
        }
        if (!toUser.active) {
            return { success: false, error: '接收人已停用' };
        }
        const validReceiver = this.getTransferReceivers(fromUser).some(u => u.id === receiverId);
        if (!validReceiver) {
            return { success: false, error: '接收人必须是同角色或同科室在职人员' };
        }

        const now = new Date().toISOString();
        const operatorInfo = operator || toUser;
        const recordBase = {
            id: 'tr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            fromUserId: fromUser.id,
            fromUserName: fromUser.name,
            fromUserDept: fromUser.dept,
            toUserId: toUser.id,
            toUserName: toUser.name,
            toUserDept: toUser.dept,
            operatorId: operatorInfo.id,
            operatorName: operatorInfo.name,
            time: now
        };

        let docCount = 0;
        this.getPendingDocsForUser(userId).forEach(doc => {
            doc.transferRecords = doc.transferRecords || [];
            const docRecord = {
                ...recordBase,
                id: recordBase.id + '_doc_' + doc.id,
                type: TRANSFER_TYPES.DOC,
                docId: doc.id,
                docTitle: doc.title,
                node: doc.currentNode,
                nodeLabel: getDocStatusLabel(doc)
            };

            if (doc.createdBy === fromUser.id &&
                ((doc.currentNode === FLOW_NODES.REGISTER && doc.isReturned) ||
                 (doc.currentNode === FLOW_NODES.COMPLETE && !doc.archived))) {
                doc.createdBy = toUser.id;
                doc.createdByName = toUser.name;
            }

            if (doc.assignedUser === fromUser.id) {
                doc.assignedUser = toUser.id;
                doc.assignedUserName = toUser.name;
                doc.assignedDept = toUser.dept;
            }

            (doc.handleRecords || []).forEach(hr => {
                if (hr.userId === fromUser.id && hr.status === HANDLE_STATUS.PENDING) {
                    hr.previousUserId = hr.previousUserId || fromUser.id;
                    hr.previousUserName = hr.previousUserName || fromUser.name;
                    hr.transferFromUserId = fromUser.id;
                    hr.transferFromUserName = fromUser.name;
                    hr.transferTime = now;
                    hr.userId = toUser.id;
                    hr.userName = toUser.name;
                    hr.dept = toUser.dept;
                }
            });

            doc.transferRecords.push(docRecord);
            docCount++;
        });

        let draftCount = 0;
        this.drafts.forEach(draft => {
            if (draft.createdBy !== fromUser.id) return;
            draft.transferRecords = draft.transferRecords || [];
            draft.transferRecords.push({
                ...recordBase,
                id: recordBase.id + '_draft_' + draft.id,
                type: TRANSFER_TYPES.DRAFT,
                draftId: draft.id,
                draftTitle: draft.title || '（无标题）'
            });
            draft.createdBy = toUser.id;
            draft.createdByName = toUser.name;
            draft.updatedAt = now;
            draftCount++;
        });

        const messageCount = messageStore.transferUnreadMessages(fromUser.id, toUser, recordBase);

        this.save();
        this.saveDrafts();

        return {
            success: true,
            counts: {
                docs: docCount,
                drafts: draftCount,
                messages: messageCount
            }
        };
    }

    createDraft(draftData, creator) {
        const now = new Date().toISOString();
        const draftId = this.generateDraftId();
        const draft = {
            id: draftId,
            title: draftData.title || '',
            fromUnit: draftData.fromUnit || '',
            docNumber: draftData.docNumber || '',
            docDate: draftData.docDate || '',
            priority: draftData.priority || 'normal',
            category: draftData.category || '',
            content: draftData.content || '',
            attachments: draftData.attachments || [],
            createdBy: creator.id,
            createdByName: creator.name,
            createdAt: now,
            updatedAt: now
        };
        this.drafts.unshift(draft);
        this.saveDrafts();
        return draft;
    }

    updateDraft(draftId, draftData, operator) {
        const draft = this.getDraft(draftId);
        if (!draft) return null;
        if (draft.createdBy !== operator.id) return null;

        const now = new Date().toISOString();
        if (draftData.title !== undefined) draft.title = draftData.title;
        if (draftData.fromUnit !== undefined) draft.fromUnit = draftData.fromUnit;
        if (draftData.docNumber !== undefined) draft.docNumber = draftData.docNumber;
        if (draftData.docDate !== undefined) draft.docDate = draftData.docDate;
        if (draftData.priority !== undefined) draft.priority = draftData.priority;
        if (draftData.category !== undefined) draft.category = draftData.category;
        if (draftData.content !== undefined) draft.content = draftData.content;
        if (draftData.attachments !== undefined) draft.attachments = draftData.attachments;
        draft.updatedAt = now;

        this.saveDrafts();
        return draft;
    }

    getDraft(draftId) {
        return this.drafts.find(d => d.id === draftId) || null;
    }

    listDrafts(filters = {}) {
        let result = [...this.drafts];

        if (filters.userId) {
            result = result.filter(d => d.createdBy === filters.userId);
        }

        if (filters.keyword) {
            const kw = filters.keyword.toLowerCase();
            result = result.filter(d =>
                d.title.toLowerCase().includes(kw) ||
                d.fromUnit.toLowerCase().includes(kw) ||
                (d.docNumber && d.docNumber.toLowerCase().includes(kw))
            );
        }

        if (filters.priority) {
            result = result.filter(d => d.priority === filters.priority);
        }

        if (filters.category) {
            result = result.filter(d => d.category === filters.category);
        }

        if (filters.dateFrom) {
            result = result.filter(d => new Date(d.updatedAt) >= new Date(filters.dateFrom));
        }

        if (filters.dateTo) {
            const dateTo = new Date(filters.dateTo);
            dateTo.setHours(23, 59, 59, 999);
            result = result.filter(d => new Date(d.updatedAt) <= dateTo);
        }

        if (filters.hasAttachments !== undefined) {
            if (filters.hasAttachments) {
                result = result.filter(d => d.attachments && d.attachments.length > 0);
            } else {
                result = result.filter(d => !d.attachments || d.attachments.length === 0);
            }
        }

        const sortField = filters.sortField || 'updatedAt';
        const sortOrder = filters.sortOrder || 'desc';
        result.sort((a, b) => {
            let valA, valB;
            switch (sortField) {
                case 'title':
                    valA = a.title || '';
                    valB = b.title || '';
                    break;
                case 'fromUnit':
                    valA = a.fromUnit || '';
                    valB = b.fromUnit || '';
                    break;
                case 'createdAt':
                    valA = new Date(a.createdAt).getTime();
                    valB = new Date(b.createdAt).getTime();
                    break;
                case 'updatedAt':
                default:
                    valA = new Date(a.updatedAt).getTime();
                    valB = new Date(b.updatedAt).getTime();
                    break;
            }
            if (typeof valA === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        });

        if (filters.page && filters.pageSize) {
            const start = (filters.page - 1) * filters.pageSize;
            const end = start + filters.pageSize;
            const total = result.length;
            result = result.slice(start, end);
            return { items: result, total: total, page: filters.page, pageSize: filters.pageSize };
        }

        return result;
    }

    deleteDraft(draftId, operator) {
        const draft = this.getDraft(draftId);
        if (!draft) return false;
        if (draft.createdBy !== operator.id) return false;

        const index = this.drafts.findIndex(d => d.id === draftId);
        if (index > -1) {
            this.drafts.splice(index, 1);
            this.saveDrafts();
            return true;
        }
        return false;
    }

    submitDraft(draftId, operator) {
        const draft = this.getDraft(draftId);
        if (!draft) return { success: false, error: '草稿不存在' };
        if (draft.createdBy !== operator.id) return { success: false, error: '无权操作此草稿' };

        if (!draft.title || !draft.title.trim()) {
            return { success: false, error: '公文标题不能为空，请补充后再提交' };
        }
        if (!draft.fromUnit || !draft.fromUnit.trim()) {
            return { success: false, error: '来文单位不能为空，请补充后再提交' };
        }

        const docData = {
            title: draft.title.trim(),
            fromUnit: draft.fromUnit.trim(),
            docNumber: draft.docNumber ? draft.docNumber.trim() : '',
            docDate: draft.docDate || '',
            priority: draft.priority || 'normal',
            category: draft.category || '',
            content: draft.content || '',
            attachments: draft.attachments || []
        };

        const doc = this.createDoc(docData, operator);

        if (doc && doc.flowRecords && doc.flowRecords.length > 0) {
            const registerRecord = doc.flowRecords.find(r => r.node === FLOW_NODES.REGISTER);
            if (registerRecord) {
                registerRecord.comment = '收文登记完成（由草稿提交）';
                registerRecord.fromDraft = true;
                registerRecord.draftId = draftId;
                registerRecord.draftCreatedAt = draft.createdAt;
                this.save();
            }
        }

        const index = this.drafts.findIndex(d => d.id === draftId);
        if (index > -1) {
            this.drafts.splice(index, 1);
            this.saveDrafts();
        }

        return { success: true, doc: doc, fromDraft: true };
    }

    getDraftStats(userId) {
        const userDrafts = this.drafts.filter(d => d.createdBy === userId);
        return {
            total: userDrafts.length
        };
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

        this.migrateData();
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
    SUPERVISION: 'supervision',
    DOC_RETURNED: 'doc_returned',
    DOC_RESUBMITTED: 'doc_resubmitted'
};

const MESSAGE_TYPE_LABELS = {
    [MESSAGE_TYPES.NEW_DOC_PROPOSE]: '待批示',
    [MESSAGE_TYPES.DOC_ASSIGNED]: '新交办',
    [MESSAGE_TYPES.DOC_HANDLED]: '办理中',
    [MESSAGE_TYPES.DOC_FEEDBACK]: '已反馈',
    [MESSAGE_TYPES.DOC_COMPLETED]: '待归档',
    [MESSAGE_TYPES.DOC_ARCHIVED]: '已归档',
    [MESSAGE_TYPES.SUPERVISION]: '督办',
    [MESSAGE_TYPES.DOC_RETURNED]: '已退回',
    [MESSAGE_TYPES.DOC_RESUBMITTED]: '已重提'
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
            transferRecords: messageData.transferRecords || [],
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

    getUnreadMessagesForUserId(userId) {
        return this.messages.filter(msg => msg.toUserId === userId && !msg.read);
    }

    transferUnreadMessages(fromUserId, toUser, transferBase) {
        let count = 0;
        this.messages.forEach(msg => {
            if (msg.toUserId !== fromUserId || msg.read) return;
            msg.transferRecords = msg.transferRecords || [];
            msg.transferRecords.push({
                ...transferBase,
                id: transferBase.id + '_msg_' + msg.id,
                type: TRANSFER_TYPES.MESSAGE,
                messageId: msg.id,
                messageTitle: msg.title,
                originalToUserId: fromUserId
            });
            msg.previousToUserId = msg.previousToUserId || fromUserId;
            msg.previousToUserName = msg.previousToUserName || transferBase.fromUserName;
            msg.toUserId = toUser.id;
            msg.toRole = null;
            count++;
        });
        if (count > 0) {
            this.save();
        }
        return count;
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

const FILTER_VIEW_STORAGE_KEY = 'doc_flow_filter_views';

const SUPPORTED_FILTER_FIELDS = ['keyword', 'status', 'assignedDept', 'priority'];

class FilterViewStore {
    constructor() {
        this.views = [];
        this.load();
    }

    load() {
        const data = localStorage.getItem(FILTER_VIEW_STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.views = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                this.views = [];
            }
        }
    }

    save() {
        localStorage.setItem(FILTER_VIEW_STORAGE_KEY, JSON.stringify(this.views));
    }

    generateId() {
        return 'view_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    }

    getViews() {
        return [...this.views];
    }

    getViewById(id) {
        return this.views.find(v => v.id === id) || null;
    }

    createView(name, filters) {
        if (!name || !name.trim()) {
            return { success: false, error: '视图名称不能为空' };
        }
        name = name.trim();
        if (this.views.some(v => v.name === name)) {
            return { success: false, error: '视图名称已存在' };
        }

        const filteredFilters = {};
        SUPPORTED_FILTER_FIELDS.forEach(field => {
            if (filters[field] !== undefined && filters[field] !== '' && filters[field] !== null) {
                filteredFilters[field] = filters[field];
            }
        });

        const view = {
            id: this.generateId(),
            name: name,
            filters: filteredFilters,
            createdAt: new Date().toISOString()
        };

        this.views.push(view);
        this.save();
        return { success: true, view };
    }

    deleteView(id) {
        const idx = this.views.findIndex(v => v.id === id);
        if (idx === -1) {
            return { success: false, error: '视图不存在' };
        }
        this.views.splice(idx, 1);
        this.save();
        return { success: true };
    }

    updateView(id, name, filters) {
        const view = this.getViewById(id);
        if (!view) {
            return { success: false, error: '视图不存在' };
        }

        if (name !== undefined) {
            name = name.trim();
            if (!name) {
                return { success: false, error: '视图名称不能为空' };
            }
            if (this.views.some(v => v.name === name && v.id !== id)) {
                return { success: false, error: '视图名称已存在' };
            }
            view.name = name;
        }

        if (filters !== undefined) {
            const filteredFilters = {};
            SUPPORTED_FILTER_FIELDS.forEach(field => {
                if (filters[field] !== undefined && filters[field] !== '' && filters[field] !== null) {
                    filteredFilters[field] = filters[field];
                }
            });
            view.filters = filteredFilters;
        }

        this.save();
        return { success: true, view };
    }
}

const filterViewStore = new FilterViewStore();
