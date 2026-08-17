// js/db.js — طبقة قاعدة البيانات السحابية (Supabase) — تستبدل localStorage
//
// نفس أسماء الدوال المستخدمة سابقًا (addRecord, getAll, updateRecord...) للحفاظ
// على أقل قدر من التعديل في صفحات التطبيق — لكنها أصبحت الآن غير متزامنة
// (async/await)، لأنها تتصل فعليًا بخادم Supabase عبر الشبكة.
//
// عزل بيانات كل مدرسة يتم تلقائيًا عبر Row Level Security في قاعدة البيانات
// (انظر supabase_schema.sql) — لا حاجة لتصفية schoolId يدويًا في كل استعلام،
// لكننا نُضيفه تلقائيًا عند الإضافة (Insert) لأن RLS يتطلب وجوده مسبقًا.

// تحويل بين تسمية JS (camelCase) وتسمية قاعدة البيانات (snake_case)
function _toSnake(obj) {
  if (Array.isArray(obj) || obj === null || typeof obj !== "object") return obj;
  const out = {};
  Object.keys(obj).forEach(k => {
    const snakeKey = k.replace(/[A-Z]/g, m => "_" + m.toLowerCase());
    out[snakeKey] = obj[k];
  });
  return out;
}

function _toCamel(obj) {
  if (Array.isArray(obj)) return obj.map(_toCamel);
  if (obj === null || typeof obj !== "object") return obj;
  const out = {};
  Object.keys(obj).forEach(k => {
    const camelKey = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = obj[k];
  });
  return out;
}

// خريطة: اسم المخطط المستخدم في الصفحات → اسم الجدول الفعلي في Supabase
const TABLE_MAP = {
  Student: "students",
  Teacher: "teachers",
  ParentGuardian: "parents",
  Class: "classes",
  Subject: "subjects",
  Timetable: "timetable",
  Attendance: "attendance",
  Grade: "grades",
  Certificate: "certificates",
  Payment: "payments",
  Expense: "expenses",
  Notification: "notifications"
};

let _cachedProfile = null;

async function getMyProfile() {
  if (_cachedProfile) return _cachedProfile;
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single();
  if (error) { console.error(error); return null; }
  _cachedProfile = _toCamel(data);
  return _cachedProfile;
}

function clearProfileCache() { _cachedProfile = null; _cachedSchool = null; }

async function updateSchoolCertificateTemplate(base64Image) {
  const profile = await getMyProfile();
  if (!profile) return null;
  const { data, error } = await supabaseClient.from("schools").update({ certificate_template: base64Image }).eq("id", profile.schoolId).select().single();
  if (error) { console.error(error); showToast("خطأ أثناء حفظ التصميم: " + error.message, "error"); return null; }
  _cachedSchool = _toCamel(data);
  return _cachedSchool;
}

let _cachedSchool = null;
async function getMySchool() {
  if (_cachedSchool) return _cachedSchool;
  const profile = await getMyProfile();
  if (!profile) return null;
  const { data, error } = await supabaseClient.from("schools").select("*").eq("id", profile.schoolId).single();
  if (error) { console.error(error); return null; }
  _cachedSchool = _toCamel(data);
  return _cachedSchool;
}

async function initDB() {
  // لا حاجة لتهيئة يدوية — Supabase جاهز فور الاتصال. أُبقيت الدالة لتوافق الاستدعاءات القديمة.
  return true;
}

// ---------- دوال CRUD عامة (Async الآن) ----------
async function addRecord(schemaName, data) {
  const table = TABLE_MAP[schemaName];
  const profile = await getMyProfile();
  const payload = _toSnake(Object.assign({ schoolId: profile ? profile.schoolId : null }, data));
  const { data: inserted, error } = await supabaseClient.from(table).insert(payload).select().single();
  if (error) { console.error(error); showToast("خطأ أثناء الحفظ: " + error.message, "error"); return null; }
  return _toCamel(inserted);
}

async function getAll(schemaName) {
  const table = TABLE_MAP[schemaName];
  const { data, error } = await supabaseClient.from(table).select("*");
  if (error) { console.error(error); return []; }
  return _toCamel(data);
}

async function getById(schemaName, id) {
  const table = TABLE_MAP[schemaName];
  const { data, error } = await supabaseClient.from(table).select("*").eq("id", id).single();
  if (error) return null;
  return _toCamel(data);
}

async function updateRecord(schemaName, id, data) {
  const table = TABLE_MAP[schemaName];
  const payload = _toSnake(data);
  const { data: updated, error } = await supabaseClient.from(table).update(payload).eq("id", id).select().single();
  if (error) { console.error(error); showToast("خطأ أثناء التحديث: " + error.message, "error"); return null; }
  return _toCamel(updated);
}

async function deleteRecord(schemaName, id) {
  const table = TABLE_MAP[schemaName];
  const { error } = await supabaseClient.from(table).delete().eq("id", id);
  if (error) { console.error(error); showToast("خطأ أثناء الحذف: " + error.message, "error"); }
}

// بديل عن query(schemaName, predicateFn) السابقة — تُبقي نفس الشكل لتوافق الصفحات القديمة
// (تجلب كل السجلات المسموح بها عبر RLS ثم تُصفّي في JS — مناسب لحجم بيانات مدرسة واحدة)
async function query(schemaName, predicateFn) {
  const all = await getAll(schemaName);
  return all.filter(predicateFn);
}

// دالة مساعدة لتسجيل مدرسة جديدة (تُستدعى من صفحة التسجيل signup.html)
async function registerSchool(schoolName, schoolSlug, adminName) {
  const { data, error } = await supabaseClient.rpc("register_school", {
    p_school_name: schoolName,
    p_school_slug: schoolSlug,
    p_admin_name: adminName
  });
  if (error) throw error;
  return data; // school_id الجديد
}
