(function () {
  'use strict';

  // Same key as before, so data saved by the earlier version is kept.
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
  var ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /* ---------- Storage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { income: [], expenses: [] };
      var data = JSON.parse(raw);
      var expenses = Array.isArray(data.expenses) ? data.expenses : [];
      expenses.forEach(function (e) {
        if (!Array.isArray(e.others)) e.others = [];
        if (!e.incomeId) e.incomeId = '';
      });
      return {
        income: Array.isArray(data.income) ? data.income : [],
        expenses: expenses
      };
    } catch (err) {
      return { income: [], expenses: [] };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      alert('Could not save data. Storage may be full or disabled.');
    }
  }

  var state = load(); // read only, nothing is written on page load
  var currentDetail = null;
  var lastIncomeId = '';

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

  function findIncome(id) {
    if (!id) return null;
    return state.income.filter(function (i) { return i.id === id; })[0] || null;
  }

  function incomeName(inc) { return (inc && inc.note) ? inc.note : 'Income'; }

  function othersTotal(e) {
    return (e.others || []).reduce(function (t, o) { return t + num(o.amount); }, 0);
  }

  function dayTotal(e) {
    return num(e.morning) + num(e.afternoon) + num(e.evening) + num(e.night) + othersTotal(e);
  }

  function spentFor(incomeId, skipExpenseId) {
    return state.expenses.reduce(function (t, e) {
      if (e.incomeId === incomeId && e.id !== skipExpenseId) return t + dayTotal(e);
      return t;
    }, 0);
  }

  function byDateDesc(a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); }
  function byDateAsc(a, b) { return a.date > b.date ? 1 : (a.date < b.date ? -1 : 0); }

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
    if (currentDetail) renderDetail();
  }

  function expenseCard(e, showChip) {
    var inc = findIncome(e.incomeId);
    var chip = showChip
      ? '<span class="chip' + (inc ? '' : ' unlinked') + '">' + (inc ? esc(incomeName(inc)) : 'Not linked') + '</span>'
      : '';

    var rows = PERIODS.map(function (p) {
      var v = num(e[p.key]);
      return '<div class="row' + (v ? '' : ' empty') + '"><span>' + p.label + '</span><b>' + (v ? money(v) : '—') + '</b></div>';
    }).join('');

    var others = (e.others || []).filter(function (o) { return num(o.amount) > 0; });
    var othersHtml = others.length
      ? '<div class="others">' + others.map(function (o) {
          return '<div class="row"><span>' + esc(o.name || 'Other') + '</span><b>' + money(num(o.amount)) + '</b></div>';
        }).join('') + '</div>'
      : '';

    return '<article class="entry">' +
      '<div class="entry-head">' +
        '<div class="entry-title"><span class="entry-date">' + prettyDate(e.date) + '</span>' + chip + '</div>' +
        '<div class="entry-actions">' +
          '<button class="icon-btn" data-act="edit-expense" data-id="' + esc(e.id) + '" aria-label="Edit expense">' + ICON_EDIT + '</button>' +
          '<button class="icon-btn del" data-act="del-expense" data-id="' + esc(e.id) + '" aria-label="Delete expense">' + ICON_DEL + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="rows">' + rows + othersHtml + '</div>' +
      '<div class="total-row"><span>TOTAL</span><b>' + money(dayTotal(e)) + '</b></div>' +
    '</article>';
  }

  function renderExpenses() {
    var list = $('expenseList');
    var items = state.expenses.slice().sort(byDateDesc);

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><strong>No transactions yet</strong>Tap Add Expense to log your first day.</div>';
      return;
    }
    list.innerHTML = items.map(function (e) { return expenseCard(e, true); }).join('');
  }

  function renderIncome() {
    var list = $('incomeList');
    var items = state.income.slice().sort(byDateDesc);

    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><strong>No transactions yet</strong>Tap Add Income to record money you received.</div>';
      return;
    }

    list.innerHTML = items.map(function (i) {
      var amount = num(i.amount);
      var spent = spentFor(i.id);
      var balance = amount - spent;
      var pct = amount > 0 ? Math.min(100, Math.round((spent / amount) * 100)) : (spent > 0 ? 100 : 0);

      return '<article class="entry">' +
        '<div class="entry-head">' +
          '<div class="entry-title"><span class="entry-date">' + prettyDate(i.date) + '</span></div>' +
          '<div class="entry-actions">' +
            '<button class="icon-btn" data-act="edit-income" data-id="' + esc(i.id) + '" aria-label="Edit income">' + ICON_EDIT + '</button>' +
            '<button class="icon-btn del" data-act="del-income" data-id="' + esc(i.id) + '" aria-label="Delete income">' + ICON_DEL + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="inc-name">' + esc(incomeName(i)) + '</div>' +
        '<div class="inc-amount">' + money(amount) + '</div>' +
        '<div class="bar' + (balance < 0 ? ' over' : '') + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="inc-stats">' +
          '<div class="stat spent"><small>Spent</small><b>' + money(spent) + '</b></div>' +
          '<div class="stat bal' + (balance < 0 ? ' negative' : '') + '"><small>Balance</small><b>' + money(balance) + '</b></div>' +
        '</div>' +
        '<button type="button" class="btn btn-ghost sm" data-act="detail" data-id="' + esc(i.id) + '">View details</button>' +
      '</article>';
    }).join('');
  }

  function renderDetail() {
    var inc = findIncome(currentDetail);
    if (!inc) { closeSheet('detailModal'); return; }

    var amount = num(inc.amount);
    var spent = spentFor(inc.id);
    var balance = amount - spent;

    $('detailTitle').textContent = incomeName(inc);
    $('detailDate').textContent = prettyDate(inc.date);
    $('detailIncome').textContent = money(amount);
    $('detailSpent').textContent = money(spent);
    $('detailBalance').textContent = money(balance);
    $('detailBalBox').classList.toggle('negative', balance < 0);

    var items = state.expenses.filter(function (e) { return e.incomeId === inc.id; }).sort(byDateDesc);
    $('detailList').innerHTML = items.length
      ? items.map(function (e) { return expenseCard(e, false); }).join('')
      : '<div class="empty-state"><strong>No expenses yet</strong>Tap Add expense to spend from this income.</div>';
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
    if (id === 'detailModal') currentDetail = null;
    if (!document.querySelector('.overlay:not([hidden])')) {
      document.body.classList.remove('locked');
    }
  }

  document.querySelectorAll('.overlay').forEach(function (ov) {
    ov.addEventListener('click', function (e) {
      if (e.target === ov) closeSheet(ov.id);
    });
  });

  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () {
      var ov = b.closest('.overlay');
      if (ov) closeSheet(ov.id);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelectorAll('.overlay:not([hidden])');
    if (open.length) closeSheet(open[open.length - 1].id);
  });

  /* ---------- Income form ---------- */
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
      var id = uid();
      state.income.push({ id: id, amount: amount, date: date, note: note });
      lastIncomeId = id;
    }

    save();
    render();
    closeSheet('incomeModal');
    showTab('income');
  });

  /* ---------- Expense form ---------- */
  var editingExpense = null;

  function addOtherRow(name, amount) {
    var row = document.createElement('div');
    row.className = 'other-row';
    row.innerHTML =
      '<input type="text" class="o-name" maxlength="40" placeholder="Name (e.g. Tea)" autocomplete="off" aria-label="Expense name" />' +
      '<input type="number" class="o-amt" inputmode="decimal" min="0" step="any" placeholder="₹" aria-label="Amount" />' +
      '<button type="button" class="icon-btn del o-del" aria-label="Remove">' + ICON_X + '</button>';
    row.querySelector('.o-name').value = name || '';
    row.querySelector('.o-amt').value = amount ? amount : '';
    $('otherRows').appendChild(row);
    return row;
  }

  function collectOthers() {
    var out = [];
    $('otherRows').querySelectorAll('.other-row').forEach(function (row) {
      var amount = num(row.querySelector('.o-amt').value);
      if (!amount) return;
      var name = row.querySelector('.o-name').value.trim() || 'Other';
      out.push({ name: name, amount: amount });
    });
    return out;
  }

  function formTotal() {
    var t = 0;
    PERIODS.forEach(function (p) { t += num($(p.input).value); });
    collectOthers().forEach(function (o) { t += o.amount; });
    return t;
  }

  function updateDayTotal() {
    var total = formTotal();
    $('expenseDayTotal').textContent = money(total);

    var hint = $('exHint');
    var inc = findIncome($('exIncome').value);
    if (!inc) { hint.textContent = ''; hint.classList.remove('negative'); return; }
    var after = num(inc.amount) - spentFor(inc.id, editingExpense) - total;
    hint.textContent = 'Balance after this: ' + money(after);
    hint.classList.toggle('negative', after < 0);
  }

  function fillIncomeSelect(selectedId, allowEmpty) {
    var sel = $('exIncome');
    sel.innerHTML = '';
    if (allowEmpty) {
      var ph = document.createElement('option');
      ph.value = '';
      ph.textContent = 'Select income';
      sel.appendChild(ph);
    }
    state.income.slice().sort(byDateDesc).forEach(function (i) {
      var o = document.createElement('option');
      o.value = i.id;
      o.textContent = incomeName(i) + ' · ' + money(num(i.amount)) + ' · ' + prettyDate(i.date);
      sel.appendChild(o);
    });
    if (selectedId && findIncome(selectedId)) sel.value = selectedId;
    else if (allowEmpty) sel.value = '';
    else if (sel.options.length) sel.selectedIndex = 0;
  }

  function fillExpense(item) {
    PERIODS.forEach(function (p) {
      var v = item ? num(item[p.key]) : 0;
      $(p.input).value = v ? v : '';
    });
    $('otherRows').innerHTML = '';
    if (item && item.others) {
      item.others.forEach(function (o) { addOtherRow(o.name, num(o.amount)); });
    }
    updateDayTotal();
  }

  function openExpense(item, presetIncomeId) {
    editingExpense = item ? item.id : null;
    $('expenseTitle').textContent = item ? 'Edit Expense' : 'Add Expense';
    var selected = item ? item.incomeId : (presetIncomeId || lastIncomeId);
    fillIncomeSelect(selected, !!(item && !item.incomeId));
    $('expenseDate').value = item ? item.date : todayISO();
    fillExpense(item);
    $('expenseError').textContent = '';
    openSheet('expenseModal');
  }

  function startAddExpense(presetIncomeId) {
    if (!state.income.length) {
      openIncome(null);
      $('incomeError').textContent = 'Add an income first, then add expenses from it.';
      return;
    }
    openExpense(null, presetIncomeId);
    checkExisting();
  }

  $('addExpenseBtn').addEventListener('click', function () { startAddExpense(''); });
  $('detailAddExpense').addEventListener('click', function () { startAddExpense(currentDetail); });

  $('addOtherBtn').addEventListener('click', function () {
    var row = addOtherRow('', 0);
    row.querySelector('.o-name').focus();
  });

  $('otherRows').addEventListener('input', updateDayTotal);
  $('otherRows').addEventListener('click', function (e) {
    var del = e.target.closest('.o-del');
    if (!del) return;
    del.closest('.other-row').remove();
    updateDayTotal();
  });

  PERIODS.forEach(function (p) {
    $(p.input).addEventListener('input', updateDayTotal);
  });

  // Same date + same income = one card, so load the existing day for editing.
  function checkExisting() {
    var d = $('expenseDate').value;
    var incId = $('exIncome').value;
    if (!d || !incId) { updateDayTotal(); return; }
    var existing = state.expenses.filter(function (x) { return x.date === d && x.incomeId === incId; })[0];
    if (existing && existing.id !== editingExpense) {
      editingExpense = existing.id;
      $('expenseTitle').textContent = 'Edit Expense';
      fillExpense(existing);
    } else {
      updateDayTotal();
    }
  }

  $('expenseDate').addEventListener('change', checkExisting);
  $('exIncome').addEventListener('change', checkExisting);

  $('expenseForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var date = $('expenseDate').value;
    var incomeId = $('exIncome').value;

    if (!incomeId) { $('expenseError').textContent = 'Choose which income this is from.'; return; }
    if (!date) { $('expenseError').textContent = 'Choose a date.'; return; }

    var entry = { date: date, incomeId: incomeId, others: collectOthers() };
    PERIODS.forEach(function (p) { entry[p.key] = num($(p.input).value); });

    if (!dayTotal(entry)) { $('expenseError').textContent = 'Enter at least one amount.'; return; }

    if (editingExpense) {
      entry.id = editingExpense;
      state.expenses = state.expenses.map(function (x) { return x.id === editingExpense ? entry : x; });
    } else {
      entry.id = uid();
      state.expenses.push(entry);
    }

    lastIncomeId = incomeId;
    save();
    render();
    closeSheet('expenseModal');
    if ($('detailModal').hidden) showTab('expenses');
  });

  /* ---------- Confirm sheet ---------- */
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

  /* ---------- List actions ---------- */
  function onListClick(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');

    if (act === 'edit-expense') {
      var ex = state.expenses.filter(function (x) { return x.id === id; })[0];
      if (ex) openExpense(ex);
    } else if (act === 'edit-income') {
      var inc = findIncome(id);
      if (inc) openIncome(inc);
    } else if (act === 'detail') {
      currentDetail = id;
      renderDetail();
      if (currentDetail) openSheet('detailModal');
    } else if (act === 'del-expense') {
      askConfirm('Delete this expense?', 'This cannot be undone.', function () {
        state.expenses = state.expenses.filter(function (x) { return x.id !== id; });
        save();
        render();
      });
    } else if (act === 'del-income') {
      var linked = state.expenses.filter(function (x) { return x.incomeId === id; }).length;
      var sub = linked
        ? 'This also deletes ' + linked + ' expense ' + (linked === 1 ? 'entry' : 'entries') + ' from this income. This cannot be undone.'
        : 'This cannot be undone.';
      askConfirm('Delete this income?', sub, function () {
        state.income = state.income.filter(function (x) { return x.id !== id; });
        state.expenses = state.expenses.filter(function (x) { return x.incomeId !== id; });
        save();
        render();
      });
    }
  }

  $('expenseList').addEventListener('click', onListClick);
  $('incomeList').addEventListener('click', onListClick);
  $('detailList').addEventListener('click', onListClick);

  /* ---------- Excel export ---------- */
  function exportExcel(incomeId) {
    if (
