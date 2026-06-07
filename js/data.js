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
            archived: false,
            createdAt: now,
            createdBy: creator.id,
            createdByName: creator.name,
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
            result = result.filter(d => d.assignedDept === filters.assignedDept);
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
            result = result.filter(d => d.assignedDept === filters.assignedDept);
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
        const doc = this.getDoc(docId);
        if (!doc || doc.currentNode !== FLOW_NODES.ASSIGN) return null;
        
        const now = new Date().toISOString();
        doc.flowRecords.push({
            node: FLOW_NODES.ASSIGN,
            status: NODE_STATUS.COMPLETED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: comment,
            attachments: [],
            assignedDept: dept,
            assignedUserId: userId,
            assignedUserName: userName
        });
        
        doc.assignedDept = dept;
        doc.assignedUser = userId;
        doc.assignedUserName = userName;
        doc.currentNode = FLOW_NODES.HANDLE;
        this.save();
        return doc;
    }

    handleDoc(docId, comment, attachments, operator) {
        const doc = this.getDoc(docId);
        if (!doc || doc.currentNode !== FLOW_NODES.HANDLE) return null;
        
        const now = new Date().toISOString();
        doc.flowRecords.push({
            node: FLOW_NODES.HANDLE,
            status: NODE_STATUS.COMPLETED,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorDept: operator.dept,
            time: now,
            comment: comment,
            attachments: attachments || []
        });
        
        doc.currentNode = FLOW_NODES.FEEDBACK;
        this.save();
        return doc;
    }

    feedbackDoc(docId, comment, attachments, operator) {
        const doc = this.getDoc(docId);
        if (!doc || doc.currentNode !== FLOW_NODES.FEEDBACK) return null;
        
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
        return doc;
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
            } else if (role === ROLES.STAFF) {
                if ((doc.currentNode === FLOW_NODES.HANDLE || doc.currentNode === FLOW_NODES.FEEDBACK) &&
                    doc.assignedUser === user.id) {
                    stats.myPending++;
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
                return role === ROLES.STAFF && doc.assignedUser === user.id;
            case FLOW_NODES.FEEDBACK:
                return role === ROLES.STAFF && doc.assignedUser === user.id;
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
                archived: true,
                createdAt: new Date(now - 86400000 * 10).toISOString(),
                createdBy: 'office1',
                createdByName: '张秘书',
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
                createdAt: new Date(now - 86400000 * 5).toISOString(),
                createdBy: 'office2',
                createdByName: '李文员',
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
                createdAt: new Date(now - 86400000 * 3).toISOString(),
                createdBy: 'office1',
                createdByName: '张秘书',
                flowRecords: [
                    {
                        node: FLOW_NODES.REGISTER,
                        status: 'completed',
                        operatorId: 'office1',
                        operatorName: '张秘书',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 3).toISOString(),
                        comment: '收文登记',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.PROPOSE,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 2.5).toISOString(),
                        comment: '请业务科牵头落实。',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.ASSIGN,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 2.5).toISOString(),
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
                createdAt: new Date(now - 86400000 * 2).toISOString(),
                createdBy: 'office2',
                createdByName: '李文员',
                flowRecords: [
                    {
                        node: FLOW_NODES.REGISTER,
                        status: 'completed',
                        operatorId: 'office2',
                        operatorName: '李文员',
                        operatorDept: '办公室',
                        time: new Date(now - 86400000 * 2).toISOString(),
                        comment: '收文登记',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.PROPOSE,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 1.8).toISOString(),
                        comment: '请综合科按时报送。',
                        attachments: []
                    },
                    {
                        node: FLOW_NODES.ASSIGN,
                        status: 'completed',
                        operatorId: 'leader1',
                        operatorName: '王局长',
                        operatorDept: '局领导',
                        time: new Date(now - 86400000 * 1.8).toISOString(),
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
                        time: new Date(now - 86400000 * 1).toISOString(),
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
                createdAt: new Date(now - 86400000 * 0.5).toISOString(),
                createdBy: 'office1',
                createdByName: '张秘书',
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
            }
        ];

        this.save();
    }
}

const dataStore = new DataStore();
dataStore.initMockData();
