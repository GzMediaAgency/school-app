// js/pages/grades.js — إدخال الدرجات وحساب المعدلات (Async — Supabase)

(async function () {
  const user = await mountLayout("grades.html", ["teacher", "admin"], "الدرجات");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;

  const classSelect = document.getElementById("classSelect");
  const subjectSelect = document.getElementById("subjectSelect");
  const termSelect = document.getElementById("termSelect");
  const typeSelect = document.getElementById("typeSelect");

  async function classesForCurrentUser() {
    const allClasses = await getAll("Class");
    if (user.role === "admin") return allClasses;
    const teacher = await getById("Teacher", user.linkedId);
    return allClasses.filter(c => teacher && teacher.classIds.includes(c.id));
  }

  async function subjectsForCurrentUser() {
    const allSubjects = await getAll("Subject");
    if (user.role === "admin") return allSubjects;
    const teacher = await getById("Teacher", user.linkedId);
    return allSubjects.filter(s => teacher && teacher.subjectIds.includes(s.id));
  }

  classSelect.innerHTML = (await classesForCurrentUser()).map(c => `<option value="${c.id}">${c.name}</option>`).join("")
    || `<option value="">لا يوجد فصل مرتبط بك</option>`;
  subjectSelect.innerHTML = (await subjectsForCurrentUser()).map(s => `<option value="${s.id}">${s.name}</option>`).join("")
    || `<option value="">لا يوجد مادة مرتبطة بك</option>`;

  async function renderInputs() {
    const classId = classSelect.value;
    const subjectId = subjectSelect.value;
    const term = termSelect.value;
    const type = typeSelect.value;
    const [students, existing] = await Promise.all([query("Student", s => s.classId === classId), getAll("Grade")]);

    document.getElementById("gradesInputBody").innerHTML = students.map(s => {
      const rec = existing.find(g => g.studentId === s.id && g.subjectId === subjectId && g.term === term && g.type === type);
      return `<tr data-student="${s.id}">
        <td>${s.fullName}</td>
        <td><input type="number" class="score-input" min="0" step="0.5" value="${rec ? rec.score : ''}" style="width:90px;padding:6px 8px;border:1px solid var(--color-border);border-radius:6px;"></td>
        <td><input type="number" class="max-input" min="1" step="0.5" value="${rec ? rec.maxScore : 20}" style="width:90px;padding:6px 8px;border:1px solid var(--color-border);border-radius:6px;"></td>
      </tr>`;
    }).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted);padding:16px;">لا يوجد طلاب في هذا الفصل</td></tr>`;

    renderAverages();
  }

  async function renderAverages() {
    const classId = classSelect.value;
    const subjectId = subjectSelect.value;
    const [students, grades] = await Promise.all([query("Student", s => s.classId === classId), getAll("Grade")]);

    document.getElementById("averagesBody").innerHTML = students.map(s => {
      const studentGrades = grades.filter(g => g.studentId === s.id && g.subjectId === subjectId);
      let avg = "—";
      if (studentGrades.length) {
        const totalPct = studentGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0);
        avg = (totalPct / studentGrades.length).toFixed(1) + " / 20";
      }
      return `<tr><td>${s.fullName}</td><td>${studentGrades.length}</td><td><strong>${avg}</strong></td></tr>`;
    }).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted);padding:16px;">لا يوجد بيانات</td></tr>`;
  }

  document.getElementById("saveGradesBtn").addEventListener("click", async () => {
    const classId = classSelect.value;
    const subjectId = subjectSelect.value;
    const term = termSelect.value;
    const type = typeSelect.value;
    if (!classId || !subjectId) { showToast("يرجى اختيار الفصل والمادة", "error"); return; }

    const existing = await getAll("Grade");
    let count = 0;
    const rows = Array.from(document.querySelectorAll("#gradesInputBody tr[data-student]"));

    for (const row of rows) {
      const studentId = row.dataset.student;
      const score = row.querySelector(".score-input").value;
      const maxScore = row.querySelector(".max-input").value;
      if (score === "" || score === null) continue;

      const rec = existing.find(g => g.studentId === studentId && g.subjectId === subjectId && g.term === term && g.type === type);
      const data = { studentId, subjectId, term, type, score: Number(score), maxScore: Number(maxScore) || 20 };
      if (rec) await updateRecord("Grade", rec.id, data);
      else await addRecord("Grade", data);
      count++;
    }

    showToast(`تم حفظ درجات ${count} طالب بنجاح`, "success");
    renderInputs();
  });

  [classSelect, subjectSelect, termSelect, typeSelect].forEach(el => el.addEventListener("change", renderInputs));
  if (classSelect.value && subjectSelect.value) renderInputs();
})();
