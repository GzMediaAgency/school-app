// js/supabase-client.js — إعداد الاتصال بمشروع Supabase الخاص بك
//
// ⚠️ خطوات إلزامية قبل التشغيل:
// 1) أنشئ مشروعًا مجانيًا على https://supabase.com
// 2) نفّذ ملف supabase_schema.sql كاملًا عبر SQL Editor في لوحة Supabase
// 3) اذهب إلى Settings → API وانسخ القيمتين التاليتين وضعهما هنا:

const SUPABASE_URL = "ضع-رابط-مشروعك-هنا.supabase.co"; // مثال: https://xxxxxxxx.supabase.co
const SUPABASE_ANON_KEY = "ضع-anon-public-key-هنا";

// تحميل مكتبة Supabase عبر CDN (لا حاجة لأي أداة تجميع/بناء)
// تُضاف تلقائيًا في كل صفحة عبر: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
