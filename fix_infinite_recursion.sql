-- fix_infinite_recursion.sql — إصلاح خطأ 500 الناتج عن تكرار لا نهائي في RLS
-- نفّذه في Supabase → SQL Editor → New Query → Run
--
-- السبب: get_my_school_id() تستعلم عن profiles، وجدول profiles نفسه
-- محمي بسياسة RLS تستدعي get_my_school_id() → حلقة لا نهائية.
-- الحل: نجعل الدالتين SECURITY DEFINER بحيث تتجاوزان RLS عند تنفيذهما داخليًا.

create or replace function get_my_school_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select school_id from profiles where id = auth.uid();
$$;

create or replace function get_my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ملاحظة: SECURITY DEFINER يجعل الدالة تُنفَّذ بصلاحيات من أنشأها (مالك القاعدة)
-- بدل صلاحيات المستخدم المستدعي — وهذا آمن هنا لأن الدالة تُرجع فقط
-- school_id/role الخاصين بـ auth.uid() الحالي، ولا تكشف بيانات مستخدمين آخرين.
