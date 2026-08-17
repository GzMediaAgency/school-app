-- supabase_schema.sql — مخطط قاعدة بيانات متعدد المدارس (Multi-Tenant) لنظام إدارة المدارس
-- يُنفَّذ داخل: Supabase Dashboard → SQL Editor → New Query → الصق كامل هذا الملف → Run
-- يعتمد على Supabase Auth المدمج (auth.users) لإدارة تسجيل الدخول

-- ============================================================
-- 1) جدول المدارس (كل "مستأجر" Tenant هو سطر هنا)
-- ============================================================
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,                 -- معرّف فريد للمدرسة، مثال: bounouni
  primary_color text default '#1E4FA3',
  logo_url text,
  plan text default 'trial',                 -- trial | basic | pro
  subscription_status text default 'active', -- active | past_due | canceled
  trial_ends_at timestamptz default (now() + interval '14 days'),
  certificate_template text,                  -- تصميم شهادة المدرسة (صورة base64)
  created_at timestamptz default now()
);

-- ============================================================
-- 2) جدول الملفات الشخصية (يمتد من auth.users المدمج في Supabase)
--    يربط كل مستخدم مصادَق عليه بمدرسته ودوره
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin','teacher','student','parent')),
  linked_id uuid,  -- يشير إلى سجل Teacher/Student/ParentGuardian المرتبط (إن وُجد)
  created_at timestamptz default now()
);

-- دالة مساعدة: تُرجع school_id الخاص بالمستخدم الحالي المسجَّل دخوله
-- ⚠️ SECURITY DEFINER إجباري هنا: بدونها تدخل الدالة في تكرار لا نهائي
-- لأنها تستعلم عن profiles، وجدول profiles نفسه محمي بسياسة RLS تستدعي هذه الدالة.
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

-- ============================================================
-- 3) الجداول الوظيفية — كل جدول يحمل school_id إجباريًا
-- ============================================================

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  level text,
  capacity int default 30,
  teacher_id uuid,
  created_at timestamptz default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  level text,
  weekly_hours int default 4
);

create table teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  specialty text,
  subject_ids uuid[] default '{}',
  class_ids uuid[] default '{}'
);

create table parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  phone text,
  address text,
  student_ids uuid[] default '{}'
);

create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  birth_date date,
  class_id uuid references classes(id) on delete set null,
  parent_id uuid references parents(id) on delete set null,
  address text,
  photo text,
  status text default 'active'
);

create table timetable (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete cascade,
  day text not null,
  start_time text not null,
  end_time text not null
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  date date not null,
  status text not null
);

create table grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  term text,
  score numeric,
  max_score numeric default 20,
  type text
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  type text not null,
  issue_date timestamptz default now(),
  file_ref text
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  amount numeric not null,
  due_date date,
  paid_date date,
  month text,
  status text default 'غير مدفوع'
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  category text not null,
  amount numeric not null,
  date date,
  description text
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  target_role text not null,
  target_id uuid,
  message text not null,
  type text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 4) تفعيل Row Level Security (RLS) — القلب الأمني لعزل المدارس
-- ============================================================
alter table schools enable row level security;
alter table profiles enable row level security;
alter table classes enable row level security;
alter table subjects enable row level security;
alter table teachers enable row level security;
alter table parents enable row level security;
alter table students enable row level security;
alter table timetable enable row level security;
alter table attendance enable row level security;
alter table grades enable row level security;
alter table certificates enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table notifications enable row level security;

-- سياسة profiles: كل مستخدم يرى فقط سجلّه الشخصي + سجلات نفس مدرسته (لعرض الأسماء)
create policy "profiles_school_isolation" on profiles
  for select using (school_id = get_my_school_id());
create policy "profiles_self_update" on profiles
  for update using (id = auth.uid());

-- سياسة schools: كل مستخدم يرى فقط مدرسته
create policy "schools_isolation" on schools
  for select using (id = get_my_school_id());

-- سياسة عامة موحّدة لكل الجداول الوظيفية: عزل كامل حسب school_id
-- (تُطبَّق نفس الصيغة على كل جدول من الجداول التالية)
do $$
declare
  tbl text;
begin
  foreach tbl in array array['classes','subjects','teachers','parents','students',
                              'timetable','attendance','grades','certificates',
                              'payments','expenses','notifications']
  loop
    execute format('
      create policy "%1$s_school_isolation_select" on %1$s
        for select using (school_id = get_my_school_id());
    ', tbl);
    execute format('
      create policy "%1$s_school_isolation_insert" on %1$s
        for insert with check (school_id = get_my_school_id());
    ', tbl);
    execute format('
      create policy "%1$s_school_isolation_update" on %1$s
        for update using (school_id = get_my_school_id());
    ', tbl);
    execute format('
      create policy "%1$s_school_isolation_delete" on %1$s
        for delete using (school_id = get_my_school_id());
    ', tbl);
  end loop;
end $$;

-- ============================================================
-- 5) دالة تسجيل مدرسة جديدة + أول حساب مدير (تُستدعى من صفحة التسجيل)
-- ============================================================
create or replace function register_school(
  p_school_name text,
  p_school_slug text,
  p_admin_name text
)
returns uuid
language plpgsql security definer
as $$
declare
  new_school_id uuid;
begin
  insert into schools (name, slug) values (p_school_name, p_school_slug)
  returning id into new_school_id;

  insert into profiles (id, school_id, full_name, role)
  values (auth.uid(), new_school_id, p_admin_name, 'admin');

  return new_school_id;
end;
$$;

-- ============================================================
-- ملاحظات مهمة قبل الاستخدام:
-- 1) هذا الملف يُنشئ البنية فقط — لا بيانات تجريبية هنا.
-- 2) بعد التنفيذ، فعّل "Email confirmations" حسب رغبتك من:
--    Supabase Dashboard → Authentication → Providers → Email
-- 3) احتفظ بـ "Project URL" و "anon public key" من:
--    Supabase Dashboard → Settings → API — ستحتاجهما في js/supabase-client.js
-- ============================================================
