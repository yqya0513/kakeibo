// --- グローバル状態 ---
let records = JSON.parse(localStorage.getItem('kakeibo_records')) || [];
let fixedCosts = JSON.parse(localStorage.getItem('kakeibo_fixed_costs')) || [];

let currentInputType = 'expense';
let currentEditType = 'expense';
let editingRecordId = null;
let editingFixedId = null;

let currentMonthlyDate = new Date();
let monthlyFilter = 'both';
let allFilter = 'both';

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  renderAll();
});

function renderAll() {
  renderRecordSummary();
  renderMonthlyPage();
  renderAllPage();
  renderFixedPage();
}

function saveRecords() {
  localStorage.setItem('kakeibo_records', JSON.stringify(records));
  renderAll();
}

function saveFixedCosts() {
  localStorage.setItem('kakeibo_fixed_costs', JSON.stringify(fixedCosts));
  renderAll();
}

// --- タブ切り替え ---
function switchTab(tabName, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  document.getElementById(`page-${tabName}`).classList.add('active');
  el.classList.add('active');
}

// --- 入力画面（記録） ---
function setType(type) {
  currentInputType = type;
  document.getElementById('type-income').classList.toggle('active', type === 'income');
  document.getElementById('type-expense').classList.toggle('active', type === 'expense');
  document.getElementById('entry-amount').placeholder = type === 'income' ? '収入額' : '支出額';
}

function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('entry-date').value = today;
}

function changeInputDate(offset) {
  const input = document.getElementById('entry-date');
  const dateVal = input.value ? new Date(input.value) : new Date();
  dateVal.setDate(dateVal.getDate() + offset);
  input.value = dateVal.toISOString().split('T')[0];
}

function addRecord() {
  const date = document.getElementById('entry-date').value;
  const amount = parseFloat(document.getElementById('entry-amount').value);
  const memo = document.getElementById('entry-memo').value.trim();

  if (!date || isNaN(amount) || amount <= 0) {
    alert('日付と正しい金額を入力してください。');
    return;
  }

  records.push({
    id: Date.now().toString(),
    date: date,
    type: currentInputType,
    amount: amount,
    memo: memo || (currentInputType === 'income' ? '収入' : '支出')
  });

  saveRecords();
  document.getElementById('entry-amount').value = '';
  document.getElementById('entry-memo').value = '';
  alert('記録を追加しました');
}

function renderRecordSummary() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let income = 0;
  let expense = 0;

  records.forEach(r => {
    if (!r || !r.date || isNaN(r.amount)) return;
    const d = new Date(r.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      if (r.type === 'income') income += r.amount;
      else expense += r.amount;
    }
  });

  let fixedTotal = fixedCosts.reduce((sum, f) => sum + (Number(f.monthlyAmount) || 0), 0);
  let balance = income - expense - fixedTotal;

  const balEl = document.getElementById('record-month-balance');
  balEl.textContent = (balance >= 0 ? '+' : '') + balance.toLocaleString();
  balEl.className = 'info-val ' + (balance >= 0 ? 'positive' : 'negative');
}

// --- 月間画面 ---
function changeMonth(offset) {
  currentMonthlyDate.setMonth(currentMonthlyDate.getMonth() + offset);
  renderMonthlyPage();
}

function setMonthlyFilter(filter) {
  monthlyFilter = filter;
  ['income', 'both', 'expense'].forEach(f => {
    document.getElementById(`m-filter-${f}`).classList.toggle('active', f === filter);
  });
  renderMonthlyPage();
}

