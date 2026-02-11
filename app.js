const STORAGE_KEY = "daily_expense_tracker_v1";
const BUDGET_KEY = "daily_expense_tracker_budget_v1";

const form = document.getElementById("expense-form");
const formTitle = document.getElementById("form-title");
const submitBtn = document.getElementById("submit-btn");
const cancelEditBtn = document.getElementById("cancel-edit");

const dateInput = document.getElementById("date");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const noteInput = document.getElementById("note");

const expenseList = document.getElementById("expense-list");
const emptyState = document.getElementById("empty-state");
const todayTotalEl = document.getElementById("today-total");
const monthTotalEl = document.getElementById("month-total");
const transactionCountEl = document.getElementById("transaction-count");
const avgDayEl = document.getElementById("avg-day");

const filterDateInput = document.getElementById("filter-date");
const searchNoteInput = document.getElementById("search-note");
const sortByInput = document.getElementById("sort-by");
const clearFilterBtn = document.getElementById("clear-filter");

const budgetForm = document.getElementById("budget-form");
const monthlyBudgetInput = document.getElementById("monthly-budget");
const clearBudgetBtn = document.getElementById("clear-budget");
const budgetStatusEl = document.getElementById("budget-status");
const budgetBarEl = document.getElementById("budget-bar");

const categoryBreakdownEl = document.getElementById("category-breakdown");
const breakdownEmptyEl = document.getElementById("breakdown-empty");

const exportCsvBtn = document.getElementById("export-csv");
const importCsvInput = document.getElementById("import-csv");

let editingId = null;

dateInput.value = new Date().toISOString().slice(0, 10);

function loadExpenses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return parsed
      .map((item) => ({
        ...item,
        amount: Number.parseFloat(item.amount),
      }))
      .filter((item) => item.id && Number.isFinite(item.amount));
  } catch {
    return [];
  }
}

function saveExpenses(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadBudget() {
  const value = localStorage.getItem(BUDGET_KEY);
  if (!value) {
    return null;
  }
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function saveBudget(value) {
  if (value === null) {
    localStorage.removeItem(BUDGET_KEY);
    return;
  }
  localStorage.setItem(BUDGET_KEY, String(value));
}

function formatMoney(value) {
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
  return formatted.replace(/^₹\s?/, "Rs ");
}

function getMonthPrefix() {
  return new Date().toISOString().slice(0, 7);
}

function getSummary(expenses) {
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = getMonthPrefix();
  const monthItems = expenses.filter((e) => e.date.startsWith(monthPrefix));

  const todayTotal = expenses
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + e.amount, 0);

  const monthTotal = monthItems.reduce((sum, e) => sum + e.amount, 0);
  const transactionCount = monthItems.length;

  const uniqueDays = new Set(monthItems.map((e) => e.date)).size;
  const avgPerDay = uniqueDays === 0 ? 0 : monthTotal / uniqueDays;

  return { todayTotal, monthTotal, transactionCount, avgPerDay, monthItems };
}

function sortExpenses(items, sortMode) {
  const sorted = items.slice();
  switch (sortMode) {
    case "date_asc":
      sorted.sort((a, b) => (a.date > b.date ? 1 : -1));
      break;
    case "amount_desc":
      sorted.sort((a, b) => b.amount - a.amount);
      break;
    case "amount_asc":
      sorted.sort((a, b) => a.amount - b.amount);
      break;
    case "date_desc":
    default:
      sorted.sort((a, b) => (a.date < b.date ? 1 : -1));
      break;
  }
  return sorted;
}

function renderBudget(monthTotal) {
  const budget = loadBudget();
  monthlyBudgetInput.value = budget ? String(budget) : "";

  if (!budget) {
    budgetStatusEl.textContent = "Not set";
    budgetBarEl.style.width = "0%";
    budgetBarEl.style.background = "linear-gradient(90deg, #1d9a90, #0f766e)";
    return;
  }

  const pct = (monthTotal / budget) * 100;
  const capped = Math.min(pct, 100);
  budgetBarEl.style.width = `${capped}%`;

  if (pct >= 100) {
    budgetBarEl.style.background = "#b91c1c";
    budgetStatusEl.textContent = `Exceeded by ${formatMoney(monthTotal - budget)}`;
  } else if (pct >= 80) {
    budgetBarEl.style.background = "#b45309";
    budgetStatusEl.textContent = `${formatMoney(budget - monthTotal)} remaining`;
  } else {
    budgetBarEl.style.background = "linear-gradient(90deg, #1d9a90, #0f766e)";
    budgetStatusEl.textContent = `${formatMoney(budget - monthTotal)} remaining`;
  }
}

function renderBreakdown(monthItems) {
  const grouped = monthItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});

  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  categoryBreakdownEl.innerHTML = "";

  entries.forEach(([category, total]) => {
    const li = document.createElement("li");
    li.className = "breakdown-item";
    li.innerHTML = `<span>${category}</span><strong>${formatMoney(total)}</strong>`;
    categoryBreakdownEl.appendChild(li);
  });

  breakdownEmptyEl.style.display = entries.length ? "none" : "block";
}

