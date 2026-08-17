// js/pages/timetable.js — الجدول الدراسي الأسبوعي (Async — Supabase)

(async function () {
  const user = await mountLayout("timetable.html", ["admin", "teacher"], "الجدول الدراسي");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;

  const isAdmin = user.role === "admin";
  document.getElementById("permHint").textContent = isAdmin
    ? "اضغط على أي خانة فارغة لإضافة حصة، أو على حصة موجودة لتعديلها."
    : "أنت تعرض جدولك كمدرس (للقراءة فقط).";

  const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
  // الفترة الصباحية: 8:00 – 12:00 | الفترة المسائية: 14:00 – 18:00
  const SLOTS = [
    ["08:00","09:00"],["09:00","10:00"],["10:00","11:00"],["11:00","12:00"],
    ["14:00","15:00"],["15:00","16:00"],["16:00","17:00"],["17:00","18:00"]
  ];

  const classSelect = document.getElementById("classSelect");
  const allClasses = await getAll("Class");

  async function classesForCurrentUser() {
    if (isAdmin) return allClasses;
    const teacher = await getById("Teacher", user.linkedId);
    return allClasses.filter(c => teacher && teacher.classIds.includes(c.id));
  }

  const myClasses = await classesForCurrentUser();
  classSelect.innerHTML = myClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join("")
    || `<option value="">لا يوجد فصل مرتبط بك</option>`;

  async function renderGrid() {
    const classId = classSelect.value;
    const [entries, subjects, teachers] = await Promise.all([
      query("Timetable", t => t.classId === classId), getAll("Subject"), getAll("Teacher")
    ]);

    let html = "<thead><tr><th>التوقيت</th>" + DAYS.map(d => `<th>${d}</th>`).join("") + "</tr></thead><tbody>";
    SLOTS.forEach(([start, end], idx) => {
      if (start === "14:00") {
        html += `<tr><td colspan="${DAYS.length + 1}" style="background:var(--color-bg);text-align:center;font-size:11.5px;color:var(--color-text-muted);padding:4px;">— الفترة المسائية —</td></tr>`;
      }
      html += `<tr><td><strong>${start}</strong><br>${end}</td>`;
      DAYS.forEach(day => {
        const entry = entries.find(e => e.day === day && e.startTime === start);
        if (entry) {
          const subj = subjects.find(s => s.id === entry.subjectId);
          const tch = teachers.find(t => t.id === entry.teacherId);
          html += `<td><div class="tt-slot filled" data-day="${day}" data-start="${start}" data-end="${end}" data-id="${entry.id}">
            <span class="subj">${subj ? subj.name : "—"}</span><span class="tch">${tch ? tch.fullName : "—"}</span>
          </div></td>`;
        } else {
          html += `<td><div class="tt-slot" data-day="${day}" data-start="${start}" data-end="${end}"></div></td>`;
        }
      });
      html += "</tr>";
    });
    html += "</tbody>";
    document.getElementById("ttGrid").innerHTML = html;

    document.querySelectorAll(".tt-slot").forEach(slot => {
      slot.addEventListener("click", () => { if (isAdmin) openSlotModal(slot.dataset); });
    });
  }

  const slotModal = document.getElementById("slotModal");
  const subjSelect = document.getElementById("slotSubject");
  const tchSelect = document.getElementById("slotTeacher");

  async function openSlotModal(ds) {
    document.getElementById("conflictError").style.display = "none";
    document.getElementById("slotDay").value = ds.day;
    document.getElementById("slotStart").value = ds.start;
    document.getElementById("slotEnd").value = ds.end;
    document.getElementById("slotId").value = ds.id || "";

    const [subjects, teachers] = await Promise.all([getAll("Subject"), getAll("Teacher")]);
    subjSelect.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    tchSelect.innerHTML = teachers.map(t => `<option value="${t.id}">${t.fullName}</option>`).join("");

    const deleteBtn = document.getElementById("deleteSlotBtn");
    if (ds.id) {
      const entry = await getById("Timetable", ds.id);
      subjSelect.value = entry.subjectId;
      tchSelect.value = entry.teacherId;
      deleteBtn.style.display = "inline-flex";
    } else {
      deleteBtn.style.display = "none";
    }
    slotModal.classList.add("show");
  }

  document.getElementById("cancelSlotBtn").addEventListener("click", () => slotModal.classList.remove("show"));

  document.getElementById("deleteSlotBtn").addEventListener("click", async () => {
    const id = document.getElementById("slotId").value;
    if (id) await deleteRecord("Timetable", id);
    slotModal.classList.remove("show");
    renderGrid();
    showToast("تم حذف الحصة", "success");
  });

  async function checkConflict(day, start, teacherId, excludeId) {
    const all = await getAll("Timetable");
    return all.some(e => e.day === day && e.startTime === start && e.teacherId === teacherId && e.id !== excludeId);
  }

  document.getElementById("saveSlotBtn").addEventListener("click", async () => {
    const day = document.getElementById("slotDay").value;
    const start = document.getElementById("slotStart").value;
    const end = document.getElementById("slotEnd").value;
    const id = document.getElementById("slotId").value;
    const teacherId = tchSelect.value;
    const subjectId = subjSelect.value;
    const classId = classSelect.value;

    if (await checkConflict(day, start, teacherId, id)) {
      const errBox = document.getElementById("conflictError");
      errBox.textContent = "⚠️ هذا المدرس لديه حصة أخرى في نفس اليوم والتوقيت في فصل آخر — لا يمكن الحفظ.";
      errBox.style.display = "block";
      return;
    }

    const data = { classId, subjectId, teacherId, day, startTime: start, endTime: end };
    if (id) await updateRecord("Timetable", id, data);
    else await addRecord("Timetable", data);

    slotModal.classList.remove("show");
    renderGrid();
    showToast("تم حفظ الحصة بنجاح", "success");
  });

  classSelect.addEventListener("change", renderGrid);
  if (classSelect.value) renderGrid();
})();
