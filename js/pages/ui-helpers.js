// js/pages/ui-helpers.js — دوال مساعدة مشتركة عبر كل الصفحات

function showToast(message, type) {
  type = type || "info";
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

const NAV_LINKS = [
  { role: ["admin"], href: "admin-dashboard.html", icon: "📊", label: "لوحة التحكم" },
  { role: ["admin"], href: "students.html", icon: "🎓", label: "الطلاب والفصول" },
  { role: ["admin"], href: "teachers.html", icon: "🧑‍🏫", label: "المدرسون والمواد الدراسية" },
  { role: ["admin"], href: "timetable.html", icon: "🗓️", label: "الجدول الدراسي" },
  { role: ["admin"], href: "attendance.html", icon: "✅", label: "تتبع غياب التلاميذ" },
  { role: ["admin"], href: "grades.html", icon: "📝", label: "الدرجات" },
  { role: ["admin"], href: "certificates.html", icon: "🏅", label: "الشهادات" },
  { role: ["admin"], href: "finance.html", icon: "💰", label: "المالية والمدفوعات" },
  { role: ["admin"], href: "notifications.html", icon: "🔔", label: "الإشعارات" }
];

// تُحقن ديناميكيًا في كل صفحة داخلية
function renderSidebar(activeHref, user, schoolName) {
  const links = NAV_LINKS.filter(l => l.role.includes(user.role));
  const linksHtml = links.map(l =>
    `<a href="${l.href}" class="${l.href === activeHref ? 'active' : ''}">${l.icon} <span>${l.label}</span></a>`
  ).join("");

  const roleLabelMap = { admin: "مدير", teacher: "مدرس", student: "طالب", parent: "ولي أمر" };

  return `
  <aside class="sidebar" id="sidebar">
    <div class="side-header">
      <div class="badge">${(schoolName || "م").charAt(0)}</div>
      <div>
        <strong>${schoolName || "منصة إدارة المدرسة"}</strong>
        <span>${roleLabelMap[user.role] || ""} — ${user.fullName}</span>
      </div>
    </div>
    <nav class="side-nav">${linksHtml}</nav>
    <div class="side-footer">
      <button class="btn btn-outline" onclick="logout()">🚪 تسجيل الخروج</button>
    </div>
  </aside>`;
}

async function mountLayout(activeHref, allowedRoles, pageTitle) {
  const user = await requireRole(allowedRoles);
  if (!user) return null;
  const school = await getMySchool();
  document.getElementById("layout-root").insertAdjacentHTML("afterbegin", renderSidebar(activeHref, user, school ? school.name : null));
  const titleEl = document.getElementById("page-title");
  if (titleEl) titleEl.textContent = pageTitle;
  const toggle = document.getElementById("sidebar-toggle-btn");
  if (toggle) toggle.addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  return user;
}
