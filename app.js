// ローカルストレージキー
const STORAGE_KEY = 'kakeibo_records';
const FIXED_STORAGE_KEY = 'kakeibo_fixed_costs';

// 状態管理
let records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let fixedCosts = JSON.parse(localStorage.getItem(FIXED_STORAGE_KEY)) || [];

let currentType = 'expense';
let currentMonth = new Date();
let monthlyFilter = 'both';
let allFilter = 'both';
let editingRecordId = null;
let editType = 'expense';

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  setTodayDate();
  updateTypeUI();
  renderAll();
});

function renderAll() {
  renderRecordSummary();
  renderMonthly();
  renderAllPeriod();
  renderFixedCosts();
}

// データ保存
function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function saveFixedCosts() {
  localStorage.setItem(FIXED_STORAGE_KEY, JSON.stringify(fixedCosts));
}

// --------------------------------------------------
// 1. 記録（入力）機能
// --------------------------------------------------
function setType(type) {
  currentType = type;
  updateTypeUI();
}

function updateTypeUI() {
  const incBtn = document.getElementById('type-income');
  const expBtn = document.getElementById('type-expense');
  const amountInput = document.getElementById('entry-amount');

  if (currentType === 'income') {
    incBtn.classList.add('active');
    expBtn.classList.remove('active');
    amountInput.placeholder = '収入額';
  } else {
    expBtn.classList.add('active');
    incBtn.classList.remove('active');
    amountInput.placeholder = '支出額';
  }
}

function setTodayDate() {
  const d = new Date();
  document.getElementById('entry-date').value = d.toISOString().split('T')[0];
}

// 「前日」「翌日」ボタン（選択中日付を基準に加減算）
function changeInputDate(offsetDays) {
  const dateInput = document.getElementById('entry-date');
  let currentVal = dateInput.value;
  let d = currentVal ? new Date(currentVal) : new Date();
  d.setDate(d.getDate() + offsetDays);
  dateInput.value = d.toISOString().split('T')[0];
}

function addRecord() {
  const date = document.getElementById('entry-date').value;
  const amountVal = parseFloat(document.getElementById('entry-amount').value);
  const memo = document.getElementById('entry-memo').value.trim();

  // 異常値チェック（異常時はアラート表示）
  if (!date || isNaN(amountVal) || amountVal <= 0 || !memo) {
    alert('日付、金額、内容を正しく入力してください。');
    return;
  }

  const record = {
    id: Date.now(),
    date: date,
    type: currentType,
    amount: amountVal,
    memo: memo
  };

  records.push(record);
  saveRecords();

  // 正常時はアラートを出さずにフォームリセット
  document.getElementById('entry-amount').value = '';
  document.getElementById('entry-memo').value = '';

  renderAll();
}

// 今月の残高表示（固定費差し引き後）
function renderRecordSummary() {
  const now = new Date();
  const yearMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthRecords = records.filter(r => r.date.startsWith(yearMonthPrefix));
  let total = 0;
  monthRecords.forEach(r => {
    total += (r.type === 'expense') ? -r.amount : r.amount;
  });

  const fixedTotal = getFixedCostMonthlyTotal();
  const finalBalance = total - fixedTotal;

  const balanceEl = document.getElementById('record-month-balance');
  balanceEl.innerText = formatAmount(finalBalance);
  balanceEl.className = `info-val ${finalBalance < 0 ? 'negative' : 'positive'}`;
}

// --------------------------------------------------
// 2. 月間機能
// --------------------------------------------------
function changeMonth(offset) {
  currentMonth.setMonth(currentMonth.getMonth() + offset);
  renderMonthly();
}

function setMonthlyFilter(filter) {
  monthlyFilter = filter;
  ['income', 'both', 'expense'].forEach(f => {
    document.getElementById(`m-filter-${f}`).classList.toggle('active', f === filter);
  });
  renderMonthly();
}

