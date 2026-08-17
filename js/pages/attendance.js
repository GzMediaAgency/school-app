// js/pages/attendance.js — تتبع غياب التلاميذ (Async — Supabase)
// التنظيم هرمي: المستوى ← القسم (بدل قائمة أقسام مسطحة)

(async function () {
  const user = await mountLayout("attendance.html", ["admin"], "تتبع غياب التلاميذ");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;
  const school = await getMySchool();
  const schoolName = school ? school.name : "المدرسة";

  const STATUS_OPTIONS = [
    { key: "حاضر", cls: "present" }, { key: "غائب", cls: "absent" },
    { key: "متأخر", cls: "late" }, { key: "مستأذن", cls: "excused" }
  ];

  const levelSelect = document.getElementById("levelSelect");
  const classSelect = document.getElementById("classSelect");
  const dateInput = document.getElementById("dateSelect");
  dateInput.value = new Date().toISOString().slice(0, 10);

  const allClasses = await getAll("Class");

  // تعبئة قائمة المستويات (مُستخرجة من الأقسام الموجودة فعليًا، بدون تكرار)
  const levels = [...new Set(allClasses.map(c => c.level).filter(Boolean))];
  levelSelect.innerHTML = `<option value="">اختر المستوى</option>` + levels.map(l => `<option value="${l}">${l}</option>`).join("");

  function refreshClassOptions() {
    const selectedLevel = levelSelect.value;
    const filtered = selectedLevel ? allClasses.filter(c => c.level === selectedLevel) : allClasses;
    classSelect.innerHTML = `<option value="">اختر القسم</option>` + filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    document.getElementById("studentAttendanceList").innerHTML = "";
    document.getElementById("attendanceRateBody").innerHTML = "";
  }

  levelSelect.addEventListener("change", refreshClassOptions);
  refreshClassOptions();

  let pendingStatus = {};

  async function renderList() {
    const classId = classSelect.value;
    if (!classId) return;
    const date = dateInput.value;
    const [students, existing] = await Promise.all([
      query("Student", s => s.classId === classId),
      query("Attendance", a => a.classId === classId && a.date === date)
    ]);

    pendingStatus = {};
    existing.forEach(e => { pendingStatus[e.studentId] = e.status; });

    document.getElementById("studentAttendanceList").innerHTML = students.map(s => `
      <div class="att-row" data-student="${s.id}">
        <span>${s.fullName}</span>
        <div class="att-status-btns">
          ${STATUS_OPTIONS.map(opt => `<button type="button" class="status-btn ${opt.cls} ${pendingStatus[s.id] === opt.key ? 'selected ' + opt.cls : ''}" data-status="${opt.key}" data-cls="${opt.cls}">${opt.key}</button>`).join("")}
        </div>
      </div>
    `).join("") || `<p style="padding:16px;color:var(--color-text-muted);">لا يوجد طلاب في هذا الفصل</p>`;

    document.querySelectorAll(".status-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".att-row");
        const studentId = row.dataset.student;
        row.querySelectorAll(".status-btn").forEach(b => b.classList.remove("selected", "present", "absent", "late", "excused"));
        btn.classList.add("selected", btn.dataset.cls);
        pendingStatus[studentId] = btn.dataset.status;
      });
    });

    renderRates();
  }

  async function renderRates() {
    const classId = classSelect.value;
    if (!classId) return;
    const [students, allAttendance] = await Promise.all([query("Student", s => s.classId === classId), getAll("Attendance")]);

    document.getElementById("attendanceRateBody").innerHTML = students.map(s => {
      const records = allAttendance.filter(a => a.studentId === s.id);
      const present = records.filter(a => a.status === "حاضر").length;
      const rate = records.length ? Math.round((present / records.length) * 100) : 0;
      const pillClass = rate >= 80 ? "green" : rate >= 50 ? "blue" : "red";
      return `<tr><td>${s.fullName}</td><td>${records.length}</td><td><span class="pill ${pillClass}">${rate}%</span></td></tr>`;
    }).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted);padding:16px;">لا يوجد بيانات</td></tr>`;
  }

  document.getElementById("saveAttendanceBtn").addEventListener("click", async () => {
    const classId = classSelect.value;
    const date = dateInput.value;
    if (!classId) { showToast("يرجى اختيار المستوى ثم القسم", "error"); return; }

    const existing = await query("Attendance", a => a.classId === classId && a.date === date);
    const allNotifications = await getAll("Notification");
    let notifiedCount = 0;
    const absentWithPhone = [];

    for (const studentId of Object.keys(pendingStatus)) {
      const status = pendingStatus[studentId];
      const existingRecord = existing.find(e => e.studentId === studentId);

      if (existingRecord) await updateRecord("Attendance", existingRecord.id, { status });
      else await addRecord("Attendance", { studentId, classId, date, status });

      if (status === "غائب") {
        const student = await getById("Student", studentId);
        if (student && student.parentId) {
          const alreadyNotifiedToday = allNotifications.some(n =>
            n.targetId === student.parentId && n.message.includes(student.fullName) && n.message.includes(date)
          );
          if (!alreadyNotifiedToday) {
            await addRecord("Notification", {
              targetRole: "parent", targetId: student.parentId,
              message: `تنبيه: تم تسجيل غياب ابنكم/ابنتكم ${student.fullName} بتاريخ ${date}.`,
              type: "غياب", isRead: false
            });
            notifiedCount++;
          }

          const parent = await getById("ParentGuardian", student.parentId);
          if (parent && parent.phone) {
            absentWithPhone.push({ studentName: student.fullName, parentName: parent.fullName, phone: parent.phone });
          }
        }
      }
    }

    showToast(`تم حفظ الحضور بنجاح${notifiedCount ? ` — تم إنشاء ${notifiedCount} إشعار داخلي لأولياء الأمور` : ""}`, "success");
    renderWhatsAppPanel(absentWithPhone, date);
    renderList();
  });

  function renderWhatsAppPanel(absentList, date) {
    const panel = document.getElementById("whatsappPanel");
    const listEl = document.getElementById("whatsappList");
    if (!absentList.length) { panel.style.display = "none"; return; }

    panel.style.display = "block";
    listEl.innerHTML = absentList.map(item => {
      const message = `السلام عليكم ${item.parentName}،\nنُعلمكم بتسجيل غياب ابنكم/ابنتكم ${item.studentName} بتاريخ ${date}.\n${schoolName}.`;
      const link = buildWhatsAppLink(item.phone, message);
      return `<a href="${link}" target="_blank" class="btn btn-success btn-sm" style="justify-content:flex-start;">💬 إرسال إلى ${item.parentName} (${item.studentName})</a>`;
    }).join("");
  }

  classSelect.addEventListener("change", renderList);
  dateInput.addEventListener("change", renderList);
  if (classSelect.value) renderList();
})();
