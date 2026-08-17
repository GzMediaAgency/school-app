// js/supabase-client.js — إعداد الاتصال بمشروع Supabase الخاص بك
//
// ⚠️ خطوات إلزامية قبل التشغيل:
// 1) أنشئ مشروعًا مجانيًا على https://supabase.com
// 2) نفّذ ملف supabase_schema.sql كاملًا عبر SQL Editor في لوحة Supabase
// 3) اذهب إلى Settings → API وانسخ القيمتين التاليتين وضعهما هنا:

const SUPABASE_URL = "https://wuddkofguxsjxlwjfkjr.supabase.co"; // مثال: https://xxxxxxxx.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1ZGRrb2ZndXhzanhsd2pma2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MjUyMjUsImV4cCI6MjEwMjQwMTIyNX0.GoyflvrVUXN2lf1MBd3RQ5_qrQRJhRU1OqWZ_Bh3RHk";

// تحميل مكتبة Supabase عبر CDN (لا حاجة لأي أداة تجميع/بناء)
// تُضاف تلقائيًا في كل صفحة عبر: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
