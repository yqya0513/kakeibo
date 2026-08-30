// ローカルストレージキー
const STORAGE_KEY = 'kakeibo_records';

// 状態管理
let records = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let currentType = 'expense';
let currentMonth = new Date();
let monthlyFilter = 'both';
let allFilter = 'both';

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  setShortcutDate(0);
  updateTypeUI();
  renderMonthly();
  renderAllPeriod();
});

// 入力タイプ切替（収入 / 支出）
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

// 日付ショートカット
function setShortcutDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const formatted = d.toISOString().split('T')[0];
  document.getElementById('entry-date').value = formatted;
}

// 記録追加
function addRecord() {
  const date = document.getElementById('entry-date').value;
  const amountVal = parseFloat(document.getElementById('entry-amount').value);
  const memo = document.getElementById('entry-memo').value.trim();

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

  // フォームリセット
  document.getElementById('entry-amount').value = '';
  document.getElementById('entry-memo').value = '';
  alert('記録しました');

  renderMonthly();
  renderAllPeriod();
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// タブ切り替え
function switchTab(tabName, element) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`page-${tabName}`).classList.add('active');
  element.classList.add('active');

  if (tabName === 'monthly') renderMonthly();
  if (tabName === 'all') renderAllPeriod();
}

// --- 月間表示機能 ---
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

  // 月別データの抽出
  const monthRecords = records.filter(r => r.date.startsWith(prefix) && filterCheck(r.type, monthlyFilter));

  // 合計計算
  let total = 0;
  monthRecords.forEach(r => {
    total += (r.type === 'expense') ? -r.amount : r.amount;
  });

  const totalEl = document.getElementById('monthly-total-amount');
  totalEl.innerText = `合計 ${formatAmount(total)}`;
  totalEl.className = `amount ${total < 0 ? 'negative' : 'positive'}`;

  // 日付順グループ化
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
        <div class="record-item">
          <span>${escapeHtml(r.memo)}</span>
          <span class="amount ${displayAmt < 0 ? 'negative' : 'positive'}">${formatAmount(displayAmt)}</span>
        </div>
      `;
    });

    html += `</div>`;
    listEl.insertAdjacentHTML('beforeend', html);
  });
}

// --- 全期間表示機能 ---
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

  // 年・月でネストしてグループ化
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

// ユーティリティ関数
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

// 設定機能
function exportData() {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kakeibo_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function clearAllData() {
  if (confirm('すべての記録を削除してもよろしいですか？')) {
    records = [];
    saveRecords();
    renderMonthly();
    renderAllPeriod();
    alert('削除が完了しました');
  }
}