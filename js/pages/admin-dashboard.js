// js/pages/admin-dashboard.js — منطق لوحة تحكم المدير (Async — يتصل بـ Supabase)

(async function () {
  const user = await mountLayout("admin-dashboard.html", ["admin"], "لوحة التحكم");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;

  const [students, teachers, classes, payments, attendance] = await Promise.all([
    getAll("Student"), getAll("Teacher"), getAll("Class"), getAll("Payment"), getAll("Attendance")
  ]);

  // نسبة الحضور اليوم
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecords = attendance.filter(a => a.date === todayStr);
  const presentToday = todayRecords.filter(a => a.status === "حاضر").length;
  const attendanceRate = todayRecords.length ? Math.round((presentToday / todayRecords.length) * 100) : 0;

  // إيرادات هذا الشهر
  const now = new Date();
  const monthRevenue = payments
    .filter(p => p.status === "مدفوع" && p.paidDate && new Date(p.paidDate).getMonth() === now.getMonth())
    .reduce((sum, p) => sum + Number(p.amount), 0);

  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card blue"><div class="val">${students.length}</div><div class="lbl">عدد الطلاب</div></div>
    <div class="stat-card"><div class="val">${teachers.length}</div><div class="lbl">عدد المدرسين</div></div>
    <div class="stat-card green"><div class="val">${attendanceRate}%</div><div class="lbl">نسبة الحضور اليوم</div></div>
    <div class="stat-card ${monthRevenue > 0 ? 'green' : 'red'}"><div class="val">${monthRevenue.toLocaleString('ar-MA')} د.م</div><div class="lbl">إيرادات هذا الشهر</div></div>
  `;

  const classLabels = classes.map(c => c.name);
  const classCounts = classes.map(c => students.filter(s => s.classId === c.id).length);
  new Chart(document.getElementById("classChart"), {
    type: "pie",
    data: { labels: classLabels, datasets: [{ data: classCounts, backgroundColor: ["#1E4FA3", "#1E9E5A", "#D9302F", "#C98A1E", "#7C5CBF"] }] },
    options: { plugins: { legend: { position: "bottom", labels: { font: { family: "Tajawal" } } } } }
  });

  const days = [];
  const rates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().slice(0, 10);
    const dayRecords = attendance.filter(a => a.date === dStr);
    const present = dayRecords.filter(a => a.status === "حاضر").length;
    days.push(d.toLocaleDateString("ar-MA", { weekday: "short" }));
    rates.push(dayRecords.length ? Math.round((present / dayRecords.length) * 100) : 0);
  }
  new Chart(document.getElementById("attendanceChart"), {
    type: "line",
    data: { labels: days, datasets: [{ label: "نسبة الحضور %", data: rates, borderColor: "#1E9E5A", backgroundColor: "rgba(30,158,90,0.15)", tension: 0.35, fill: true }] },
    options: { scales: { y: { min: 0, max: 100 } } }
  });
})();
