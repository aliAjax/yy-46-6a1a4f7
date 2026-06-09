function renderBatchImportList() {
    const content = document.getElementById('contentArea');
    const batches = importBatchStore.listBatches(currentImportFilters);

    const statusOptions = [
        { value: '', label: '全部状态' },
        { value: IMPORT_STATUS.PENDING, label: '待导入' },
        { value: IMPORT_STATUS.COMPLETED, label: '已完成' },
        { value: IMPORT_STATUS.FAILED, label: '导入失败' }
    ];

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">批量收文导入</h2>
            <button class="btn btn-primary" onclick="navigateTo('batchImportUpload')">📥 新建导入</button>
        </div>

        <div class="card">
            <div class="card-body">
                <div class="search-bar">
                    <div class="form-group">
                        <label class="form-label">关键词</label>
                        <input type="text" class="form-input" id="importKeyword" placeholder="批次号、文件名"
                               onkeyup="if(event.key==='Enter') applyImportFilters()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">状态</label>
                        <select class="form-select" id="importStatus" onchange="applyImportFilters()">
                            ${statusOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="applyImportFilters()">🔍 查询</button>
                    <button class="btn btn-default" onclick="resetImportFilters()">重置</button>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-body" style="padding:0;" id="importListTable">
                ${renderBatchImportTable()}
            </div>
        </div>
    `;
}

function applyImportFilters() {
    DocFlow.Core.FilterHelper.apply({
        fields: {
            keyword: { id: 'importKeyword' },
            status: { id: 'importStatus' }
        },
        setter: function (filters) { currentImportFilters = filters; },
        render: function () {
            document.getElementById('importListTable').innerHTML = renderBatchImportTable();
        }
    });
}

function resetImportFilters() {
    DocFlow.Core.FilterHelper.reset({
        fields: {
            keyword: { id: 'importKeyword' },
            status: { id: 'importStatus' }
        },
        setter: function (filters) { currentImportFilters = filters; },
        render: function () {
            document.getElementById('importListTable').innerHTML = renderBatchImportTable();
        }
    });
}

function renderBatchImportTable() {
    const batches = importBatchStore.listBatches(currentImportFilters);

    if (batches.length === 0) {
        return '<div class="empty-state"><div class="empty-icon">📥</div><p>暂无导入批次记录</p></div>';
    }

    return `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>批次号</th>
                        <th>文件名</th>
                        <th>文件类型</th>
                        <th>总数</th>
                        <th>成功</th>
                        <th>失败</th>
                        <th>状态</th>
                        <th>导入时间</th>
                        <th>操作人</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${batches.map(batch => `
                        <tr>
                            <td><strong>${batch.id}</strong></td>
                            <td>${batch.fileName}</td>
                            <td><span class="file-type-tag">${batch.fileType.toUpperCase()}</span></td>
                            <td>${batch.totalCount}</td>
                            <td style="color:#52c41a;">${batch.successCount}</td>
                            <td style="color:#f5222d;">${batch.failCount}</td>
                            <td><span class="import-status-badge status-${batch.status}">${IMPORT_STATUS_LABELS[batch.status]}</span></td>
                            <td>${formatDateTime(batch.createdAt)}</td>
                            <td>${batch.createdByName}</td>
                            <td>
                                <div class="actions">
                                    ${batch.status === IMPORT_STATUS.PENDING
                                        ? `<a class="action-link" onclick="navigateTo('batchImportPreview', {batchId: '${batch.id}'})">继续导入</a>`
                                        : `<a class="action-link" onclick="viewImportResult('${batch.id}')">查看结果</a>`}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function viewImportResult(batchId) {
    navigateTo('batchImportResult', { batchId: batchId });
}

let pendingImportData = null;

function renderBatchImportUpload() {
    const content = document.getElementById('contentArea');

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">新建批量导入</h2>
            <button class="btn btn-default" onclick="navigateTo('batchImport')">返回列表</button>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">上传文件</span>
            </div>
            <div class="card-body">
                <div class="import-upload-area" onclick="document.getElementById('importFileInput').click()">
                    <div class="import-upload-icon">📁</div>
                    <div class="import-upload-title">点击上传文件</div>
                    <div class="import-upload-desc">支持 CSV、JSON 格式，单文件不超过 10MB</div>
                    <input type="file" id="importFileInput" accept=".csv,.json" onchange="handleImportFileSelect(this)">
                </div>

                <div class="import-format-info">
                    <h4 style="margin-bottom:12px; color:#333;">📋 文件格式说明</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                        <div class="format-card">
                            <div class="format-title">CSV 格式</div>
                            <div class="format-desc">
                                <p>第一行为表头，包含以下字段：</p>
                                <ul>
                                    <li><code>title</code> - 公文标题（必填）</li>
                                    <li><code>fromUnit</code> - 来文单位（必填）</li>
                                    <li><code>docNumber</code> - 来文字号</li>
                                    <li><code>docDate</code> - 来文日期 (YYYY-MM-DD)</li>
                                    <li><code>priority</code> - 紧急程度 (普通/加急/特急)</li>
                                    <li><code>category</code> - 公文类别</li>
                                    <li><code>content</code> - 内容摘要</li>
                                </ul>
                            </div>
                        </div>
                        <div class="format-card">
                            <div class="format-title">JSON 格式</div>
                            <div class="format-desc">
                                <p>对象数组，每个对象包含以下字段：</p>
                                <ul>
                                    <li><code>title</code> - 公文标题（必填）</li>
                                    <li><code>fromUnit</code> - 来文单位（必填）</li>
                                    <li><code>docNumber</code> - 来文字号</li>
                                    <li><code>docDate</code> - 来文日期</li>
                                    <li><code>priority</code> - 紧急程度</li>
                                    <li><code>category</code> - 公文类别</li>
                                    <li><code>content</code> - 内容摘要</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-top:20px; text-align:right;">
                    <button class="btn btn-default" onclick="navigateTo('batchImport')">取消</button>
                    <button class="btn btn-primary" id="nextPreviewBtn" disabled onclick="goToImportPreview()">下一步：预览校验</button>
                </div>
            </div>
        </div>
    `;

    pendingImportData = null;
}

function handleImportFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showToast('文件大小不能超过 10MB', 'error');
        return;
    }

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isJSON = fileName.endsWith('.json');

    if (!isCSV && !isJSON) {
        showToast('仅支持 CSV 和 JSON 格式文件', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let items = [];
            if (isCSV) {
                items = parseCSV(e.target.result);
            } else {
                items = parseJSON(e.target.result);
            }

            if (items.length === 0) {
                showToast('文件中没有有效数据', 'error');
                return;
            }

            pendingImportData = {
                fileName: file.name,
                fileType: isCSV ? 'csv' : 'json',
                items: items
            };

            document.getElementById('nextPreviewBtn').disabled = false;
            showToast(`文件解析成功，共 ${items.length} 条记录`);
        } catch (err) {
            showToast('文件解析失败：' + err.message, 'error');
        }
    };
    reader.onerror = function() {
        showToast('文件读取失败', 'error');
    };

    if (isCSV) {
        reader.readAsText(file, 'UTF-8');
    } else {
        reader.readAsText(file);
    }
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
        throw new Error('CSV 文件至少需要表头和一行数据');
    }

    const fieldMap = {
        'title': 'title',
        'fromunit': 'fromUnit',
        'from_unit': 'fromUnit',
        'docnumber': 'docNumber',
        'doc_number': 'docNumber',
        'docdate': 'docDate',
        'doc_date': 'docDate',
        'priority': 'priority',
        'category': 'category',
        'content': 'content'
    };

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    const items = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;

        const values = parseCSVLine(line);
        const item = {};

        headers.forEach((header, index) => {
            const key = header.toLowerCase().replace(/\s+/g, '');
            const mappedKey = fieldMap[key] || key;
            item[mappedKey] = values[index] || '';
        });

        items.push(item);
    }

    return items;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);

    return result;
}

function parseJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
        throw new Error('JSON 文件内容必须是数组');
    }
    return data;
}

let currentPreviewBatchId = null;

function goToImportPreview() {
    if (!pendingImportData) {
        showToast('请先上传文件', 'error');
        return;
    }

    const docNumbers = new Set();
    const validatedItems = pendingImportData.items.map((item, index) => {
        return importBatchStore.validateImportItem(item, index + 1, docNumbers);
    });

    const batch = importBatchStore.createBatch({
        fileName: pendingImportData.fileName,
        fileType: pendingImportData.fileType,
        totalCount: validatedItems.length,
        items: validatedItems
    }, currentUser);

    currentPreviewBatchId = batch.id;
    navigateTo('batchImportPreview', { batchId: batch.id });
}

function renderBatchImportPreview() {
    const batchId = currentImportBatchId || currentPreviewBatchId;
    const batch = importBatchStore.getBatch(batchId);

    if (!batch) {
        document.getElementById('contentArea').innerHTML = '<div class="empty-state"><p>批次不存在</p></div>';
        return;
    }

    const validItems = batch.items.filter(item => item.valid);
    const invalidItems = batch.items.filter(item => !item.valid);

    const content = document.getElementById('contentArea');

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">预览校验</h2>
            <button class="btn btn-default" onclick="navigateTo('batchImport')">返回列表</button>
        </div>

        <div class="preview-stats-grid">
            <div class="preview-stat-card preview-stat-total">
                <div class="preview-stat-icon">📊</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${batch.totalCount}</div>
                    <div class="preview-stat-label">总记录数</div>
                </div>
            </div>
            <div class="preview-stat-card preview-stat-success">
                <div class="preview-stat-icon">✅</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${validItems.length}</div>
                    <div class="preview-stat-label">校验通过</div>
                </div>
            </div>
            <div class="preview-stat-card preview-stat-error">
                <div class="preview-stat-icon">❌</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${invalidItems.length}</div>
                    <div class="preview-stat-label">校验失败</div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">文件信息</span>
            </div>
            <div class="card-body">
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">批次号</span>
                        <span class="detail-value"><strong>${batch.id}</strong></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">文件名</span>
                        <span class="detail-value">${batch.fileName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">文件类型</span>
                        <span class="detail-value"><span class="file-type-tag">${batch.fileType.toUpperCase()}</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">上传时间</span>
                        <span class="detail-value">${formatDateTime(batch.createdAt)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">数据校验结果</span>
                <div class="preview-tabs">
                    <span class="preview-tab active" onclick="switchPreviewTab('all', this)">全部 (${batch.totalCount})</span>
                    <span class="preview-tab" onclick="switchPreviewTab('valid', this)">通过 (${validItems.length})</span>
                    <span class="preview-tab" onclick="switchPreviewTab('invalid', this)">失败 (${invalidItems.length})</span>
                </div>
            </div>
            <div class="card-body" style="padding:0;">
                ${renderPreviewTable(batch.items, 'all')}
            </div>
        </div>

        <div style="margin-top:20px; text-align:right;">
            <button class="btn btn-default" onclick="navigateTo('batchImportUpload')" style="margin-right:8px;">重新上传</button>
            <button class="btn btn-primary btn-lg" onclick="confirmImportBatch()" ${validItems.length === 0 ? 'disabled' : ''}>
                确认导入 (${validItems.length} 条)
            </button>
        </div>
    `;
}

function switchPreviewTab(type, tabEl) {
    const batchId = currentImportBatchId || currentPreviewBatchId;
    const batch = importBatchStore.getBatch(batchId);
    if (!batch) return;

    document.querySelectorAll('.preview-tab').forEach(el => el.classList.remove('active'));
    tabEl.classList.add('active');

    let items = batch.items;
    if (type === 'valid') {
        items = batch.items.filter(item => item.valid);
    } else if (type === 'invalid') {
        items = batch.items.filter(item => !item.valid);
    }

    const tableContainer = document.querySelector('.card-body[style="padding:0;"]');
    if (tableContainer) {
        tableContainer.innerHTML = renderPreviewTable(items, type);
    }
}

function renderPreviewTable(items, type) {
    if (items.length === 0) {
        return '<div class="empty-state"><p>暂无数据</p></div>';
    }

    return `
        <div class="table-container import-preview-table">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width:60px;">行号</th>
                        <th>标题</th>
                        <th>来文单位</th>
                        <th>来文字号</th>
                        <th>来文日期</th>
                        <th>紧急程度</th>
                        <th>状态</th>
                        <th>错误信息</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr class="${item.valid ? 'row-valid' : 'row-invalid'}">
                            <td>${item.rowIndex}</td>
                            <td class="td-ellipsis" title="${item.data.title || ''}">${item.data.title || '-'}</td>
                            <td>${item.data.fromUnit || '-'}</td>
                            <td>${item.data.docNumber || '-'}</td>
                            <td>${item.data.docDate || '-'}</td>
                            <td>${item.data.priority ? getPriorityLabel(item.data.priority) : '-'}</td>
                            <td>
                                <span class="valid-badge ${item.valid ? 'valid' : 'invalid'}">
                                    ${item.valid ? '✓ 通过' : '✗ 失败'}
                                </span>
                            </td>
                            <td class="error-cell">
                                ${item.valid ? '-' : item.errors.join('；')}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function confirmImportBatch() {
    const batchId = currentImportBatchId || currentPreviewBatchId;
    const batch = importBatchStore.getBatch(batchId);

    if (!batch) {
        showToast('批次不存在', 'error');
        return;
    }

    const validCount = batch.items.filter(item => item.valid).length;
    if (validCount === 0) {
        showToast('没有可导入的有效数据', 'error');
        return;
    }

    if (!confirm(`确认导入 ${validCount} 条公文？导入后将生成待批示公文。`)) {
        return;
    }

    const result = importBatchStore.batchCreateDocs(batchId, currentUser);

    showToast(`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`);
    navigateTo('batchImportResult', { batchId: batchId });
}

function renderBatchImportResult() {
    const batchId = currentImportBatchId;
    const batch = importBatchStore.getBatch(batchId);

    if (!batch) {
        document.getElementById('contentArea').innerHTML = '<div class="empty-state"><p>批次不存在</p></div>';
        return;
    }

    const successItems = batch.items.filter(item => item.docId);
    const failItems = batch.items.filter(item => !item.valid || !item.docId);

    const content = document.getElementById('contentArea');

    content.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">导入结果</h2>
            <button class="btn btn-default" onclick="navigateTo('batchImport')">返回列表</button>
        </div>

        <div class="result-summary-card ${batch.status === IMPORT_STATUS.FAILED ? 'result-failed' : 'result-success'}">
            <div class="result-icon">
                ${batch.status === IMPORT_STATUS.FAILED ? '❌' : '✅'}
            </div>
            <div class="result-info">
                <div class="result-title">
                    ${batch.status === IMPORT_STATUS.FAILED ? '导入失败' : '导入成功'}
                </div>
                <div class="result-desc">
                    批次号：${batch.id} · 共 ${batch.totalCount} 条记录
                </div>
            </div>
        </div>

        <div class="preview-stats-grid" style="margin-top:20px;">
            <div class="preview-stat-card preview-stat-success">
                <div class="preview-stat-icon">✅</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${batch.successCount}</div>
                    <div class="preview-stat-label">成功导入</div>
                </div>
            </div>
            <div class="preview-stat-card preview-stat-error">
                <div class="preview-stat-icon">❌</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${batch.failCount}</div>
                    <div class="preview-stat-label">导入失败</div>
                </div>
            </div>
            <div class="preview-stat-card preview-stat-total">
                <div class="preview-stat-icon">📊</div>
                <div class="preview-stat-info">
                    <div class="preview-stat-number">${batch.totalCount}</div>
                    <div class="preview-stat-label">总记录数</div>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:20px;">
            <div class="card-header">
                <span class="card-title">成功导入的公文</span>
                <span class="badge-count">${successItems.length} 条</span>
            </div>
            <div class="card-body" style="padding:0;">
                ${successItems.length > 0 ? `
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>行号</th>
                                    <th>文号</th>
                                    <th>标题</th>
                                    <th>来文单位</th>
                                    <th>紧急程度</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${successItems.map(item => `
                                    <tr>
                                        <td>${item.rowIndex}</td>
                                        <td><strong>${item.docId}</strong></td>
                                        <td class="td-ellipsis" title="${item.data.title}">${item.data.title}</td>
                                        <td>${item.data.fromUnit}</td>
                                        <td>${item.data.priority ? getPriorityLabel(item.data.priority) : '-'}</td>
                                        <td>
                                            <a class="action-link" onclick="navigateTo('detail', {id: '${item.docId}'})">查看</a>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>无成功导入记录</p></div>'}
            </div>
        </div>

        ${failItems.length > 0 ? `
        <div class="card">
            <div class="card-header">
                <span class="card-title">导入失败记录</span>
                <span class="badge-count" style="background:#f5222d;">${failItems.length} 条</span>
            </div>
            <div class="card-body" style="padding:0;">
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width:60px;">行号</th>
                                <th>标题</th>
                                <th>来文单位</th>
                                <th>来文字号</th>
                                <th>失败原因</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${failItems.map(item => `
                                <tr class="row-invalid">
                                    <td>${item.rowIndex}</td>
                                    <td>${item.data.title || '-'}</td>
                                    <td>${item.data.fromUnit || '-'}</td>
                                    <td>${item.data.docNumber || '-'}</td>
                                    <td class="error-cell">
                                        ${item.errors && item.errors.length > 0 ? item.errors.join('；') : '导入失败'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        ` : ''}

        <div style="margin-top:20px; text-align:right;">
            <button class="btn btn-default" onclick="navigateTo('batchImportUpload')" style="margin-right:8px;">继续导入</button>
            <button class="btn btn-primary" onclick="navigateTo('list')">查看公文列表</button>
        </div>
    `;
}