function renderMonthly() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;
  const yearMonthStr = `${year}年${month}月`;
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  document.getElementById('monthly-title').innerText = yearMonthStr;
  document.getElementById('monthly-summary-label').innerText = yearMonthStr;

  const monthRecords = records.filter(r => r.date.startsWith(prefix) && filterCheck(r.type, monthlyFilter));

  let total = 0;
  monthRecords.forEach(r => {
    total += (r.type === 'expense') ? -r.amount : r.amount;
  });

  // 固定費の差し引き
  const fixedTotal = getFixedCostMonthlyTotal();
  const finalTotal = total - fixedTotal;

  const totalEl = document.getElementById('monthly-total-amount');
  totalEl.innerText = `合計 ${formatAmount(finalTotal)}`;
  totalEl.className = `amount ${finalTotal < 0 ? 'negative' : 'positive'}`;

  const fixedEl = document.getElementById('monthly-fixed-cost-val');
  fixedEl.innerText = `-${fixedTotal.toLocaleString()}`;

  // 日別リスト生成
  const listEl = document.getElementById('monthly-list');
  listEl.innerHTML = '';

  const grouped = groupByDate(monthRecords);
  Object.keys(grouped).sort().reverse().forEach(date => {
    const dayRecords = grouped[date];
    const dayTotal = dayRecords.reduce((sum, r) => sum + (r.type === 'expense' ? -r.amount : r.amount), 0);

    let html = `
      <div class="date-group">
        <div class="date-group-header">
          <span>${formatJapaneseDate(date)}</span>
          <span>合計 ${formatAmount(dayTotal)}</span>
        </div>
    `;

    dayRecords.forEach(r => {
      const displayAmt = r.type === 'expense' ? -r.amount : r.amount;
      html += `
        <div class="record-item" onclick="openEditModal(${r.id})">
          <span>${escapeHtml(r.memo)}</span>
          <div class="item-right">
            <span class="amount ${displayAmt < 0 ? 'negative' : 'positive'}">${formatAmount(displayAmt)}</span>
            <span class="arrow"><i class="fa-solid fa-chevron-right"></i></span>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    listEl.insertAdjacentHTML('beforeend', html);
  });
}

// --- 年月ドラムロール風選択モーダル ---
function openDatePicker() {
  const modal = document.getElementById('date-picker-modal');
  const yearSelect = document.getElementById('picker-year');
  const monthSelect = document.getElementById('picker-month');

  yearSelect.innerHTML = '';
  monthSelect.innerHTML = '';

  const currentY = currentMonth.getFullYear();
  for (let y = currentY - 10; y <= currentY + 10; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.innerText = `${y}年`;
    if (y === currentY) opt.selected = true;
    yearSelect.appendChild(opt);
  }

  const currentM = currentMonth.getMonth() + 1;
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.innerText = `${m}月`;
    if (m === currentM) opt.selected = true;
    monthSelect.appendChild(opt);
  }

  modal.style.display = 'flex';
}

function closeDatePicker() {
  document.getElementById('date-picker-modal').style.display = 'none';
}

function applyDatePicker() {
  const y = parseInt(document.getElementById('picker-year').value, 10);
  const m = parseInt(document.getElementById('picker-month').value, 10) - 1;
  currentMonth = new Date(y, m, 1);
  closeDatePicker();
  renderMonthly();
}

// --------------------------------------------------
// 3. 全期間機能
// --------------------------------------------------
function setAllFilter(filter) {
  allFilter = filter;
  ['income', 'both', 'expense'].forEach(f => {
    document.getElementById(`a-filter-${f}`).classList.toggle('active', f === filter);
  });
  renderAllPeriod();
}

function renderAllPeriod() {
  const filtered = records.filter(r => filterCheck(r.type, allFilter));

  let total = 0;
  filtered.forEach(r => {
    total += (r.type === 'expense') ? -r.amount : r.amount;
  });

  const totalEl = document.getElementById('all-total-amount');
  totalEl.innerText = `合計 ${formatAmount(total)}`;
  totalEl.className = `amount ${total < 0 ? 'negative' : 'positive'}`;

  const grouped = {};
  filtered.forEach(r => {
    const [y, m] = r.date.split('-');
    if (!grouped[y]) grouped[y] = {};
    if (!grouped[y][m]) grouped[y][m] = [];
    grouped[y][m].push(r);
  });

  const listEl = document.getElementById('all-period-list');
  listEl.innerHTML = '';

  Object.keys(grouped).sort().reverse().forEach(year => {
    let yearTotal = 0;
    let monthHtml = '';

    Object.keys(grouped[year]).sort().reverse().forEach(month => {
      const mRecords = grouped[year][month];
      const mTotal = mRecords.reduce((sum, r) => sum + (r.type === 'expense' ? -r.amount : r.amount), 0);
      yearTotal += mTotal;

      monthHtml += `
        <div class="record-item">
          <span>${parseInt(month, 10)}月</span>
          <span class="amount ${mTotal < 0 ? 'negative' : 'positive'}">${formatAmount(mTotal)}</span>
        </div>
      `;
    });

    const yearBlock = `
      <div class="date-group">
        <div class="date-group-header">
          <span>${year}年</span>
          <span>合計 ${formatAmount(yearTotal)}</span>
        </div>
        ${monthHtml}
      </div>
    `;
    listEl.insertAdjacentHTML('beforeend', yearBlock);
  });
}

// --------------------------------------------------
// 4. 固定費機能
// --------------------------------------------------
function calcFixedAmount(source) {
  const mInput = document.getElementById('fixed-monthly-input');
  const yInput = document.getElementById('fixed-yearly-input');

  if (source === 'monthly') {
    const mVal = parseFloat(mInput.value);
    yInput.value = isNaN(mVal) ? '' : Math.round(mVal * 12);
  } else {
    const yVal = parseFloat(yInput.value);
    mInput.value = isNaN(yVal) ? '' : Math.round(yVal / 12);
  }
}

function addFixedCost() {
  const name = document.getElementById('fixed-name').value.trim();
  const monthlyVal = parseFloat(document.getElementById('fixed-monthly-input').value);

  if (!name || isNaN(monthlyVal) || monthlyVal <= 0) {
    alert('内容と月額（または年額）を正しく入力してください。');
    return;
  }

  const item = {
    id: Date.now(),
    name: name,
    monthly: monthlyVal
  };

  fixedCosts.push(item);
  saveFixedCosts();

  // フォームクリア
  document.getElementById('fixed-name').value = '';
  document.getElementById('fixed-monthly-input').value = '';
  document.getElementById('fixed-yearly-input').value = '';

  renderAll();
}

function deleteFixedCost(id) {
  if (confirm('この固定費を削除しますか？')) {
    fixedCosts = fixedCosts.filter(f => f.id !== id);
    saveFixedCosts();
    renderAll();
  }
}

function getFixedCostMonthlyTotal() {
  return fixedCosts.reduce((sum, f) => sum + f.monthly, 0);
}

function renderFixedCosts() {
  const total = getFixedCostMonthlyTotal();
  document.getElementById('fixed-total-val').innerText = `-${total.toLocaleString()} 円`;

  const listEl = document.getElementById('fixed-cost-list');
  listEl.innerHTML = '';

  fixedCosts.forEach(item => {
    const yearly = item.monthly * 12;
    const html = `
      <div class="fixed-item">
        <div class="fixed-item-left">
          <span class="fixed-item-name">${escapeHtml(item.name)}</span>
          <span class="fixed-item-sub">年額: -${yearly.toLocaleString()}円</span>
        </div>
        <div class="fixed-item-right">
          <span class="amount negative">-${item.monthly.toLocaleString()}円</span>
          <button class="btn-icon-delete" onclick="deleteFixedCost(${item.id})"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    `;
    listEl.insertAdjacentHTML('beforeend', html);
  });
}

// --------------------------------------------------
// 5. 編集モーダル機能
// --------------------------------------------------
function openEditModal(id) {
  const r = records.find(item => item.id === id);
  if (!r) return;

  editingRecordId = id;
  editType = r.type;
  updateEditTypeUI();

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
  editType = type;
  updateEditTypeUI();
}

function updateEditTypeUI() {
  const incBtn = document.getElementById('edit-type-income');
  const expBtn = document.getElementById('edit-type-expense');
  if (editType === 'income') {
    incBtn.classList.add('active');
    expBtn.classList.remove('active');
  } else {
    expBtn.classList.add('active');
    incBtn.classList.remove('active');
  }
}

function changeEditInputDate(offsetDays) {
  const dateInput = document.getElementById('edit-date');
  let currentVal = dateInput.value;
  let d = currentVal ? new Date(currentVal) : new Date();
  d.setDate(d.getDate() + offsetDays);
  dateInput.value = d.toISOString().split('T')[0];
}

function setEditTodayDate() {
  document.getElementById('edit-date').value = new Date().toISOString().split('T')[0];
}

function clearInput(id) {
  document.getElementById(id).value = '';
}

function saveEditRecord() {
  const date = document.getElementById('edit-date').value;
  const amountVal = parseFloat(document.getElementById('edit-amount').value);
  const memo = document.getElementById('edit-memo').value.trim();

  if (!date || isNaN(amountVal) || amountVal <= 0 || !memo) {
    alert('日付、金額、内容を正しく入力してください。');
    return;
  }

  const idx = records.findIndex(r => r.id === editingRecordId);
  if (idx !== -1) {
    records[idx] = {
      id: editingRecordId,
      date: date,
      type: editType,
      amount: amountVal,
      memo: memo
    };
    saveRecords();
    closeEditModal();
    renderAll();
  }
}

function deleteCurrentRecord() {
  if (confirm('この記録を削除しますか？')) {
    records = records.filter(r => r.id !== editingRecordId);
    saveRecords();
    closeEditModal();
    renderAll();
  }
}

// --------------------------------------------------
// 6. 全般・設定機能
// --------------------------------------------------
function switchTab(tabName, element) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${tabName}`).classList.add('active');
  element.classList.add('active');

  renderAll();
}

function filterCheck(type, filter) {
  if (filter === 'both') return true;
  return type === filter;
}

function groupByDate(recordsArr) {
  return recordsArr.reduce((acc, r) => {
    (acc[r.date] = acc[r.date] || []).push(r);
    return acc;
  }, {});
}

function formatAmount(num) {
  const sign = num < 0 ? '-' : '';
  return `${sign}${Math.abs(num).toLocaleString()}`;
}

function formatJapaneseDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function exportData() {
  const exportPayload = { records, fixedCosts };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kakeibo_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function clearAllData() {
  if (confirm('すべての記録と固定費データを削除してもよろしいですか？')) {
    records = [];
    fixedCosts = [];
    saveRecords();
    saveFixedCosts();
    renderAll();
    alert('削除が完了しました');
  }
}
