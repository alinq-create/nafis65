
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');

-- 2. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 4. Create class_permissions table
CREATE TABLE public.class_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_class INT NOT NULL,
  to_class INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create question_bank table
CREATE TABLE public.question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL DEFAULT 'رياضيات',
  page_number INT NOT NULL,
  question_number INT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'اختيار متعدد',
  page_image_name TEXT NOT NULL,
  frame_top FLOAT NOT NULL DEFAULT 0,
  frame_left FLOAT NOT NULL DEFAULT 0,
  frame_width FLOAT NOT NULL DEFAULT 1,
  frame_height FLOAT NOT NULL DEFAULT 1,
  correct_answer TEXT NOT NULL,
  visible_to_students BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create exams table
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exam_name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'رياضيات',
  target_classes INT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'مسودة',
  exam_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Create exam_questions table
CREATE TABLE public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.question_bank(id) ON DELETE CASCADE NOT NULL,
  question_order INT NOT NULL DEFAULT 1,
  UNIQUE (exam_id, question_id)
);

-- 8. Create student_attempts table
CREATE TABLE public.student_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  class_number INT NOT NULL,
  submission_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_score FLOAT,
  approved_score FLOAT,
  status TEXT NOT NULL DEFAULT 'بانتظار الاعتماد'
);

-- 9. Create student_answers table
CREATE TABLE public.student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES public.student_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.question_bank(id) ON DELETE CASCADE NOT NULL,
  student_answer TEXT,
  auto_correct BOOLEAN
);

-- 10. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;

-- 11. Helper functions (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'teacher')
$$;

-- 12. Auto-generate exam code function
CREATE OR REPLACE FUNCTION public.generate_exam_code(p_subject TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INT;
  new_code TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(exam_code, '-', 2) AS INT)
  ), 100) + 1
  INTO next_num
  FROM public.exams
  WHERE subject = p_subject;
  
  new_code := p_subject || '-' || next_num::TEXT;
  RETURN new_code;
END;
$$;

-- 13. Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_question_bank_updated_at
  BEFORE UPDATE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 14. RLS Policies for profiles
CREATE POLICY "admins_select_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "admins_insert_profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "admins_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "admins_delete_profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 15. RLS Policies for user_roles
CREATE POLICY "admins_select_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY "admins_insert_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admins_update_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "admins_delete_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 16. RLS Policies for class_permissions
CREATE POLICY "select_class_permissions" ON public.class_permissions
  FOR SELECT TO authenticated
  USING (public.is_admin() OR teacher_id = auth.uid());

CREATE POLICY "insert_class_permissions" ON public.class_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "update_class_permissions" ON public.class_permissions
  FOR UPDATE TO authenticated
  USING (public.is_admin());

CREATE POLICY "delete_class_permissions" ON public.class_permissions
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 17. RLS Policies for question_bank
CREATE POLICY "select_questions" ON public.question_bank
  FOR SELECT TO authenticated
  USING (public.is_admin() OR teacher_id = auth.uid());

CREATE POLICY "insert_questions" ON public.question_bank
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_teacher() AND teacher_id = auth.uid()));

CREATE POLICY "update_questions" ON public.question_bank
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_teacher() AND teacher_id = auth.uid()));

CREATE POLICY "delete_questions" ON public.question_bank
  FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_teacher() AND teacher_id = auth.uid()));

-- 18. RLS Policies for exams
CREATE POLICY "select_exams" ON public.exams
  FOR SELECT TO authenticated
  USING (public.is_admin() OR teacher_id = auth.uid());

CREATE POLICY "insert_exams" ON public.exams
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_teacher() AND teacher_id = auth.uid()));

CREATE POLICY "update_exams" ON public.exams
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_teacher() AND teacher_id = auth.uid()));

CREATE POLICY "delete_exams" ON public.exams
  FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_teacher() AND teacher_id = auth.uid()));

-- 19. RLS Policies for exam_questions
CREATE POLICY "select_exam_questions" ON public.exam_questions
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND teacher_id = auth.uid())
  );

CREATE POLICY "insert_exam_questions" ON public.exam_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND teacher_id = auth.uid())
  );

CREATE POLICY "update_exam_questions" ON public.exam_questions
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND teacher_id = auth.uid())
  );

CREATE POLICY "delete_exam_questions" ON public.exam_questions
  FOR DELETE TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND teacher_id = auth.uid())
  );

-- 20. RLS Policies for student_attempts (accessed via edge functions for students)
CREATE POLICY "select_attempts" ON public.student_attempts
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND teacher_id = auth.uid())
  );

CREATE POLICY "update_attempts" ON public.student_attempts
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.exams WHERE id = exam_id AND teacher_id = auth.uid())
  );

CREATE POLICY "delete_attempts" ON public.student_attempts
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 21. RLS Policies for student_answers (accessed via edge functions for students)
CREATE POLICY "select_answers" ON public.student_answers
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.student_attempts sa
      JOIN public.exams e ON e.id = sa.exam_id
      WHERE sa.id = attempt_id AND e.teacher_id = auth.uid()
    )
  );

CREATE POLICY "update_answers" ON public.student_answers
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.student_attempts sa
      JOIN public.exams e ON e.id = sa.exam_id
      WHERE sa.id = attempt_id AND e.teacher_id = auth.uid()
    )
  );

-- 22. Storage bucket for question images
INSERT INTO storage.buckets (id, name, public) VALUES ('question-images', 'question-images', true);

CREATE POLICY "authenticated_upload_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "authenticated_update_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'question-images');

CREATE POLICY "authenticated_delete_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'question-images');

CREATE POLICY "public_read_images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'question-images');
