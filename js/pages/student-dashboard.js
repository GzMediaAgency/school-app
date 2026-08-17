// js/pages/student-dashboard.js — لوحة تحكم الطالب (Async — Supabase)

(async function () {
  const user = await mountLayout("student-dashboard.html", ["student"], "لوحتي");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;

  const student = await getById("Student", user.linkedId);
  if (!student) return;

  const attendance = await query("Attendance", a => a.studentId === student.id);
  const present = attendance.filter(a => a.status === "حاضر").length;
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

  const grades = await query("Grade", g => g.studentId === student.id);
  let avgAll = "—";
  if (grades.length) {
    const totalPct = grades.reduce((s, g) => s + (g.score / g.maxScore) * 20, 0);
    avgAll = (totalPct / grades.length).toFixed(1) + " / 20";
  }

  const cls = await getById("Class", student.classId);

  document.getElementById("studentStats").innerHTML = `
    <div class="stat-card blue"><div class="val">${cls ? cls.name : "—"}</div><div class="lbl">الفصل الدراسي</div></div>
    <div class="stat-card ${attendanceRate >= 80 ? 'green' : 'red'}"><div class="val">${attendanceRate}%</div><div class="lbl">نسبة الحضور العامة</div></div>
    <div class="stat-card green"><div class="val">${avgAll}</div><div class="lbl">المعدل العام</div></div>
  `;

  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const todayName = dayNames[new Date().getDay()];
  const [todaySlotsRaw, subjects, teachers] = await Promise.all([
    query("Timetable", t => t.classId === student.classId && t.day === todayName), getAll("Subject"), getAll("Teacher")
  ]);
  const todaySlots = todaySlotsRaw.sort((a, b) => a.startTime.localeCompare(b.startTime));

  document.getElementById("todayTimetable").innerHTML = todaySlots.map(t => {
    const subj = subjects.find(s => s.id === t.subjectId);
    const tch = teachers.find(te => te.id === t.teacherId);
    return `<tr><td>${t.startTime} - ${t.endTime}</td><td>${subj ? subj.name : "—"}</td><td>${tch ? tch.fullName : "—"}</td></tr>`;
  }).join("") || `<tr><td style="text-align:center;color:var(--color-text-muted);padding:16px;">لا توجد حصص اليوم</td></tr>`;

  document.getElementById("recentGrades").innerHTML = grades.slice(-5).reverse().map(g => {
    const subj = subjects.find(s => s.id === g.subjectId);
    return `<tr><td>${subj ? subj.name : "—"}</td><td>${g.type}</td><td><strong>${g.score}/${g.maxScore}</strong></td></tr>`;
  }).join("") || `<tr><td style="text-align:center;color:var(--color-text-muted);padding:16px;">لا يوجد درجات مسجلة بعد</td></tr>`;

  const allNotifs = await getAll("Notification");
  const notifs = allNotifs
    .filter(n => n.targetRole === "student" && (!n.targetId || n.targetId === student.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
  document.getElementById("recentNotifs").innerHTML = notifs.map(n =>
    `<div style="padding:10px 0;border-bottom:1px solid var(--color-border);font-size:13.5px;">${n.message}</div>`
  ).join("") || `<p style="color:var(--color-text-muted);">لا يوجد إشعارات</p>`;
})();
