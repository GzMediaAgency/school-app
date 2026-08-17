// js/pages/finance.js — المداخيل (واجبات شهرية حسب القسم) والمصاريف (Async — Supabase)

(async function () {
  const user = await mountLayout("finance.html", ["admin"], "المالية والمدفوعات");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;
  const school = await getMySchool();
  const schoolName = school ? school.name : "المدرسة";

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  async function refreshStats() {
    const [payments, expenses] = await Promise.all([getAll("Payment"), getAll("Expense")]);
    const totalRevenue = payments.filter(p => p.status === "مدفوع").reduce((s, p) => s + Number(p.amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const balance = totalRevenue - totalExpenses;

    document.getElementById("financeStats").innerHTML = `
      <div class="stat-card green"><div class="val">${totalRevenue.toLocaleString('ar-MA')} د.م</div><div class="lbl">إجمالي المداخيل المحصّلة</div></div>
      <div class="stat-card red"><div class="val">${totalExpenses.toLocaleString('ar-MA')} د.م</div><div class="lbl">إجمالي المصاريف</div></div>
      <div class="stat-card ${balance >= 0 ? 'green' : 'red'}"><div class="val">${balance.toLocaleString('ar-MA')} د.م</div><div class="lbl">الرصيد الصافي</div></div>
    `;
  }

  // ================= وحدة المداخيل =================
  const monthInput = document.getElementById("incomeMonth");
  const levelSelect = document.getElementById("incomeLevel");
  const classSelect = document.getElementById("incomeClass");
  const defaultAmountInput = document.getElementById("defaultAmount");

  monthInput.value = new Date().toISOString().slice(0, 7); // الشهر الحالي بصيغة YYYY-MM

  const allClasses = await getAll("Class");
  const levels = [...new Set(allClasses.map(c => c.level).filter(Boolean))];
  levelSelect.innerHTML = `<option value="">اختر المستوى</option>` + levels.map(l => `<option value="${l}">${l}</option>`).join("");

  function refreshClassOptions() {
    const selectedLevel = levelSelect.value;
    const filtered = selectedLevel ? allClasses.filter(c => c.level === selectedLevel) : allClasses;
    classSelect.innerHTML = `<option value="">اختر القسم</option>` + filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }
  levelSelect.addEventListener("change", refreshClassOptions);
  refreshClassOptions();

  async function loadIncomeTable() {
    const classId = classSelect.value;
    const month = monthInput.value;
    if (!classId || !month) { showToast("يرجى اختيار الشهر والمستوى والقسم", "error"); return; }

    const [students, existingPayments] = await Promise.all([
      query("Student", s => s.classId === classId),
      query("Payment", p => p.month === month)
    ]);

    const defaultDue = month + "-10"; // تاريخ استحقاق افتراضي: اليوم العاشر من الشهر المختار
    const defaultAmount = Number(defaultAmountInput.value) || 800;

    document.getElementById("incomeTableBody").innerHTML = students.map(s => {
      const rec = existingPayments.find(p => p.studentId === s.id);
      const amount = rec ? rec.amount : defaultAmount;
      const due = rec ? rec.dueDate : defaultDue;
      const status = rec ? rec.status : "غير مدفوع";
      const pillClass = status === "مدفوع" ? "green" : "red";
      return `<tr data-student="${s.id}" data-payment-id="${rec ? rec.id : ''}">
        <td>${s.fullName}</td>
        <td><input type="number" class="due-input income-amount" value="${amount}"></td>
        <td><input type="date" class="date-input-sm income-due" value="${due}"></td>
        <td>
          <button type="button" class="btn btn-sm ${status === 'مدفوع' ? 'btn-success' : 'btn-outline'} income-status-btn" data-status="${status}">
            <span class="pill ${pillClass}" style="pointer-events:none;">${status}</span>
          </button>
        </td>
      </tr>`;
    }).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:20px;">لا يوجد تلاميذ في هذا القسم</td></tr>`;

    document.querySelectorAll(".income-status-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const newStatus = btn.dataset.status === "مدفوع" ? "غير مدفوع" : "مدفوع";
        btn.dataset.status = newStatus;
        btn.className = "btn btn-sm " + (newStatus === "مدفوع" ? "btn-success" : "btn-outline") + " income-status-btn";
        btn.innerHTML = `<span class="pill ${newStatus === 'مدفوع' ? 'green' : 'red'}" style="pointer-events:none;">${newStatus}</span>`;
      });
    });

    document.getElementById("saveIncomeBtn").style.display = students.length ? "inline-flex" : "none";
  }

  document.getElementById("loadIncomeBtn").addEventListener("click", loadIncomeTable);

  document.getElementById("saveIncomeBtn").addEventListener("click", async () => {
    const classId = classSelect.value;
    const month = monthInput.value;
    const rows = Array.from(document.querySelectorAll("#incomeTableBody tr[data-student]"));
    let count = 0;

    for (const row of rows) {
      const studentId = row.dataset.student;
      const paymentId = row.dataset.paymentId;
      const amount = Number(row.querySelector(".income-amount").value) || 0;
      const dueDate = row.querySelector(".income-due").value;
      const statusBtn = row.querySelector(".income-status-btn");
      const status = statusBtn.dataset.status;

      const data = { studentId, amount, dueDate, month, status, classId };
      if (status === "مدفوع") data.paidDate = new Date().toISOString().slice(0, 10);

      if (paymentId) await updateRecord("Payment", paymentId, data);
      else await addRecord("Payment", data);
      count++;
    }

    showToast(`تم حفظ واجبات ${count} تلميذ لشهر ${month}`, "success");
    refreshStats();
    loadIncomeTable();
  });

  // ================= وحدة المصاريف =================
  async function renderExpenses() {
    const expenses = await getAll("Expense");
    document.getElementById("expensesTableBody").innerHTML = expenses.slice().reverse().map(e => `<tr>
        <td>${e.category}</td><td>${Number(e.amount).toLocaleString('ar-MA')} د.م</td><td>${e.date}</td><td>${e.description || "—"}</td>
        <td><button class="btn btn-danger btn-sm" onclick="removeExpense('${e.id}')">حذف</button></td>
      </tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:16px;">لا يوجد مصاريف مسجلة</td></tr>`;
  }

  const expenseModal = document.getElementById("expenseModal");
  document.getElementById("addExpenseBtn").addEventListener("click", () => {
    document.getElementById("expenseDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("expenseCategory").value = "رواتب";
    expenseModal.classList.add("show");
  });
  document.getElementById("cancelExpenseBtn").addEventListener("click", () => expenseModal.classList.remove("show"));

  document.getElementById("saveExpenseBtn").addEventListener("click", async () => {
    const category = document.getElementById("expenseCategory").value;
    await addRecord("Expense", {
      category,
      amount: Number(document.getElementById("expenseAmount").value) || 0,
      date: document.getElementById("expenseDate").value,
      description: document.getElementById("expenseDesc").value.trim()
    });
    expenseModal.classList.remove("show");
    showToast("تمت إضافة المصروف بنجاح", "success");
    renderExpenses(); refreshStats();
  });

  window.removeExpense = async function (id) {
    if (!confirm("هل تريد حذف هذا المصروف؟")) return;
    await deleteRecord("Expense", id);
    renderExpenses(); refreshStats();
    showToast("تم حذف المصروف", "success");
  };

  refreshStats();
  renderExpenses();
})();
