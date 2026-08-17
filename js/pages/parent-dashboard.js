// js/pages/parent-dashboard.js — لوحة متابعة ولي الأمر (Async — Supabase)

(async function () {
  const user = await mountLayout("parent-dashboard.html", ["parent"], "لوحة المتابعة");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;

  const parent = await getById("ParentGuardian", user.linkedId);
  if (!parent || !parent.studentIds || !parent.studentIds.length) {
    document.getElementById("childSwitcherBox").innerHTML = `<p style="color:var(--color-text-muted);">لا يوجد أبناء مرتبطون بحسابكم حاليًا.</p>`;
    return;
  }

  const children = (await Promise.all(parent.studentIds.map(id => getById("Student", id)))).filter(Boolean);
  const childSelect = document.getElementById("childSelect");
  childSelect.innerHTML = children.map(c => `<option value="${c.id}">${c.fullName}</option>`).join("");

  if (children.length <= 1) document.getElementById("childSwitcherBox").style.display = "none";

  async function render() {
    const studentId = childSelect.value;
    const student = await getById("Student", studentId);
    if (!student) return;

    const [attendance, grades, payments, cls] = await Promise.all([
      query("Attendance", a => a.studentId === student.id),
      query("Grade", g => g.studentId === student.id),
      query("Payment", p => p.studentId === student.id),
      getById("Class", student.classId)
    ]);

    const present = attendance.filter(a => a.status === "حاضر").length;
    const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

    let avgAll = "—";
    if (grades.length) {
      const totalPct = grades.reduce((s, g) => s + (g.score / g.maxScore) * 20, 0);
      avgAll = (totalPct / grades.length).toFixed(1) + " / 20";
    }

    const dueAmount = payments.filter(p => p.status !== "مدفوع").reduce((s, p) => s + Number(p.amount), 0);

    document.getElementById("childStats").innerHTML = `
      <div class="stat-card blue"><div class="val">${cls ? cls.name : "—"}</div><div class="lbl">الفصل الدراسي</div></div>
      <div class="stat-card ${attendanceRate >= 80 ? 'green' : 'red'}"><div class="val">${attendanceRate}%</div><div class="lbl">نسبة الحضور</div></div>
      <div class="stat-card green"><div class="val">${avgAll}</div><div class="lbl">المعدل العام</div></div>
      <div class="stat-card ${dueAmount > 0 ? 'red' : 'green'}"><div class="val">${dueAmount.toLocaleString('ar-MA')} د.م</div><div class="lbl">مصروفات مستحقة</div></div>
    `;

    const subjects = await getAll("Subject");
    document.getElementById("childGrades").innerHTML = grades.slice(-5).reverse().map(g => {
      const subj = subjects.find(s => s.id === g.subjectId);
      return `<tr><td>${subj ? subj.name : "—"}</td><td>${g.type}</td><td><strong>${g.score}/${g.maxScore}</strong></td></tr>`;
    }).join("") || `<tr><td style="text-align:center;color:var(--color-text-muted);padding:16px;">لا يوجد درجات مسجلة بعد</td></tr>`;

    document.getElementById("childPayments").innerHTML = payments.map(p => {
      const pillClass = p.status === "مدفوع" ? "green" : "red";
      return `<tr><td>${Number(p.amount).toLocaleString('ar-MA')} د.م</td><td>${p.dueDate}</td><td><span class="pill ${pillClass}">${p.status}</span></td></tr>`;
    }).join("") || `<tr><td style="text-align:center;color:var(--color-text-muted);padding:16px;">لا يوجد مصروفات مسجلة</td></tr>`;

    const allNotifs = await getAll("Notification");
    const notifs = allNotifs
      .filter(n => n.targetRole === "parent" && (!n.targetId || n.targetId === parent.id))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    document.getElementById("parentNotifs").innerHTML = notifs.map(n =>
      `<div style="padding:10px 0;border-bottom:1px solid var(--color-border);font-size:13.5px;">${n.message}</div>`
    ).join("") || `<p style="color:var(--color-text-muted);">لا يوجد إشعارات</p>`;
  }

  childSelect.addEventListener("change", render);
  render();
})();
