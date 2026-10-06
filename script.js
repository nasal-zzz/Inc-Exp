(function () {
  'use strict';

  var STORAGE_KEY = 'income-expense-tracker-v1';
  var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var PERIODS = [
    { key: 'morning', label: 'Morning', input: 'exMorning' },
    { key: 'afternoon', label: 'Afternoon', input: 'exAfternoon' },
    { key: 'evening', label: 'Evening', input: 'exEvening' },
    { key: 'night', label: 'Night', input: 'exNight' }
  ];

  var ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var ICON_DEL = '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

  /* ---------- Storage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { income: [], expenses: [] };
      var data = JSON.parse(raw);
      return {
        income: Array.isArray(data.income) ? data.income : [],
        expenses: Array.isArray(data.expenses) ? data.expenses : []
      };
    } catch (e) {
      return { income: [], expenses: [] };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      alert('Could not save data. Storage may be full or disabled.');
    }
  }

  var state = load(); // read only, nothing is written on page load

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function money(n) {
    var neg = n < 0;
    var s = Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return (neg ? '-' : '') + '₹' + s;
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function prettyDate(iso) {
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    return p[2] + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function dayTotal(e) {
    return num(e.morning) + num(e.afternoon) + num(e.evening) + num(e.night);
  }

  /* ---------- Render ---------- */
  function render() {
    var incomeSum = state.income.reduce(function (t, i) { return t + num(i.amount); }, 0);
    var expenseSum = state.expenses.reduce(function (t, e) { return t + dayTotal(e); }, 0);
    var balance = incomeSum - expenseSum;

    $('incomeTotal').textContent = money(incomeSum);
    $('expenseTotal').textContent = money(expenseSum);
    var bal = $('balanceTotal');
    bal.textContent = money(balance);
    bal.classList.toggle('negative', balance < 0);

    renderExpenses();
    renderIncome();
  }

  function renderExpenses() {
    var list = $('expenseList');
    var items = state.expenses.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><strong>No transactions yet</strong>Tap Add Expense to log your first day.</div>';
      return;
    }

    list.innerHTML = items.map(function (e) {
      var rows = PERIODS.map(function (p) {
        var v = num(e[p.key]);
        return '<div class="row' + (v ? '' : ' empty') + '"><span>' + p.label + '</span><b>' + (v ? money(v) : '—') + '</b></div>';
      }).join('');

      return '<article class="entry">' +
        '<div class="entry-head">' +
          '<span class="entry-date">' + prettyDate(e.date) + '</span>' +
          '<div class="entry-actions">' +
            '<button class="icon-btn" data-act="edit-expense" data-id="' + esc(e.id) + '" aria-label="Edit expense">' + ICON_EDIT + '</button>' +
            '<button class="icon-btn del" data-act="del-expense" data-id="' + esc(e.id) + '" aria-label="Delete expense">' + ICON_DEL + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="rows">' + rows + '</div>' +
        '<div class="total-row"><span>TOTAL</span><b>' + money(dayTotal(e)) + '</b></div>' +
      '</article>';
    }).join('');
  }

  function renderIncome() {
    var list = $('incomeList');
    var items = state.income.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><strong>No transactions yet</strong>Tap Add Income to record money you received.</div>';
      return;
    }

    list.innerHTML = items.map(function (i) {
      return '<article class="entry inc">' +
        '<div class="entry-head">' +
          '<span class="entry-date">' + prettyDate(i.date) + '</span>' +
          '<div class="entry-actions">' +
            '<button class="icon-btn" data-act="edit-income" data-id="' + esc(i.id) + '" aria-label="Edit income">' + ICON_EDIT + '</button>' +
            '<button class="icon-btn del" data-act="del-income" data-id="' + esc(i.id) + '" aria-label="Delete income">' + ICON_DEL + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="entry-main"><div>' +
          '<div class="inc-amount">' + money(num(i.amount)) + '</div>' +
          (i.note ? '<p class="inc-note">' + esc(i.note) + '</p>' : '') +
        '</div></div>' +
      '</article>';
    }).join('');
  }

  /* ---------- Tabs ---------- */
  function showTab(name) {
    var isExp = name === 'expenses';
    $('tabExpenses').classList.toggle('active', isExp);
    $('tabExpenses').setAttribute('aria-selected', isExp);
    $('tabIncome').classList.toggle('active', !isExp);
    $('tabIncome').setAttribute('aria-selected', !isExp);
    $('expensesPanel').hidden = !isExp;
    $('incomePanel').hidden = isExp;
  }

  $('tabExpenses').addEventListener('click', function () { showTab('expenses'); });
  $('tabIncome').addEventListener('click', function () { showTab('income'); });

  /* ---------- Sheets ---------- */
  function openSheet(id) {
    $(id).hidden = false;
    document.body.classList.add('locked');
  }

  function closeSheet(id) {
    $(id).hidden = true;
    if (!document.querySelector('.overlay:not([hidden])')) {
      document.body.classList.remove('locked');
    }
  }

  function closeAll() {
    ['incomeModal', 'expenseModal', 'confirmModal'].forEach(closeSheet);
  }

  document.querySelectorAll('.overlay').forEach(function (ov) {
    ov.addEventListener('click', function (e) {
      if (e.target === ov) closeSheet(ov.id);
    });
  });

  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', closeAll);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });

  /* ---------- Income ---------- */
  var editingIncome = null;

  function openIncome(item) {
    editingIncome = item ? item.id : null;
    $('incomeTitle').textContent = item ? 'Edit Income' : 'Add Income';
    $('incomeAmount').value = item ? item.amount : '';
    $('incomeDate').value = item ? item.date : todayISO();
    $('incomeNote').value = item ? (item.note || '') : '';
    $('incomeError').textContent = '';
    openSheet('incomeModal');
    setTimeout(function () { $('incomeAmount').focus(); }, 120);
  }

  $('addIncomeBtn').addEventListener('click', function () { openIncome(null); });

  $('incomeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var amount = num($('incomeAmount').value);
    var date = $('incomeDate').value;
    var note = $('incomeNote').value.trim();

    if (!amount) { $('incomeError').textContent = 'Enter an amount greater than 0.'; return; }
    if (!date) { $('incomeError').textContent = 'Choose a date.'; return; }

    if (editingIncome) {
      state.income = state.income.map(function (i) {
        return i.id === editingIncome ? { id: i.id, amount: amount, date: date, note: note } : i;
      });
    } else {
      state.income.push({ id: uid(), amount: amount, date: date, note: note });
    }

    save();
    render();
    closeSheet('incomeModal');
    showTab('income');
  });

  /* ---------- Expense ---------- */
  var editingExpense = null;

  function updateDayTotal() {
    var t = 0;
    PERIODS.forEach(function (p) { t += num($(p.input).value); });
    $('expenseDayTotal').textContent = money(t);
  }

  function fillExpense(item) {
    PERIODS.forEach(function (p) {
      var v = item ? num(item[p.key]) : 0;
      $(p.input).value = v ? v : '';
    });
    updateDayTotal();
  }

  function openExpense(item) {
    editingExpense = item ? item.id : null;
    $('expenseTitle').textContent = item ? 'Edit Expense' : 'Add Expense';
    $('expenseDate').value = item ? item.date : todayISO();
    fillExpense(item);
    $('expenseError').textContent = '';
    openSheet('expenseModal');
  }

  $('addExpenseBtn').addEventListener('click', function () { openExpense(null); });

  PERIODS.forEach(function (p) {
    $(p.input).addEventListener('input', updateDayTotal);
  });

  // Picking a date that already has an entry loads it, so each day stays as one card.
  $('expenseDate').addEventListener('change', function () {
    var d = $('expenseDate').value;
    var existing = state.expenses.filter(function (x) { return x.date === d; })[0];
    if (existing && existing.id !== editingExpense) {
      editingExpense = existing.id;
      $('expenseTitle').textContent = 'Edit Expense';
      fillExpense(existing);
    }
  });

  $('expenseForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var date = $('expenseDate').value;
    var entry = { date: date };
    var total = 0;

    PERIODS.forEach(function (p) {
      entry[p.key] = num($(p.input).value);
      total += entry[p.key];
    });

    if (!date) { $('expenseError').textContent = 'Choose a date.'; return; }
    if (!total) { $('expenseError').textContent = 'Enter at least one amount.'; return; }

    if (editingExpense) {
      entry.id = editingExpense;
      state.expenses = state.expenses.map(function (x) { return x.id === editingExpense ? entry : x; });
    } else {
      entry.id = uid();
      state.expenses.push(entry);
    }

    save();
    render();
    closeSheet('expenseModal');
    showTab('expenses');
  });

  /* ---------- List actions (edit / delete) ---------- */
  var pendingConfirm = null;

  function askConfirm(title, sub, onOk) {
    $('confirmText').textContent = title;
    $('confirmSub').textContent = sub;
    pendingConfirm = onOk;
    openSheet('confirmModal');
  }

  $('confirmCancel').addEventListener('click', function () {
    pendingConfirm = null;
    closeSheet('confirmModal');
  });

  $('confirmOk').addEventListener('click', function () {
    var fn = pendingConfirm;
    pendingConfirm = null;
    closeSheet('confirmModal');
    if (fn) fn();
  });

  function onListClick(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');

    if (act === 'edit-expense') {
      var ex = state.expenses.filter(function (x) { return x.id === id; })[0];
      if (ex) openExpense(ex);
    } else if (act === 'edit-income') {
      var inc = state.income.filter(function (x) { return x.id === id; })[0];
      if (inc) openIncome(inc);
    } else if (act === 'del-expense') {
      askConfirm('Delete this expense?', 'This cannot be undone.', function () {
        state.expenses = state.expenses.filter(function (x) { return x.id !== id; });
        save();
        render();
      });
    } else if (act === 'del-income') {
      askConfirm('Delete this income?', 'This cannot be undone.', function () {
        state.income = state.income.filter(function (x) { return x.id !== id; });
        save();
        render();
      });
    }
  }

  $('expenseList').addEventListener('click', onListClick);
  $('incomeList').addEventListener('click', onListClick);

  /* ---------- Clear all ---------- */
  $('clearAllBtn').addEventListener('click', function () {
    askConfirm('Delete all saved data?', 'All income and expenses will be removed. This cannot be undone.', function () {
      state = { income: [], expenses: [] };
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      render();
    });
  });

  /* ---------- Start ---------- */
  render();
})();
