const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const DATA_JS = path.join(__dirname, '..', 'js', 'data.js');

function createLocalStorage(seed = {}) {
    const store = new Map(Object.entries(seed));
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
        dump() {
            return Object.fromEntries(store);
        }
    };
}

function loadDataModule() {
    const localStorage = createLocalStorage();
    const context = vm.createContext({
        console,
        localStorage,
        Date,
        Math,
        setTimeout,
        clearTimeout
    });
    const source = fs.readFileSync(DATA_JS, 'utf8');
    const exportsSource = `
        ({
            DataStore,
            FLOW_NODES,
            NODE_STATUS,
            ROLES,
            HANDLE_TYPES,
            HANDLE_STATUS,
            MESSAGE_TYPES,
            ATTACHMENT_CATEGORIES,
            dataStore,
            messageStore,
            userStore,
            getDocStatusLabel,
            getAllHandlerUserIds
        })
    `;
    const api = vm.runInContext(`${source}\n${exportsSource};`, context);

    api.dataStore.docs = [];
    api.dataStore.drafts = [];
    api.messageStore.messages = [];
    localStorage.clear();

    const store = new api.DataStore();
    store.docs = [];
    store.drafts = [];

    return { ...api, store, localStorage };
}

function users() {
    return {
        office: { id: 'office1', name: '张秘书', dept: '办公室' },
        leader: { id: 'leader1', name: '王局长', dept: '局领导' },
        mainStaff: { id: 'staff1', name: '陈科长', dept: '综合科' },
        coStaff: { id: 'staff3', name: '周主任', dept: '业务科' }
    };
}

function docPayload(attachments = []) {
    return {
        title: '关于推进重点项目建设的通知',
        fromUnit: '市政府办公室',
        docNumber: '市政办〔2026〕8号',
        docDate: '2026-06-09',
        priority: 'high',
        category: '通知',
        content: '请按要求推进重点项目建设。',
        attachments
    };
}

function recordsByNode(doc, node) {
    return doc.flowRecords.filter(record => record.node === node);
}

function messageTypes(messageStore) {
    return messageStore.messages.map(message => message.type);
}