function setFormModeEdit(expense) {
  editingId = expense.id;
  formTitle.textContent = "Edit Expense";
  submitBtn.textContent = "Save Changes";
  cancelEditBtn.classList.remove("hidden");

  dateInput.value = expense.date;
  amountInput.value = String(expense.amount);
  categoryInput.value = expense.category;
  noteInput.value = expense.note || "";
}

function setFormModeAdd() {
  editingId = null;
  formTitle.textContent = "Add Expense";
  submitBtn.textContent = "Add Expense";
  cancelEditBtn.classList.add("hidden");

  dateInput.value = new Date().toISOString().slice(0, 10);
  amountInput.value = "";
  noteInput.value = "";
}

function render() {
  const expenses = loadExpenses();
  const filterDate = filterDateInput.value;
  const noteQuery = searchNoteInput.value.trim().toLowerCase();
  const sortMode = sortByInput.value;

  let visible = expenses;
  if (filterDate) {
    visible = visible.filter((e) => e.date === filterDate);
  }
  if (noteQuery) {
    visible = visible.filter((e) => (e.note || "").toLowerCase().includes(noteQuery));
  }

  visible = sortExpenses(visible, sortMode);

  expenseList.innerHTML = "";

  visible.forEach((expense) => {
    const li = document.createElement("li");
    li.className = "expense-item";

    const left = document.createElement("div");
    left.className = "expense-main";
    left.innerHTML = `<strong>${formatMoney(expense.amount)}</strong> - ${expense.category}<div class="expense-meta">${expense.date}${
      expense.note ? ` | ${expense.note}` : ""
    }</div>`;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => setFormModeEdit(expense));

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      const next = loadExpenses().filter((e) => e.id !== expense.id);
      saveExpenses(next);
      if (editingId === expense.id) {
        setFormModeAdd();
      }
      render();
    });

    actions.append(editBtn, delBtn);
    li.append(left, actions);
    expenseList.appendChild(li);
  });

  emptyState.style.display = visible.length ? "none" : "block";

  const summary = getSummary(expenses);
  todayTotalEl.textContent = formatMoney(summary.todayTotal);
  monthTotalEl.textContent = formatMoney(summary.monthTotal);
  transactionCountEl.textContent = String(summary.transactionCount);
  avgDayEl.textContent = formatMoney(summary.avgPerDay);

  renderBudget(summary.monthTotal);
  renderBreakdown(summary.monthItems);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number.parseFloat(amountInput.value);

  if (!dateInput.value || !Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const expenses = loadExpenses();
  if (editingId) {
    const next = expenses.map((item) => {
      if (item.id !== editingId) {
        return item;
      }
      return {
        ...item,
        date: dateInput.value,
        amount,
        category: categoryInput.value,
        note: noteInput.value.trim(),
      };
    });
    saveExpenses(next);
  } else {
    const id = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    saveExpenses([
      ...expenses,
      {
        id,
        date: dateInput.value,
        amount,
        category: categoryInput.value,
        note: noteInput.value.trim(),
      },
    ]);
  }

  setFormModeAdd();
  render();
});

cancelEditBtn.addEventListener("click", setFormModeAdd);

filterDateInput.addEventListener("change", render);
searchNoteInput.addEventListener("input", render);
sortByInput.addEventListener("change", render);

clearFilterBtn.addEventListener("click", () => {
  filterDateInput.value = "";
  searchNoteInput.value = "";
  sortByInput.value = "date_desc";
  render();
});

budgetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number.parseFloat(monthlyBudgetInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }
  saveBudget(amount);
  render();
});

clearBudgetBtn.addEventListener("click", () => {
  saveBudget(null);
  render();
});

function toCsvRow(fields) {
  return fields
    .map((value) => {
      const text = String(value ?? "");
      const escaped = text.replaceAll('"', '""');
      return `"${escaped}"`;
    })
    .join(",");
}

exportCsvBtn.addEventListener("click", () => {
  const expenses = loadExpenses();
  const rows = ["id,date,amount,category,note"];

  expenses.forEach((item) => {
    rows.push(toCsvRow([item.id, item.date, item.amount, item.category, item.note]));
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

function parseSimpleCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const data = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const cells = [];
    let current = "";
    let inside = false;

    for (let j = 0; j < line.length; j += 1) {
      const ch = line[j];
      const next = line[j + 1];

      if (ch === '"' && inside && next === '"') {
        current += '"';
        j += 1;
      } else if (ch === '"') {
        inside = !inside;
      } else if (ch === "," && !inside) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }

    cells.push(current);

    if (cells.length < 5) {
      continue;
    }

    const amount = Number.parseFloat(cells[2]);
    if (!cells[0] || !cells[1] || !Number.isFinite(amount)) {
      continue;
    }

    data.push({
      id: cells[0],
      date: cells[1],
      amount,
      category: cells[3] || "Other",
      note: cells[4] || "",
    });
  }

  return data;
}

importCsvInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const content = String(reader.result || "");
    const parsed = parseSimpleCsv(content);
    if (!parsed.length) {
      importCsvInput.value = "";
      return;
    }

    const existing = loadExpenses();
    const map = new Map(existing.map((item) => [item.id, item]));
    parsed.forEach((item) => map.set(item.id, item));

    saveExpenses(Array.from(map.values()));
    importCsvInput.value = "";
    render();
  };

  reader.readAsText(file);
});

setFormModeAdd();
render();


