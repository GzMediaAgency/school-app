// js/pages/certificates.js — إصدار الشهادات (Async — Supabase)

(async function () {
  const user = await mountLayout("certificates.html", ["admin"], "الشهادات");
  if (!user) return;
  document.getElementById("userNameChip").textContent = user.fullName;

  const school = await getMySchool();
  const certSchoolEl = document.getElementById("certSchoolName");
  if (certSchoolEl && school) certSchoolEl.textContent = school.name;

  const certPreviewEl = document.getElementById("certPreview");

  function applyTemplate(base64) {
    if (base64) {
      certPreviewEl.style.backgroundImage = `url(${base64})`;
      certPreviewEl.classList.add("has-template");
      document.getElementById("templateThumb").src = base64;
      document.getElementById("templateThumb").style.display = "inline-block";
      document.getElementById("templateStatus").textContent = "تصميم مدرستك مرفوع ومُفعَّل حاليًا.";
      document.getElementById("removeTemplateBtn").style.display = "inline-flex";
    } else {
      certPreviewEl.style.backgroundImage = "";
      certPreviewEl.classList.remove("has-template");
      document.getElementById("templateThumb").style.display = "none";
      document.getElementById("templateStatus").textContent = "لم يتم رفع أي تصميم بعد — سيُستخدم التصميم الافتراضي.";
      document.getElementById("removeTemplateBtn").style.display = "none";
    }
  }

  applyTemplate(school ? school.certificateTemplate : null);

  document.getElementById("uploadTemplateBtn").addEventListener("click", () => document.getElementById("templateFileInput").click());

  document.getElementById("templateFileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      showToast("حجم الصورة كبير جدًا — يرجى اختيار صورة أصغر من 1.5MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      const updated = await updateSchoolCertificateTemplate(base64);
      if (updated) {
        applyTemplate(base64);
        showToast("تم حفظ تصميم الشهادة بنجاح", "success");
      }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("removeTemplateBtn").addEventListener("click", async () => {
    if (!confirm("هل تريد حذف التصميم المرفوع والعودة للتصميم الافتراضي؟")) return;
    await updateSchoolCertificateTemplate(null);
    applyTemplate(null);
    showToast("تم حذف التصميم المرفوع", "success");
  });

  const students = await getAll("Student");
  document.getElementById("certStudent").innerHTML = students.map(s => `<option value="${s.id}">${s.fullName}</option>`).join("")
    || `<option value="">لا يوجد طلاب</option>`;

  const DESC_MAP = {
    "شهادة نجاح": "قد أتم(ت) بنجاح متطلبات المستوى الدراسي خلال هذه السنة، وذلك تقديرًا لجهوده(ا) والتزامه(ا).",
    "شهادة تفوق": "قد حقق(ت) نتائج متميزة وتفوقًا ملحوظًا خلال هذه السنة الدراسية، وذلك تقديرًا لتميزه(ا) واجتهاده(ا).",
    "شهادة مشاركة": "قد شارك(ت) بفعالية والتزام في الأنشطة المدرسية خلال هذه السنة الدراسية."
  };

  async function renderPreview() {
    const studentId = document.getElementById("certStudent").value;
    const type = document.getElementById("certType").value;
    const student = await getById("Student", studentId);
    if (!student) { showToast("يرجى اختيار طالب أولًا", "error"); return; }

    document.getElementById("certTypeTitle").textContent = type;
    document.getElementById("certStudentName").textContent = student.fullName;
    document.getElementById("certDesc").textContent = DESC_MAP[type];
    document.getElementById("certDate").textContent = "تاريخ الإصدار: " + new Date().toLocaleDateString("ar-MA");

    document.getElementById("certPreview").style.display = "block";
    document.getElementById("certActions").style.display = "block";
  }

  async function renderLog() {
    const certs = await getAll("Certificate");
    const rows = await Promise.all(certs.slice().reverse().map(async c => {
      const student = await getById("Student", c.studentId);
      return `<tr><td>${student ? student.fullName : "—"}</td><td>${c.type}</td><td>${new Date(c.issueDate).toLocaleDateString("ar-MA")}</td></tr>`;
    }));
    document.getElementById("certLogBody").innerHTML = rows.join("") || `<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted);padding:16px;">لا يوجد شهادات صادرة بعد</td></tr>`;
  }

  document.getElementById("previewBtn").addEventListener("click", renderPreview);
  document.getElementById("printBtn").addEventListener("click", () => window.print());

  document.getElementById("saveCertBtn").addEventListener("click", async () => {
    const studentId = document.getElementById("certStudent").value;
    const type = document.getElementById("certType").value;
    await addRecord("Certificate", { studentId, type, issueDate: new Date().toISOString(), fileRef: null });
    showToast("تم حفظ الشهادة في السجل", "success");
    renderLog();
  });

  renderLog();
})();
