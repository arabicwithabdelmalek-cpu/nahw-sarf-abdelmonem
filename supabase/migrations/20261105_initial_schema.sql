-- Nahw & Sarf: independent Supabase project only. Never run against Mawaeidi DB.
-- Private table access is granted solely to authenticated admin users.
-- Administrator membership must be inserted from trusted SQL after signing in.
BEGIN;

CREATE TABLE IF NOT EXISTS public.site_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 160),
  description text NOT NULL DEFAULT '',
  start_date date,
  is_published boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_nahw_sarf_course ON public.courses(is_active) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK(position BETWEEN 1 AND 60),
  lesson_date date NOT NULL,
  subject text NOT NULL DEFAULT 'غير محدد' CHECK (subject IN ('نحو','صرف','غير محدد')),
  title text NOT NULL DEFAULT '',
  start_time time,
  notes text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, position)
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL CHECK (length(trim(content)) > 0),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK(length(trim(full_name)) BETWEEN 2 AND 160),
  contact text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'نشط' CHECK(status IN ('نشط','متوقف')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id,student_id)
);

CREATE TABLE IF NOT EXISTS public.course_finances (
  course_id uuid PRIMARY KEY REFERENCES public.courses(id) ON DELETE CASCADE,
  total_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK(total_fee >= 0),
  notes text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK(amount > 0),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Lock down all permissions by default; allow only deliberate RLS-gated access.
REVOKE ALL ON TABLE public.site_admins,public.courses,public.lessons,public.announcements,
  public.students,public.enrollments,public.course_finances,public.payments FROM anon,authenticated;
GRANT SELECT ON TABLE public.courses,public.lessons,public.announcements TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.courses,public.lessons,public.announcements TO authenticated;
GRANT SELECT ON TABLE public.site_admins TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.students,public.enrollments,public.course_finances,public.payments TO authenticated;

-- Membership is never writable by browser users; only a trusted project administrator
-- inserts a real Supabase Auth user_id through SQL or trusted dashboard.
CREATE POLICY "read own admin membership" ON public.site_admins
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY "public reads published courses" ON public.courses
  FOR SELECT TO anon,authenticated USING (is_published = true);
CREATE POLICY "admins manage courses" ON public.courses
  FOR ALL TO authenticated USING (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  );

CREATE POLICY "public reads published lessons" ON public.lessons
  FOR SELECT TO anon,authenticated USING (
    is_published = true AND EXISTS(
      SELECT 1 FROM public.courses c WHERE c.id = lessons.course_id AND c.is_published = true
    )
  );
CREATE POLICY "admins manage lessons" ON public.lessons
  FOR ALL TO authenticated USING (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  );

CREATE POLICY "public reads published announcements" ON public.announcements
  FOR SELECT TO anon,authenticated USING (is_published = true);
CREATE POLICY "admins manage announcements" ON public.announcements
  FOR ALL TO authenticated USING (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  );

CREATE POLICY "admins manage students" ON public.students
  FOR ALL TO authenticated USING (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  );
CREATE POLICY "admins manage enrollments" ON public.enrollments
  FOR ALL TO authenticated USING (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  );
CREATE POLICY "admins manage finances" ON public.course_finances
  FOR ALL TO authenticated USING (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  );
CREATE POLICY "admins manage payments" ON public.payments
  FOR ALL TO authenticated USING (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.site_admins a WHERE a.user_id = (select auth.uid()))
  );
COMMIT;