function renderMonthlyPage() {
  const year = currentMonthlyDate.getFullYear();
  const month = currentMonthlyDate.getMonth();

  document.getElementById('monthly-title').textContent = `${year}年${month + 1}月`;
  document.getElementById('monthly-summary-label').textContent = `${year}年${month + 1}月`;

  let monthlyRecords = records.filter(r => {
    if (!r || !r.date) return false;
    const d = new Date(r.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  let income = 0;
  let expense = 0;
  monthlyRecords.forEach(r => {
    const amt = Number(r.amount) || 0;
    if (r.type === 'income') income += amt;
    else expense += amt;
  });

  let fixedTotal = fixedCosts.reduce((sum, f) => sum + (Number(f.monthlyAmount) || 0), 0);
  let total = 0;

  if (monthlyFilter === 'income') total = income;
  else if (monthlyFilter === 'expense') total = -(expense + fixedTotal);
  else total = income - expense - fixedTotal;

  const totalEl = document.getElementById('monthly-total-amount');
  totalEl.textContent = `合計 ${total >= 0 ? '+' : ''}${total.toLocaleString()}`;
  totalEl.className = 'amount ' + (total >= 0 ? 'positive' : 'negative');

  const fixedEl = document.getElementById('monthly-fixed-cost-val');
  fixedEl.textContent = `-${fixedTotal.toLocaleString()}`;

  let filtered = monthlyRecords.filter(r => {
    if (monthlyFilter === 'both') return true;
    return r.type === monthlyFilter;
  });

  renderGroupedList(filtered, 'monthly-list');
}

// --- 全期間画面 ---
function setAllFilter(filter) {
  allFilter = filter;
  ['income', 'both', 'expense'].forEach(f => {
    document.getElementById(`a-filter-${f}`).classList.toggle('active', f === filter);
  });
  renderAllPage();
}

function renderAllPage() {
  let income = 0;
  let expense = 0;

  const validRecords = records.filter(r => r && r.date && !isNaN(r.amount));

  validRecords.forEach(r => {
    const amt = Number(r.amount) || 0;
    if (r.type === 'income') income += amt;
    else expense += amt;
  });

  const fixedTotalPerMonth = fixedCosts.reduce((sum, f) => sum + (Number(f.monthlyAmount) || 0), 0);

  let totalMonths = 1;
  if (validRecords.length > 0) {
    const timestamps = validRecords
      .map(r => new Date(r.date).getTime())
      .filter(t => !isNaN(t));

    if (timestamps.length > 0) {
      const minTimestamp = Math.min(...timestamps);
      const firstDate = new Date(minTimestamp);
      const now = new Date();
      
      totalMonths = (now.getFullYear() - firstDate.getFullYear()) * 12 + (now.getMonth() - firstDate.getMonth()) + 1;
      if (isNaN(totalMonths) || totalMonths < 1) totalMonths = 1;
    }
  }

  const totalFixedCosts = fixedTotalPerMonth * totalMonths;

  let total = 0;
  if (allFilter === 'income') {
    total = income;
  } else if (allFilter === 'expense') {
    total = -(expense + totalFixedCosts);
  } else {
    total = income - expense - totalFixedCosts;
  }

  const totalEl = document.getElementById('all-total-amount');
  totalEl.textContent = `合計 ${total >= 0 ? '+' : ''}${total.toLocaleString()}`;
  totalEl.className = 'amount ' + (total >= 0 ? 'positive' : 'negative');

  let filtered = validRecords.filter(r => {
    if (allFilter === 'both') return true;
    return r.type === allFilter;
  });

  renderMonthlySummaryOnlyList(filtered, 'all-period-list');
}

// --- リスト描画（月間画面用：日別グループ） ---
function renderGroupedList(recordList, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const groups = {};
  recordList.forEach(r => {
    if (!r.date) return;
    if (!groups[r.date]) groups[r.date] = [];
    groups[r.date].push(r);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

  sortedDates.forEach(date => {
    const groupEl = document.createElement('div');
    groupEl.className = 'date-group';

    let dayIncome = 0;
    let dayExpense = 0;
    groups[date].forEach(r => {
      const amt = Number(r.amount) || 0;
      if (r.type === 'income') dayIncome += amt;
      else dayExpense += amt;
    });

    const dObj = new Date(date);
    const dateStr = !isNaN(dObj.getTime()) ? `${dObj.getMonth() + 1}/${dObj.getDate()}` : date;
    const diff = dayIncome - dayExpense;
    const diffStr = (diff >= 0 ? '+' : '') + diff.toLocaleString();

    groupEl.innerHTML = `
      <div class="date-group-header">
        <span>${dateStr}</span>
        <span>${diffStr}</span>
      </div>
    `;

    groups[date].forEach(r => {
      const itemEl = document.createElement('div');
      itemEl.className = 'record-item';
      itemEl.onclick = () => openEditModal(r.id);

      const isInc = r.type === 'income';
      const amt = Number(r.amount) || 0;
      itemEl.innerHTML = `
        <span>${r.memo || ''}</span>
        <div class="item-right">
          <span class="amount ${isInc ? 'positive' : 'negative'}">
            ${isInc ? '+' : '-'}${amt.toLocaleString()}
          </span>
          <i class="fa-solid fa-chevron-right arrow"></i>
        </div>
      `;
      groupEl.appendChild(itemEl);
    });

    container.appendChild(groupEl);
  });
}

// --- リスト描画（全期間画面用：毎日の明細を非表示にし、月毎の合計のみ一覧表示） ---
function renderMonthlySummaryOnlyList(recordList, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const fixedTotalPerMonth = fixedCosts.reduce((sum, f) => sum + (Number(f.monthlyAmount) || 0), 0);
  const monthGroups = {};

  recordList.forEach(r => {
    if (!r.date) return;
    const monthKey = r.date.substring(0, 7); // YYYY-MM
    if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
    monthGroups[monthKey].push(r);
  });

  const sortedMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

  sortedMonths.forEach(monthKey => {
    let monthIncome = 0;
    let monthExpense = 0;

    monthGroups[monthKey].forEach(r => {
      const amt = Number(r.amount) || 0;
      if (r.type === 'income') monthIncome += amt;
      else monthExpense += amt;
    });

    let monthNetTotal = 0;
    if (allFilter === 'income') {
      monthNetTotal = monthIncome;
    } else if (allFilter === 'expense') {
      monthNetTotal = -(monthExpense + fixedTotalPerMonth);
    } else {
      monthNetTotal = monthIncome - monthExpense - fixedTotalPerMonth;
    }

    const [y, m] = monthKey.split('-');
    const monthLabel = `${y}年${parseInt(m, 10)}月`;

    const itemEl = document.createElement('div');
    itemEl.className = 'record-item';
    itemEl.style.padding = '14px 12px';
    itemEl.style.marginBottom = '8px';
    itemEl.style.background = 'var(--card-bg, #ffffff)';
    itemEl.style.borderRadius = '8px';

    itemEl.onclick = () => {
      currentMonthlyDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      switchTab('monthly', document.querySelectorAll('.nav-item')[1]);
      renderMonthlyPage();
    };

    itemEl.innerHTML = `
      <span style="font-weight: bold; font-size: 15px;">${monthLabel}</span>
      <div class="item-right">
        <span class="amount ${monthNetTotal >= 0 ? 'positive' : 'negative'}" style="font-size: 15px;">
          ${monthNetTotal >= 0 ? '+' : ''}${monthNetTotal.toLocaleString()}
        </span>
        <i class="fa-solid fa-chevron-right arrow"></i>
      </div>
    `;

    container.appendChild(itemEl);
  });
}

// --- 記録 編集モーダル ---
function openEditModal(id) {
  const r = records.find(item => item.id === id);
  if (!r) return;

  editingRecordId = id;
  setEditType(r.type);
  document.getElementById('edit-date').value = r.date;
  document.getElementById('edit-amount').value = r.amount;
  document.getElementById('edit-memo').value = r.memo;

  document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
  editingRecordId = null;
}

function setEditType(type) {
  currentEditType = type;
  document.getElementById('edit-type-income').classList.toggle('active', type === 'income');
  document.getElementById('edit-type-expense').classList.toggle('active', type === 'expense');
}

function changeEditInputDate(offset) {
  const input = document.getElementById('edit-date');
  const dateVal = input.value ? new Date(input.value) : new Date();
  dateVal.setDate(dateVal.getDate() + offset);
  input.value = dateVal.toISOString().split('T')[0];
}

function setEditTodayDate() {
  document.getElementById('edit-date').value = new Date().toISOString().split('T')[0];
}

function saveEditRecord() {
  if (!editingRecordId) return;

  const date = document.getElementById('edit-date').value;
  const amount = parseFloat(document.getElementById('edit-amount').value);
  const memo = document.getElementById('edit-memo') ? document.getElementById('edit-memo').value.trim() : '';

  if (!date || isNaN(amount) || amount <= 0) {
    alert('日付と正しい金額を入力してください。');
    return;
  }

  const idx = records.findIndex(r => r.id === editingRecordId);
  if (idx !== -1) {
    records[idx] = {
      id: editingRecordId,
      date: date,
      type: currentEditType,
      amount: amount,
      memo: memo || (currentEditType === 'income' ? '収入' : '支出')
    };
    saveRecords();
  }

  closeEditModal();
}

function deleteCurrentRecord() {
  if (!editingRecordId) return;
  if (confirm('この記録を削除しますか？')) {
    records = records.filter(r => r.id !== editingRecordId);
    saveRecords();
    closeEditModal();
  }
}

function clearInput(id) {
  document.getElementById(id).value = '';
}

// --- 固定費画面 ---
function calcFixedAmount(mode) {
  const mInput = document.getElementById('fixed-monthly-input');
  const yInput = document.getElementById('fixed-yearly-input');

  if (mode === 'monthly') {
    const val = parseFloat(mInput.value);
    yInput.value = isNaN(val) ? '' : Math.round(val * 12);
  } else {
    const val = parseFloat(yInput.value);
    mInput.value = isNaN(val) ? '' : Math.round(val / 12);
  }
}

function addFixedCost() {
  const name = document.getElementById('fixed-name').value.trim();
  const mAmount = parseFloat(document.getElementById('fixed-monthly-input').value);

  if (!name || isNaN(mAmount) || mAmount <= 0) {
    alert('内容と金額を入力してください。');
    return;
  }

  fixedCosts.push({
    id: Date.now().toString(),
    name: name,
    monthlyAmount: mAmount
  });

  saveFixedCosts();
  document.getElementById('fixed-name').value = '';
  document.getElementById('fixed-monthly-input').value = '';
  document.getElementById('fixed-yearly-input').value = '';
}

function renderFixedPage() {
  const total = fixedCosts.reduce((sum, f) => sum + (Number(f.monthlyAmount) || 0), 0);
  document.getElementById('fixed-total-val').textContent = `-${total.toLocaleString()}`;

  const listEl = document.getElementById('fixed-cost-list');
  listEl.innerHTML = '';

  fixedCosts.forEach(f => {
    const item = document.createElement('div');
    item.className = 'fixed-item';
    item.onclick = () => openFixedEditModal(f.id);

    const mAmount = Number(f.monthlyAmount) || 0;

    item.innerHTML = `
      <div class="fixed-item-left">
        <span class="fixed-item-name">${f.name}</span>
        <span class="fixed-item-sub">年額: ${(mAmount * 12).toLocaleString()}</span>
      </div>
      <div class="fixed-item-right">
        <span class="amount negative">-${mAmount.toLocaleString()}</span>
        <i class="fa-solid fa-chevron-right arrow"></i>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function openFixedEditModal(id) {
  const f = fixedCosts.find(item => item.id === id);
  if (!f) return;

  editingFixedId = id;
  document.getElementById('edit-fixed-name').value = f.name;
  document.getElementById('edit-fixed-monthly').value = f.monthlyAmount;
  document.getElementById('edit-fixed-yearly').value = f.monthlyAmount * 12;

  document.getElementById('fixed-edit-modal').style.display = 'flex';
}

function closeFixedEditModal() {
  document.getElementById('fixed-edit-modal').style.display = 'none';
  editingFixedId = null;
}

function calcEditFixedAmount(mode) {
  const mInput = document.getElementById('edit-fixed-monthly');
  const yInput = document.getElementById('edit-fixed-yearly');

  if (mode === 'monthly') {
    const val = parseFloat(mInput.value);
    yInput.value = isNaN(val) ? '' : Math.round(val * 12);
  } else {
    const val = parseFloat(yInput.value);
    mInput.value = isNaN(val) ? '' : Math.round(val / 12);
  }
}

function saveEditFixedCost() {
  if (!editingFixedId) return;

  const name = document.getElementById('edit-fixed-name').value.trim();
  const mAmount = parseFloat(document.getElementById('edit-fixed-monthly').value);

  if (!name || isNaN(mAmount) || mAmount <= 0) {
    alert('内容と金額を入力してください。');
    return;
  }

  const idx = fixedCosts.findIndex(f => f.id === editingFixedId);
  if (idx !== -1) {
    fixedCosts[idx] = {
      id: editingFixedId,
      name: name,
      monthlyAmount: mAmount
    };
    saveFixedCosts();
  }

  closeFixedEditModal();
}

function deleteCurrentFixedCost() {
  if (!editingFixedId) return;
  if (confirm('この固定費を削除しますか？')) {
    fixedCosts = fixedCosts.filter(f => f.id !== editingFixedId);
    saveFixedCosts();
    closeFixedEditModal();
  }
}

// --- ドラムロール風 DatePicker ---
function openDatePicker() {
  const yearSelect = document.getElementById('picker-year');
  const monthSelect = document.getElementById('picker-month');

  yearSelect.innerHTML = '';
  monthSelect.innerHTML = '';

  const currentY = currentMonthlyDate.getFullYear();
  const currentM = currentMonthlyDate.getMonth() + 1;

  for (let y = currentY - 5; y <= currentY + 5; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y}年`;
    if (y === currentY) opt.selected = true;
    yearSelect.appendChild(opt);
  }

  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = `${m}月`;
    if (m === currentM) opt.selected = true;
    monthSelect.appendChild(opt);
  }

  document.getElementById('date-picker-modal').style.display = 'flex';
}

function closeDatePicker() {
  document.getElementById('date-picker-modal').style.display = 'none';
}

function applyDatePicker() {
  const y = parseInt(document.getElementById('picker-year').value);
  const m = parseInt(document.getElementById('picker-month').value) - 1;

  currentMonthlyDate = new Date(y, m, 1);
  renderMonthlyPage();
  closeDatePicker();
}

// --- データのエクスポート & インポート（スマホ対応版） ---
async function exportData() {
  const recordsData = JSON.parse(localStorage.getItem('kakeibo_records') || '[]');
  const fixedData = JSON.parse(localStorage.getItem('kakeibo_fixed_costs') || '[]');

  const exportObj = {
    records: recordsData,
    fixedCosts: fixedData,
    exportedAt: new Date().toISOString()
  };

  const jsonString = JSON.stringify(exportObj, null, 2);
  const fileName = `kakeibo_backup_${new Date().toISOString().slice(0, 10)}.json`;

  // スマホの共有機能を優先的に使用
  if (navigator.canShare && navigator.canShare({ files: [new File([], '')] })) {
    try {
      const file = new File([jsonString], fileName, { type: 'application/json' });
      await navigator.share({
        files: [file],
        title: '家計簿バックアップデータ',
        text: '家計簿アプリのバックアップデータです。'
      });
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('ファイル共有が不可能なため、ブラウザダウンロードを試行します', err);
      } else {
        return;
      }
    }
  }

  // フォールバック：ブラウザダウンロード
  try {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    // ファイル生成もブロックされるスマホブラウザの場合、クリップボードにコピー
    navigator.clipboard.writeText(jsonString).then(() => {
      alert('バックアップテキストをクリップボードにコピーしました。メモ帳等に貼り付けて保存してください。');
    }).catch(() => {
      alert('エクスポートに失敗しました。');
    });
  }
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);

      if (Array.isArray(importedData.records) && Array.isArray(importedData.fixedCosts)) {
        if (confirm('現在のデータを上書きして、選択したバックアップデータを復元しますか？')) {
          localStorage.setItem('kakeibo_records', JSON.stringify(importedData.records));
          localStorage.setItem('kakeibo_fixed_costs', JSON.stringify(importedData.fixedCosts));
          
          alert('データの読み込みが完了しました！');
          location.reload();
        }
      } else {
        alert('正しい家計簿バックアップファイル（JSON）ではありません。');
      }
    } catch (err) {
      alert('ファイルの読み込みに失敗しました。正しいJSONファイルを選択してください。');
    }
  };
  reader.readAsText(file);
}
