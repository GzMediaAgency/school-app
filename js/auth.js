// js/auth.js — تسجيل الدخول عبر Supabase Auth (بدل localStorage)

async function login(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
  clearProfileCache();
  const profile = await getMyProfile();
  if (!profile) return { ok: false, message: "لا يوجد ملف مستخدم مرتبط بهذا الحساب." };
  return { ok: true, user: profile };
}

async function logout() {
  await supabaseClient.auth.signOut();
  clearProfileCache();
  window.location.href = _isInPagesFolder() ? "../index.html" : "index.html";
}

async function getCurrentUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;
  return await getMyProfile();
}

function _isInPagesFolder() {
  return window.location.pathname.includes("/pages/");
}

function roleHome(role) {
  const map = {
    admin: "admin-dashboard.html",
    teacher: "timetable.html",
    student: "student-dashboard.html",
    parent: "parent-dashboard.html"
  };
  return map[role] || "../index.html";
}

// يُستدعى في بداية كل صفحة داخلية للتحقق من الصلاحية — أصبحت الآن Async
async function requireRole(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "../index.html";
    return null;
  }
  if (!allowedRoles.includes(user.role)) {
    window.location.href = roleHome(user.role);
    return null;
  }
  return user;
}
