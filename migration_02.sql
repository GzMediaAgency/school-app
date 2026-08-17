-- migration_02.sql — تحديثات قاعدة البيانات للميزات الجديدة
-- نفّذه في Supabase → SQL Editor → New Query → Run

-- 1) إضافة حقل "الشهر" لجدول المدفوعات (لتتبع واجبات الدراسة شهريًا)
alter table payments add column if not exists month text;

-- 2) إضافة حقل تصميم الشهادة الخاص بكل مدرسة (صورة بصيغة base64)
alter table schools add column if not exists certificate_template text;
