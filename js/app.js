(function () {
    window.DocFlow = window.DocFlow || {};

    var moduleScripts = [
        'js/modules/core.js',
        'js/modules/docList.js',
        'js/modules/supervision.js',
        'js/modules/attachments.js',
        'js/modules/drafts.js',
        'js/modules/docDetail.js',
        'js/modules/templates.js',
        'js/modules/messages.js',
        'js/modules/batchImport.js',
        'js/modules/userManage.js'
    ];

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = function () {
                reject(new Error('模块加载失败：' + src));
            };
            document.head.appendChild(script);
        });
    }

    function loadModules(index) {
        if (index >= moduleScripts.length) {
            registerNamespaces();
            startApp();
            return Promise.resolve();
        }
        return loadScript(moduleScripts[index]).then(function () {
            return loadModules(index + 1);
        });
    }

    function pick(names) {
        var api = {};
        names.forEach(function (name) {
            if (typeof window[name] === 'function') {
                api[name] = window[name];
            }
        });
        return api;
    }

    function registerNamespaces() {
        DocFlow.Core = Object.assign(pick([
            'init', 'selectLoginRole', 'updateUserSelect', 'doLogin', 'logout',
            'showMainApp', 'renderNav', 'navigateTo', 'renderDashboard',
            'renderRemainingTime', 'closeModal', 'showToast', 'formatDate',
            'formatDateTime', 'formatFileSize', 'getPriorityLabel', 'escapeHtml'
        ]), createCoreHelpers());

        DocFlow.DocList = pick([
            'renderDocList', 'applyFilters', 'resetFilters', 'applyFilterView',
            'updateFilterViewTabs', 'openSaveViewModal', 'doSaveView',
            'syncFilterControls', 'deleteFilterView', 'renderDocTable',
            'renderStatistics', 'goToListFromStats', 'renderArchiveList',
            'applyArchiveFilters', 'resetArchiveFilters', 'renderArchiveTable'
        ]);
        DocFlow.Supervision = pick([
            'renderSupervisionCenter', 'applySupervisionFilters',
            'resetSupervisionFilters', 'updateSupervisionStaffOptions',
            'renderSupervisionTable', 'quickSupervise'
        ]);
        DocFlow.Attachments = pick([
            'renderAttachmentCenter', 'applyAttachmentFilters',
            'resetAttachmentFilters', 'updateAttachmentUploaderOptions',
            'renderAttachmentTable', 'goToDocFromAttachment'
        ]);
        DocFlow.Drafts = pick([
            'renderRegisterForm', 'setupDraftFormListeners', 'onDraftFormChange',
            'scheduleAutoSave', 'clearDraftAutoSave', 'autoSaveDraft',
            'saveDraftManually', 'updateDraftSaveStatus',
            'updateDraftLastSavedText', 'updateDraftInfoBar', 'saveDraft',
            'handleFileSelect', 'removeAttachment', 'renderAttachmentList',
            'updateAttachmentCategory', 'updateAttachmentRemark',
            'getRegisterFormData', 'submitRegister', 'renderDraftList',
            'renderDraftTable', 'getSortIcon', 'sortDrafts', 'applyDraftFilters',
            'resetDraftFilters', 'viewDraftDetail', 'closeDraftDetailModal',
            'submitDraftFromDetail', 'editDraft', 'submitDraftFromList',
            'deleteDraftConfirm'
        ]);
        DocFlow.DocDetail = pick([
            'renderDocDetail', 'renderSupervisionTimeline', 'renderTimeline',
            'renderMultiHandleTimelineContent', 'showOperateModal',
            'handleOpFileSelect', 'removeOpAttachment', 'updateStaffOptions',
            'updateMainStaffOptions', 'setAssignMode', 'showAddCoHandlerModal',
            'closeSubModal', 'updateCoStaffOptions', 'confirmAddCoHandler',
            'renderCoHandlerList', 'removeCoHandler', 'submitOperation',
            'showSuperviseModal', 'submitSupervision', 'showReturnModal',
            'submitReturn', 'showResubmitModal', 'handleResubmitFileSelect',
            'removeResubmitAttachment', 'submitResubmit'
        ]);
        DocFlow.Templates = pick([
            'renderTemplateList', 'filterTemplates', 'showAddTemplateModal',
            'addTemplate', 'deleteTemplate', 'renderTemplateSelector',
            'insertTemplateContent'
        ]);
        DocFlow.Messages = pick([
            'getMessageIcon', 'getMessageTypeLabel', 'renderMessageList',
            'filterMessages', 'handleMessageClick', 'markMessageRead',
            'markAllMessagesRead'
        ]);
        DocFlow.BatchImport = pick([
            'renderBatchImportList', 'applyImportFilters', 'resetImportFilters',
            'renderBatchImportTable', 'viewImportResult',
            'renderBatchImportUpload', 'handleImportFileSelect', 'parseCSV',
            'parseCSVLine', 'parseJSON', 'goToImportPreview',
            'renderBatchImportPreview', 'switchPreviewTab',
            'renderPreviewTable', 'confirmImportBatch',
            'renderBatchImportResult'
        ]);
        DocFlow.UserManage = pick([
            'renderUserManage', 'switchUserManageTab',
            'renderUserManageTabContent', 'renderDepartmentManage',
            'renderUserManageList', 'toggleShowInactiveUsers',
            'showAddDepartmentModal', 'submitAddDepartment',
            'showEditDepartmentModal', 'submitEditDepartment',
            'confirmDeleteDepartment', 'showAddUserModal', 'submitAddUser',
            'showEditUserModal', 'submitEditUser', 'confirmDeleteUser',
            'confirmRestoreUser'
        ]);
    }

    function createCoreHelpers() {
        return {
            FilterHelper: {
                apply: function (config) {
                    var filters = {};
                    Object.keys(config.fields).forEach(function (key) {
                        var field = config.fields[key];
                        var el = document.getElementById(field.id);
                        if (!el) return;
                        var value = el.value;
                        if (field.trim !== false && typeof value === 'string') {
                            value = value.trim();
                        }
                        filters[key] = field.transform ? field.transform(value) : value;
                    });
                    config.setter(filters);
                    if (config.beforeRender) config.beforeRender(filters);
                    config.render();
                },
                reset: function (config) {
                    config.setter({});
                    Object.keys(config.fields).forEach(function (key) {
                        var field = config.fields[key];
                        var el = document.getElementById(field.id);
                        if (el) el.value = field.defaultValue || '';
                    });
                    if (config.beforeRender) config.beforeRender({});
                    config.render();
                }
            },
            ModalHelper: {
                submit: function (config) {
                    var values = {};
                    (config.fields || []).forEach(function (field) {
                        var el = document.getElementById(field.id);
                        var value = el ? el.value : '';
                        if (field.trim !== false && typeof value === 'string') {
                            value = value.trim();
                        }
                        values[field.key] = field.transform ? field.transform(value) : value;
                    });
                    for (var i = 0; i < (config.fields || []).length; i++) {
                        var requiredField = config.fields[i];
                        if (requiredField.required && !values[requiredField.key]) {
                            showToast('请输入' + requiredField.label, 'error');
                            return;
                        }
                    }
                    if (config.validate && !config.validate(values)) return;
                    var result = config.submit(values);
                    var ok = result && result.success !== false;
                    if (ok) {
                        if (config.closeOnSuccess !== false) closeModal();
                        showToast(config.successMessage || '操作成功！');
                        (config.refresh || []).forEach(function (fn) { fn(); });
                    } else {
                        showToast((result && result.error) || config.errorMessage || '操作失败，请重试', 'error');
                    }
                }
            }
        };
    }

    function startApp() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    loadModules(0).catch(function (error) {
        console.error(error);
        var toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = error.message;
            toast.classList.remove('hidden');
            toast.style.background = 'rgba(245, 34, 45, 0.9)';
        }
    });
})();
