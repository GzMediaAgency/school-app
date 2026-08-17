// js/pages/teachers.js — منطق إدارة المدرسين والمواد الدراسية (Async — Supabase)

(async function () {
  const user = await mountLayout("teachers.html", ["admin"], "المدرسون والمواد");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  function fillMultiSelect(selectEl, items, valueKey, labelFn, selectedIds) {
    selectedIds = selectedIds || [];
    selectEl.innerHTML = items.map(i =>
      `<option value="${i[valueKey]}" ${selectedIds.includes(i[valueKey]) ? "selected" : ""}>${labelFn(i)}</option>`
    ).join("");
  }

  function getSelectedValues(selectEl) {
    return Array.from(selectEl.selectedOptions).map(o => o.value);
  }

  async function renderTeachers() {
    const [teachers, subjects, classes] = await Promise.all([getAll("Teacher"), getAll("Subject"), getAll("Class")]);
    document.getElementById("teachersTableBody").innerHTML = teachers.map(t => {
      const subjNames = (t.subjectIds || []).map(id => (subjects.find(s => s.id === id) || {}).name).filter(Boolean).join("، ") || "—";
      const clsNames = (t.classIds || []).map(id => (classes.find(c => c.id === id) || {}).name).filter(Boolean).join("، ") || "—";
      return `<tr>
        <td>${t.fullName}</td><td>${t.specialty}</td><td>${subjNames}</td><td>${clsNames}</td>
        <td style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="editTeacher('${t.id}')">تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="removeTeacher('${t.id}')">حذف</button>
        </td>
      </tr>`;
    }).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:20px;">لا يوجد مدرسون بعد</td></tr>`;
  }

  const teacherModal = document.getElementById("teacherModal");
  document.getElementById("addTeacherBtn").addEventListener("click", () => openTeacherModal());
  document.getElementById("cancelTeacherBtn").addEventListener("click", () => teacherModal.classList.remove("show"));

  async function openTeacherModal(teacher) {
    document.getElementById("teacherModalTitle").textContent = teacher ? "تعديل بيانات مدرس" : "إضافة مدرس";
    document.getElementById("teacherId").value = teacher ? teacher.id : "";
    document.getElementById("teacherName").value = teacher ? teacher.fullName : "";
    document.getElementById("teacherSpecialty").value = teacher ? teacher.specialty : "";
    const [subjects, classes] = await Promise.all([getAll("Subject"), getAll("Class")]);
    fillMultiSelect(document.getElementById("teacherSubjects"), subjects, "id", s => s.name, teacher ? teacher.subjectIds : []);
    fillMultiSelect(document.getElementById("teacherClasses"), classes, "id", c => c.name, teacher ? teacher.classIds : []);
    teacherModal.classList.add("show");
  }

  window.editTeacher = async function (id) { openTeacherModal(await getById("Teacher", id)); };
  window.removeTeacher = async function (id) {
    if (!confirm("هل تريد حذف هذا المدرس؟")) return;
    await deleteRecord("Teacher", id);
    showToast("تم حذف المدرس", "success");
    renderTeachers();
  };

  document.getElementById("saveTeacherBtn").addEventListener("click", async () => {
    const name = document.getElementById("teacherName").value.trim();
    if (!name) { showToast("يرجى إدخال اسم المدرس", "error"); return; }
    const id = document.getElementById("teacherId").value;
    const data = {
      fullName: name,
      specialty: document.getElementById("teacherSpecialty").value.trim(),
      subjectIds: getSelectedValues(document.getElementById("teacherSubjects")),
      classIds: getSelectedValues(document.getElementById("teacherClasses"))
    };
    if (id) { await updateRecord("Teacher", id, data); showToast("تم تحديث بيانات المدرس", "success"); }
    else { await addRecord("Teacher", data); showToast("تمت إضافة المدرس بنجاح", "success"); }
    teacherModal.classList.remove("show");
    renderTeachers();
  });

  async function renderSubjects() {
    const subjects = await getAll("Subject");
    document.getElementById("subjectsTableBody").innerHTML = subjects.map(s => `<tr>
        <td>${s.name}</td><td>${s.level}</td><td>${s.weeklyHours}</td>
        <td style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="editSubject('${s.id}')">تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="removeSubject('${s.id}')">حذف</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:20px;">لا يوجد مواد بعد</td></tr>`;
  }

  const subjectModal = document.getElementById("subjectModal");
  document.getElementById("addSubjectBtn").addEventListener("click", () => openSubjectModal());
  document.getElementById("cancelSubjectBtn").addEventListener("click", () => subjectModal.classList.remove("show"));

  function openSubjectModal(subject) {
    document.getElementById("subjectModalTitle").textContent = subject ? "تعديل مادة" : "إضافة مادة";
    document.getElementById("subjectId").value = subject ? subject.id : "";
    document.getElementById("subjectName").value = subject ? subject.name : "";
    document.getElementById("subjectLevel").value = subject ? subject.level : "";
    document.getElementById("subjectHours").value = subject ? subject.weeklyHours : 4;
    subjectModal.classList.add("show");
  }

  window.editSubject = async function (id) { openSubjectModal(await getById("Subject", id)); };
  window.removeSubject = async function (id) {
    if (!confirm("هل تريد حذف هذه المادة؟")) return;
    await deleteRecord("Subject", id);
    showToast("تم حذف المادة", "success");
    renderSubjects();
  };

  document.getElementById("saveSubjectBtn").addEventListener("click", async () => {
    const name = document.getElementById("subjectName").value.trim();
    if (!name) { showToast("يرجى إدخال اسم المادة", "error"); return; }
    const id = document.getElementById("subjectId").value;
    const data = {
      name,
      level: document.getElementById("subjectLevel").value.trim(),
      weeklyHours: Number(document.getElementById("subjectHours").value) || 1
    };
    if (id) { await updateRecord("Subject", id, data); showToast("تم تحديث المادة", "success"); }
    else { await addRecord("Subject", data); showToast("تمت إضافة المادة بنجاح", "success"); }
    subjectModal.classList.remove("show");
    renderSubjects();
  });

  const DEFAULT_SUBJECTS = [
    "اللغة العربية", "اللغة الفرنسية", "اللغة الأمازيغية", "الرياضيات", "النشاط العلمي",
    "التربية الإسلامية", "الاجتماعيات", "التربية البدنية", "التربية الفنية", "المهارات الحياتية",
    "اللغة الإنجليزية", "علوم الحياة والأرض", "الفيزياء والكيمياء", "الإعلاميات", "الفلسفة"
  ];

  document.getElementById("addDefaultSubjectsBtn").addEventListener("click", async () => {
    const existing = await getAll("Subject");
    const existingNames = existing.map(s => s.name);
    const toAdd = DEFAULT_SUBJECTS.filter(name => !existingNames.includes(name));

    if (!toAdd.length) { showToast("كل المواد الرسمية مضافة بالفعل", "info"); return; }

    for (const name of toAdd) {
      await addRecord("Subject", { name, level: "", weeklyHours: 4 });
    }
    showToast(`تمت إضافة ${toAdd.length} مادة دراسية بنجاح`, "success");
    renderSubjects();
  });

  renderTeachers();
  renderSubjects();
})();