test('single-department document flow records nodes, attachments, and messages', () => {
    const {
        store,
        localStorage,
        messageStore,
        FLOW_NODES,
        HANDLE_STATUS,
        ROLES,
        MESSAGE_TYPES,
        ATTACHMENT_CATEGORIES
    } = loadDataModule();
    const { office, leader, mainStaff } = users();

    const registerAttachment = {
        name: '来文正文.pdf',
        size: '128KB',
        category: ATTACHMENT_CATEGORIES.MAIN,
        remark: '原始来文'
    };
    const handleAttachment = {
        name: '办理材料.docx',
        size: '64KB',
        category: ATTACHMENT_CATEGORIES.REFERENCE,
        remark: '办理依据'
    };
    const feedbackAttachment = {
        name: '反馈意见.pdf',
        size: '32KB',
        category: ATTACHMENT_CATEGORIES.INSTRUCTION,
        remark: '最终反馈'
    };

    const doc = store.createDoc(docPayload([registerAttachment]), office);

    assert.equal(doc.currentNode, FLOW_NODES.PROPOSE);
    assert.equal(doc.archived, false);
    assert.equal(recordsByNode(doc, FLOW_NODES.REGISTER).length, 1);
    assert.deepEqual(recordsByNode(doc, FLOW_NODES.REGISTER)[0].attachments, [registerAttachment]);
    assert.equal(messageStore.messages.length, 1);
    assert.equal(messageStore.messages[0].type, MESSAGE_TYPES.NEW_DOC_PROPOSE);
    assert.equal(messageStore.messages[0].toRole, 'leader');
    assert.ok(localStorage.getItem('doc_flow_system'));
    assert.equal(store.canOperate(doc, ROLES.LEADER, leader), true);
    assert.equal(store.canOperate(doc, ROLES.OFFICE, office), false);

    assert.equal(store.proposeDoc(doc.id, '请分管领导阅示', leader), doc);
    assert.equal(doc.currentNode, FLOW_NODES.ASSIGN);
    assert.equal(recordsByNode(doc, FLOW_NODES.PROPOSE).at(-1).operatorId, leader.id);
    assert.equal(store.canOperate(doc, ROLES.LEADER, leader), true);
    assert.equal(store.canOperate(doc, ROLES.STAFF, mainStaff), false);

    assert.equal(
        store.assignDoc(doc.id, mainStaff.dept, mainStaff.id, mainStaff.name, '交综合科办理', leader),
        doc
    );
    assert.equal(doc.currentNode, FLOW_NODES.HANDLE);
    assert.equal(doc.assignedDept, mainStaff.dept);
    assert.equal(doc.assignedUser, mainStaff.id);
    assert.equal(doc.isMultiDept, false);
    assert.equal(doc.handleRecords.length, 1);
    assert.equal(doc.handleRecords[0].status, HANDLE_STATUS.PENDING);
    assert.equal(recordsByNode(doc, FLOW_NODES.ASSIGN).at(-1).assignedUserId, mainStaff.id);
    assert.ok(doc.deadline);
    assert.equal(messageTypes(messageStore).filter(type => type === MESSAGE_TYPES.DOC_ASSIGNED).length, 1);
    assert.equal(messageStore.messages[0].toUserId, mainStaff.id);
    assert.equal(store.canOperate(doc, ROLES.STAFF, mainStaff), true);
    assert.equal(store.canOperate(doc, ROLES.LEADER, leader), false);

    assert.equal(store.handleDoc(doc.id, '已完成承办材料整理', [handleAttachment], mainStaff), doc);
    assert.equal(doc.currentNode, FLOW_NODES.FEEDBACK);
    assert.equal(doc.handleRecords[0].status, HANDLE_STATUS.COMPLETED);
    assert.deepEqual(doc.handleRecords[0].attachments, [handleAttachment]);
    assert.deepEqual(recordsByNode(doc, FLOW_NODES.HANDLE).at(-1).attachments, [handleAttachment]);
    assert.equal(recordsByNode(doc, FLOW_NODES.HANDLE).at(-1).handleType, 'main');
    assert.equal(messageStore.messages[0].type, MESSAGE_TYPES.DOC_HANDLED);
    assert.equal(messageStore.messages[0].toRole, 'leader');
    assert.equal(store.canOperate(doc, ROLES.STAFF, mainStaff), true);
    assert.equal(store.canOperate(doc, ROLES.OFFICE, office), false);

    assert.equal(store.feedbackDoc(doc.id, '办理结果已反馈', [feedbackAttachment], mainStaff), doc);
    assert.equal(doc.currentNode, FLOW_NODES.COMPLETE);
    assert.equal(doc.archived, false);
    assert.deepEqual(recordsByNode(doc, FLOW_NODES.FEEDBACK).at(-1).attachments, [feedbackAttachment]);
    assert.deepEqual(messageTypes(messageStore).slice(0, 2), [
        MESSAGE_TYPES.DOC_FEEDBACK,
        MESSAGE_TYPES.DOC_COMPLETED
    ]);
    assert.equal(messageStore.messages[0].toRole, 'leader');
    assert.equal(messageStore.messages[1].toRole, 'office');
    assert.equal(store.canOperate(doc, ROLES.OFFICE, office), true);
    assert.equal(store.canOperate(doc, ROLES.STAFF, mainStaff), false);

    assert.equal(store.completeDoc(doc.id, '归档完成', office), doc);
    assert.equal(doc.currentNode, FLOW_NODES.COMPLETE);
    assert.equal(doc.archived, true);
    assert.equal(recordsByNode(doc, FLOW_NODES.COMPLETE).at(-1).operatorId, office.id);
    assert.equal(recordsByNode(doc, FLOW_NODES.COMPLETE).at(-1).comment, '归档完成');
    assert.equal(messageStore.messages[0].type, MESSAGE_TYPES.DOC_ARCHIVED);
    assert.equal(messageStore.messages[0].toUserId, mainStaff.id);
    assert.equal(messageStore.messages[1].type, MESSAGE_TYPES.DOC_ARCHIVED);
    assert.equal(messageStore.messages[1].toRole, 'leader');
});

