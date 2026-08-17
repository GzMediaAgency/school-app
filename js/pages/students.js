// js/pages/students.js — منطق إدارة الطلاب والفصول (Async — يتصل بـ Supabase)

(async function () {
  const user = await mountLayout("students.html", ["admin"], "الطلاب والفصول");
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

  function fillSelect(selectEl, items, valueKey, labelFn, placeholder) {
    selectEl.innerHTML = (placeholder ? `<option value="">${placeholder}</option>` : "") +
      items.map(i => `<option value="${i[valueKey]}">${labelFn(i)}</option>`).join("");
  }

  async function refreshDropdowns() {
    const [classes, parents, teachers] = await Promise.all([getAll("Class"), getAll("ParentGuardian"), getAll("Teacher")]);
    fillSelect(document.getElementById("studentClass"), classes, "id", c => c.name);
    fillSelect(document.getElementById("studentParent"), parents, "id", p => p.fullName, "— بدون —");
    fillSelect(document.getElementById("classTeacher"), teachers, "id", t => t.fullName, "— بدون —");
    fillSelect(document.getElementById("classFilter"), classes, "id", c => c.name, "كل الفصول");
  }

  async function renderStudents() {
    const searchVal = document.getElementById("studentSearch").value.trim().toLowerCase();
    const classFilterVal = document.getElementById("classFilter").value;
    const [classes, parents] = await Promise.all([getAll("Class"), getAll("ParentGuardian")]);

    let students = await getAll("Student");
    if (searchVal) students = students.filter(s => s.fullName.toLowerCase().includes(searchVal));
    if (classFilterVal) students = students.filter(s => s.classId === classFilterVal);

    document.getElementById("studentsTableBody").innerHTML = students.map(s => {
      const cls = classes.find(c => c.id === s.classId);
      const parent = parents.find(p => p.id === s.parentId);
      const statusPill = s.status === "active" ? `<span class="pill green">مسجّل</span>` : `<span class="pill red">غير نشط</span>`;
      const waBtn = (parent && parent.phone)
        ? `<button class="btn btn-outline btn-sm" title="فتح واتساب" onclick="window.open(buildWhatsAppLink('${parent.phone}', 'السلام عليكم، بخصوص ${s.fullName}: '), '_blank')">💬</button>`
        : "";
      return `<tr>
        <td>${s.fullName}</td><td>${cls ? cls.name : "—"}</td><td>${parent ? parent.fullName : "—"}</td>
        <td>${parent && parent.phone ? parent.phone : "—"}</td><td>${statusPill}</td>
        <td style="display:flex;gap:6px;">
          ${waBtn}
          <button class="btn btn-outline btn-sm" onclick="editStudent('${s.id}')">تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="removeStudent('${s.id}')">حذف</button>
        </td>
      </tr>`;
    }).join("") || `<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:20px;">لا يوجد طلاب مطابقون</td></tr>`;
  }

  async function renderClasses() {
    const [classes, students, teachers] = await Promise.all([getAll("Class"), getAll("Student"), getAll("Teacher")]);
    document.getElementById("classesTableBody").innerHTML = classes.map(c => {
      const count = students.filter(s => s.classId === c.id).length;
      const teacher = teachers.find(t => t.id === c.teacherId);
      return `<tr>
        <td>${c.name}</td><td>${c.level}</td><td>${count} / ${c.capacity}</td><td>${teacher ? teacher.fullName : "—"}</td>
        <td style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="editClass('${c.id}')">تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="removeClass('${c.id}')">حذف</button>
        </td>
      </tr>`;
    }).join("") || `<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:20px;">لا يوجد فصول بعد</td></tr>`;
  }

  async function refreshAll() { await refreshDropdowns(); await renderStudents(); await renderClasses(); }

  const studentModal = document.getElementById("studentModal");
  document.getElementById("addStudentBtn").addEventListener("click", () => openStudentModal());
  document.getElementById("cancelStudentBtn").addEventListener("click", () => studentModal.classList.remove("show"));

  async function openStudentModal(student) {
    await refreshDropdowns();
    document.getElementById("studentModalTitle").textContent = student ? "تعديل بيانات طالب" : "إضافة طالب";
    document.getElementById("studentId").value = student ? student.id : "";
    document.getElementById("studentName").value = student ? student.fullName : "";
    document.getElementById("studentBirth").value = student ? student.birthDate : "";
    document.getElementById("studentClass").value = student ? (student.classId || "") : "";
    document.getElementById("studentAddress").value = student ? (student.address || "") : "";
    document.getElementById("studentParent").value = student ? (student.parentId || "") : "";
    document.getElementById("newParentName").value = "";
    document.getElementById("newParentPhone").value = "";
    document.getElementById("studentStatus").value = student ? student.status : "active";
    studentModal.classList.add("show");
  }

  window.editStudent = async function (id) { openStudentModal(await getById("Student", id)); };
  window.removeStudent = async function (id) {
    if (!confirm("هل تريد حذف هذا الطالب؟")) return;
    await deleteRecord("Student", id);
    showToast("تم حذف الطالب", "success");
    refreshAll();
  };

  async function resolveParentId(studentId) {
    const selectedExisting = document.getElementById("studentParent").value;
    const newName = document.getElementById("newParentName").value.trim();
    const newPhone = document.getElementById("newParentPhone").value.trim();

    if (selectedExisting) return selectedExisting;
    if (!newName && !newPhone) return null;

    const allParents = newPhone ? await getAll("ParentGuardian") : [];
    const existingByPhone = newPhone ? allParents.find(p => p.phone === newPhone) : null;
    if (existingByPhone) {
      if (studentId && !existingByPhone.studentIds.includes(studentId)) {
        await updateRecord("ParentGuardian", existingByPhone.id, { studentIds: [...existingByPhone.studentIds, studentId] });
      }
      return existingByPhone.id;
    }

    const newParent = await addRecord("ParentGuardian", {
      fullName: newName || "ولي أمر غير مسمى",
      phone: newPhone,
      address: document.getElementById("studentAddress").value.trim(),
      studentIds: studentId ? [studentId] : []
    });
    return newParent.id;
  }

  document.getElementById("saveStudentBtn").addEventListener("click", async () => {
    const name = document.getElementById("studentName").value.trim();
    if (!name) { showToast("يرجى إدخال اسم الطالب", "error"); return; }
    const id = document.getElementById("studentId").value;

    const data = {
      fullName: name,
      birthDate: document.getElementById("studentBirth").value,
      classId: document.getElementById("studentClass").value || null,
      address: document.getElementById("studentAddress").value.trim(),
      status: document.getElementById("studentStatus").value
    };

    if (id) {
      data.parentId = await resolveParentId(id);
      await updateRecord("Student", id, data);
      showToast("تم تحديث بيانات الطالب", "success");
    } else {
      const savedStudent = await addRecord("Student", data);
      const parentId = await resolveParentId(savedStudent.id);
      if (parentId) await updateRecord("Student", savedStudent.id, { parentId });
      showToast("تمت إضافة الطالب بنجاح", "success");
    }
    studentModal.classList.remove("show");
    refreshAll();
  });

  const classModal = document.getElementById("classModal");
  document.getElementById("addClassBtn").addEventListener("click", () => openClassModal());
  document.getElementById("cancelClassBtn").addEventListener("click", () => classModal.classList.remove("show"));

  async function openClassModal(cls) {
    await refreshDropdowns();
    document.getElementById("classModalTitle").textContent = cls ? "تعديل فصل" : "إضافة فصل";
    document.getElementById("classId").value = cls ? cls.id : "";
    document.getElementById("className").value = cls ? cls.name : "";
    document.getElementById("classLevel").value = cls ? cls.level : "";
    document.getElementById("classCapacity").value = cls ? cls.capacity : 30;
    document.getElementById("classTeacher").value = cls ? (cls.teacherId || "") : "";
    classModal.classList.add("show");
  }

  window.editClass = async function (id) { openClassModal(await getById("Class", id)); };
  window.removeClass = async function (id) {
    if (!confirm("هل تريد حذف هذا الفصل؟")) return;
    await deleteRecord("Class", id);
    showToast("تم حذف الفصل", "success");
    refreshAll();
  };

  document.getElementById("saveClassBtn").addEventListener("click", async () => {
    const name = document.getElementById("className").value.trim();
    if (!name) { showToast("يرجى إدخال اسم الفصل", "error"); return; }
    const id = document.getElementById("classId").value;
    const data = {
      name,
      level: document.getElementById("classLevel").value.trim(),
      capacity: Number(document.getElementById("classCapacity").value) || 30,
      teacherId: document.getElementById("classTeacher").value || null
    };
    if (id) { await updateRecord("Class", id, data); showToast("تم تحديث بيانات الفصل", "success"); }
    else { await addRecord("Class", data); showToast("تمت إضافة الفصل بنجاح", "success"); }
    classModal.classList.remove("show");
    refreshAll();
  });

  document.getElementById("studentSearch").addEventListener("input", renderStudents);
  document.getElementById("classFilter").addEventListener("change", renderStudents);

  document.getElementById("downloadTemplateBtn").addEventListener("click", () => {
    const header = "اسم_الطالب,تاريخ_الميلاد,اسم_الفصل,اسم_ولي_الأمر,هاتف_ولي_الأمر,العنوان\n";
    const sample = "أمين بنعبد الله,2013-05-14,الأولى إعدادي - أ,السيد بنعبد الله,0611223344,حي الوحدة تارودانت\n";
    const csvContent = "\uFEFF" + header + sample;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "نموذج_لائحة_الطلاب.csv";
    link.click();
  });

  const csvFileInput = document.getElementById("csvFileInput");
  document.getElementById("importCsvBtn").addEventListener("click", () => csvFileInput.click());

  function parseCSV(text) {
    const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(r => r.trim() !== "");
    return rows.map(row => row.split(",").map(cell => cell.trim().replace(/^"|"$/g, "")));
  }

  csvFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rows = parseCSV(ev.target.result);
      if (rows.length < 2) { showToast("الملف فارغ أو لا يحتوي على بيانات", "error"); return; }

      const dataRows = rows.slice(1);
      const classes = await getAll("Class");
      let imported = 0, skipped = 0;

      for (const cols of dataRows) {
        const [studentName, birthDate, className, parentName, parentPhone, address] = cols;
        if (!studentName) { skipped++; continue; }

        let cls = classes.find(c => c.name.trim() === (className || "").trim());
        if (!cls && className && className.trim()) {
          cls = await addRecord("Class", { name: className.trim(), level: "", capacity: 30, teacherId: null });
          classes.push(cls);
        }

        let parentId = null;
        if (parentPhone && parentPhone.trim()) {
          const allParents = await getAll("ParentGuardian");
          const existingParent = allParents.find(p => p.phone === parentPhone.trim());
          if (existingParent) {
            parentId = existingParent.id;
          } else {
            const newParent = await addRecord("ParentGuardian", {
              fullName: (parentName || "ولي أمر غير مسمى").trim(),
              phone: parentPhone.trim(),
              address: (address || "").trim(),
              studentIds: []
            });
            parentId = newParent.id;
          }
        }

        const newStudent = await addRecord("Student", {
          fullName: studentName.trim(),
          birthDate: (birthDate || "").trim(),
          classId: cls ? cls.id : null,
          parentId,
          address: (address || "").trim(),
          photo: "",
          status: "active"
        });

        if (parentId) {
          const parent = await getById("ParentGuardian", parentId);
          if (parent && !parent.studentIds.includes(newStudent.id)) {
            await updateRecord("ParentGuardian", parentId, { studentIds: [...parent.studentIds, newStudent.id] });
          }
        }
        imported++;
      }

      showToast(`تم استيراد ${imported} طالب بنجاح${skipped ? ` (تم تجاهل ${skipped} سطر ناقص)` : ""}`, "success");
      refreshAll();
      csvFileInput.value = "";
    };
    reader.readAsText(file, "UTF-8");
  });

  refreshAll();
})();
