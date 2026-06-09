const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const dataJs = fs.readFileSync(path.resolve(__dirname, '../js/data.js'), 'utf8');

function createLocalStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
    get length() {
      return store.size;
    },
    snapshot() {
      return Object.fromEntries(store.entries());
    }
  };
}

function loadDataContext() {
  const localStorage = createLocalStorage();
  const context = {
    console,
    localStorage,
    Date,
    Math,
    JSON,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp
  };

  vm.createContext(context);
  vm.runInContext(`${dataJs}
this.__exports = {
  ROLES,
  FLOW_NODES,
  ATTACHMENT_CATEGORIES,
  DataStore,
  MessageStore,
  TemplateStore,
  FilterViewStore,
  ImportBatchStore,
  dataStore,
  messageStore,
  userStore,
  filterViewStore,
  getWarningStatus,
  getAttachmentCategoryLabel
};`, context, {
    filename: 'js/data.js'
  });

  return { exports: context.__exports, localStorage };
}

test('mock data is initialized in isolated localStorage', () => {
  const first = loadDataContext();
  const second = loadDataContext();

  assert.equal(first.exports.dataStore.listDocs().length, 7);
  assert.equal(second.exports.dataStore.listDocs().length, 7);
  assert.notEqual(first.localStorage, second.localStorage);

  first.localStorage.setItem('test_only', 'first');

  assert.equal(first.localStorage.getItem('test_only'), 'first');
  assert.equal(second.localStorage.getItem('test_only'), null);
});

test('creating a document persists data and creates a leader message', () => {
  const { exports, localStorage } = loadDataContext();
  const creator = exports.userStore.getUserById('office1');

  const doc = exports.dataStore.createDoc({
    title: '测试收文',
    fromUnit: '测试单位',
    docNumber: '测字〔2026〕1号',
    docDate: '2026-06-09',
    priority: 'high',
    category: '通知',
    content: '测试内容',
    attachments: [
      {
        name: '测试附件.pdf',
        size: '10KB',
        category: exports.ATTACHMENT_CATEGORIES.ORIGINAL,
        remark: '原文'
      }
    ]
  }, creator);

  assert.equal(doc.currentNode, exports.FLOW_NODES.PROPOSE);
  assert.equal(exports.dataStore.getDoc(doc.id).title, '测试收文');

  const persistedDocs = JSON.parse(localStorage.getItem('doc_flow_system')).docs;
  assert.equal(persistedDocs[0].id, doc.id);

  const leaderMessages = exports.messageStore.getMessagesForUser(
    exports.ROLES.LEADER,
    exports.userStore.getUserById('leader1')
  );
  assert.ok(leaderMessages.some(message => message.docId === doc.id));
});

test('draft operations are persisted without leaking across tests', () => {
  const { exports, localStorage } = loadDataContext();
  const creator = exports.userStore.getUserById('office1');

  const draft = exports.dataStore.createDraft({
    title: '草稿标题',
    fromUnit: '草稿单位',
    docNumber: '',
    docDate: '2026-06-09',
    priority: 'normal',
    category: '',
    content: '草稿内容',
    attachments: []
  }, creator);

  assert.equal(exports.dataStore.getDraftStats(creator.id).total, 1);

  const updateResult = exports.dataStore.updateDraft(draft.id, {
    title: '更新后的草稿',
    fromUnit: '草稿单位',
    docNumber: '',
    docDate: '2026-06-09',
    priority: 'urgent',
    category: '请示',
    content: '更新内容',
    attachments: []
  }, creator);

  assert.equal(updateResult.id, draft.id);
  assert.equal(updateResult.title, '更新后的草稿');
  assert.equal(exports.dataStore.getDraft(draft.id).title, '更新后的草稿');

  const persistedDrafts = JSON.parse(localStorage.getItem('doc_flow_drafts')).drafts;
  assert.equal(persistedDrafts.length, 1);
  assert.equal(persistedDrafts[0].priority, 'urgent');
});