test('multi-department document flow waits for co-handlers before final feedback', () => {
    const {
        store,
        messageStore,
        FLOW_NODES,
        HANDLE_STATUS,
        MESSAGE_TYPES,
        ATTACHMENT_CATEGORIES
    } = loadDataModule();
    const { office, leader, mainStaff, coStaff } = users();

    const coAttachment = {
        name: '协办意见.docx',
        size: '48KB',
        category: ATTACHMENT_CATEGORIES.REFERENCE,
        remark: '协办意见'
    };
    const feedbackAttachment = {
        name: '汇总反馈.pdf',
        size: '72KB',
        category: ATTACHMENT_CATEGORIES.INSTRUCTION,
        remark: '主办汇总'
    };

    const doc = store.createDoc(docPayload(), office);
    store.proposeDoc(doc.id, '请会同相关科室办理', leader);
    store.assignDocMulti(doc.id, {
        mainDept: mainStaff.dept,
        mainUserId: mainStaff.id,
        mainUserName: mainStaff.name,
        coHandlers: [
            { dept: coStaff.dept, userId: coStaff.id, userName: coStaff.name }
        ],
        comment: '综合科主办，业务科协办'
    }, leader);

    assert.equal(doc.currentNode, FLOW_NODES.HANDLE);
    assert.equal(doc.isMultiDept, true);
    assert.equal(doc.handleRecords.length, 2);
    assert.equal(doc.handleRecords[0].type, 'main');
    assert.equal(doc.handleRecords[1].type, 'co');
    assert.equal(messageTypes(messageStore).filter(type => type === MESSAGE_TYPES.DOC_ASSIGNED).length, 2);

    assert.equal(store.handleDoc(doc.id, '主办不能先办结承办', [], mainStaff), null);
    assert.equal(doc.currentNode, FLOW_NODES.HANDLE);
    assert.equal(doc.handleRecords[0].status, HANDLE_STATUS.PENDING);

    assert.equal(store.handleDoc(doc.id, '协办意见已提交', [coAttachment], coStaff), doc);
    assert.equal(doc.handleRecords[1].status, HANDLE_STATUS.COMPLETED);
    assert.deepEqual(doc.handleRecords[1].attachments, [coAttachment]);
    assert.equal(doc.currentNode, FLOW_NODES.FEEDBACK);
    assert.equal(recordsByNode(doc, FLOW_NODES.HANDLE).at(-1).handleType, 'co');
    assert.deepEqual(recordsByNode(doc, FLOW_NODES.HANDLE).at(-1).attachments, [coAttachment]);
    assert.equal(messageStore.messages[0].type, MESSAGE_TYPES.DOC_HANDLED);
    assert.equal(messageStore.messages[0].toUserId, mainStaff.id);

    assert.equal(store.feedbackDoc(doc.id, '主办汇总后反馈', [feedbackAttachment], coStaff), null);
    assert.equal(doc.currentNode, FLOW_NODES.FEEDBACK);

    assert.equal(store.feedbackDoc(doc.id, '主办汇总后反馈', [feedbackAttachment], mainStaff), doc);
    assert.equal(doc.currentNode, FLOW_NODES.COMPLETE);
    assert.equal(doc.handleRecords[0].status, HANDLE_STATUS.COMPLETED);
    assert.deepEqual(doc.handleRecords[0].attachments, [feedbackAttachment]);
    assert.deepEqual(recordsByNode(doc, FLOW_NODES.FEEDBACK).at(-1).attachments, [feedbackAttachment]);

    assert.equal(store.completeDoc(doc.id, '归档完成', office), doc);
    assert.equal(doc.archived, true);
    const archivedMessages = messageStore.messages.filter(message => message.type === MESSAGE_TYPES.DOC_ARCHIVED);
    assert.deepEqual(
        archivedMessages.map(message => message.toUserId || message.toRole).sort(),
        ['leader', mainStaff.id, coStaff.id].sort()
    );
});
