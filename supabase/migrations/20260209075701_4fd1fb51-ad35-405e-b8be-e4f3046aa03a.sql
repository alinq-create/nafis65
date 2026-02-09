
-- 1. Create is_system_admin() helper function
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'system_admin')
$$;

-- 2. Update question_bank RLS policies
DROP POLICY IF EXISTS "select_questions" ON public.question_bank;
CREATE POLICY "select_questions" ON public.question_bank
FOR SELECT USING (
  is_admin() OR is_system_admin() OR (teacher_id = auth.uid()) OR (
    is_teacher() AND subject = (
      SELECT p.subject FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
    )
  )
);

DROP POLICY IF EXISTS "insert_questions" ON public.question_bank;
CREATE POLICY "insert_questions" ON public.question_bank
FOR INSERT WITH CHECK (
  is_admin() OR is_system_admin() OR (is_teacher() AND (teacher_id = auth.uid()))
);

DROP POLICY IF EXISTS "update_questions" ON public.question_bank;
CREATE POLICY "update_questions" ON public.question_bank
FOR UPDATE USING (
  is_admin() OR is_system_admin() OR (is_teacher() AND (teacher_id = auth.uid()))
);

DROP POLICY IF EXISTS "delete_questions" ON public.question_bank;
CREATE POLICY "delete_questions" ON public.question_bank
FOR DELETE USING (
  is_admin() OR is_system_admin() OR (is_teacher() AND (teacher_id = auth.uid()))
);

-- 3. Update profiles RLS
DROP POLICY IF EXISTS "admins_select_all_profiles" ON public.profiles;
CREATE POLICY "admins_select_all_profiles" ON public.profiles
FOR SELECT USING (is_admin() OR is_system_admin() OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "admins_insert_profiles" ON public.profiles;
CREATE POLICY "admins_insert_profiles" ON public.profiles
FOR INSERT WITH CHECK (is_admin() OR is_system_admin() OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "admins_update_profiles" ON public.profiles;
CREATE POLICY "admins_update_profiles" ON public.profiles
FOR UPDATE USING (is_admin() OR is_system_admin() OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "admins_delete_profiles" ON public.profiles;
CREATE POLICY "admins_delete_profiles" ON public.profiles
FOR DELETE USING (is_admin() OR is_system_admin());

-- 4. Update user_roles RLS
DROP POLICY IF EXISTS "admins_select_roles" ON public.user_roles;
CREATE POLICY "admins_select_roles" ON public.user_roles
FOR SELECT USING (is_admin() OR is_system_admin() OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "admins_insert_roles" ON public.user_roles;
CREATE POLICY "admins_insert_roles" ON public.user_roles
FOR INSERT WITH CHECK (is_admin() OR is_system_admin());

DROP POLICY IF EXISTS "admins_update_roles" ON public.user_roles;
CREATE POLICY "admins_update_roles" ON public.user_roles
FOR UPDATE USING (is_admin() OR is_system_admin());

DROP POLICY IF EXISTS "admins_delete_roles" ON public.user_roles;
CREATE POLICY "admins_delete_roles" ON public.user_roles
FOR DELETE USING (is_admin() OR is_system_admin());

-- 5. Update exams RLS
DROP POLICY IF EXISTS "select_exams" ON public.exams;
CREATE POLICY "select_exams" ON public.exams
FOR SELECT USING (is_admin() OR is_system_admin() OR (teacher_id = auth.uid()));

DROP POLICY IF EXISTS "insert_exams" ON public.exams;
CREATE POLICY "insert_exams" ON public.exams
FOR INSERT WITH CHECK (is_admin() OR is_system_admin() OR (is_teacher() AND (teacher_id = auth.uid())));

DROP POLICY IF EXISTS "update_exams" ON public.exams;
CREATE POLICY "update_exams" ON public.exams
FOR UPDATE USING (is_admin() OR is_system_admin() OR (is_teacher() AND (teacher_id = auth.uid())));

DROP POLICY IF EXISTS "delete_exams" ON public.exams;
CREATE POLICY "delete_exams" ON public.exams
FOR DELETE USING (is_admin() OR is_system_admin() OR (is_teacher() AND (teacher_id = auth.uid())));

-- 6. Update class_permissions RLS
DROP POLICY IF EXISTS "select_class_permissions" ON public.class_permissions;
CREATE POLICY "select_class_permissions" ON public.class_permissions
FOR SELECT USING (is_admin() OR is_system_admin() OR (teacher_id = auth.uid()));

DROP POLICY IF EXISTS "insert_class_permissions" ON public.class_permissions;
CREATE POLICY "insert_class_permissions" ON public.class_permissions
FOR INSERT WITH CHECK (is_admin() OR is_system_admin());

DROP POLICY IF EXISTS "update_class_permissions" ON public.class_permissions;
CREATE POLICY "update_class_permissions" ON public.class_permissions
FOR UPDATE USING (is_admin() OR is_system_admin());

DROP POLICY IF EXISTS "delete_class_permissions" ON public.class_permissions;
CREATE POLICY "delete_class_permissions" ON public.class_permissions
FOR DELETE USING (is_admin() OR is_system_admin());

-- 7. Update student_attempts RLS
DROP POLICY IF EXISTS "select_attempts" ON public.student_attempts;
CREATE POLICY "select_attempts" ON public.student_attempts
FOR SELECT USING (
  is_admin() OR is_system_admin() OR (EXISTS (
    SELECT 1 FROM exams WHERE exams.id = student_attempts.exam_id AND exams.teacher_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "update_attempts" ON public.student_attempts;
CREATE POLICY "update_attempts" ON public.student_attempts
FOR UPDATE USING (
  is_admin() OR is_system_admin() OR (EXISTS (
    SELECT 1 FROM exams WHERE exams.id = student_attempts.exam_id AND exams.teacher_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "delete_attempts" ON public.student_attempts;
CREATE POLICY "delete_attempts" ON public.student_attempts
FOR DELETE USING (is_admin() OR is_system_admin());

-- 8. Update student_answers RLS
DROP POLICY IF EXISTS "select_answers" ON public.student_answers;
CREATE POLICY "select_answers" ON public.student_answers
FOR SELECT USING (
  is_admin() OR is_system_admin() OR (EXISTS (
    SELECT 1 FROM student_attempts sa JOIN exams e ON e.id = sa.exam_id
    WHERE sa.id = student_answers.attempt_id AND e.teacher_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "update_answers" ON public.student_answers;
CREATE POLICY "update_answers" ON public.student_answers
FOR UPDATE USING (
  is_admin() OR is_system_admin() OR (EXISTS (
    SELECT 1 FROM student_attempts sa JOIN exams e ON e.id = sa.exam_id
    WHERE sa.id = student_answers.attempt_id AND e.teacher_id = auth.uid()
  ))
);

-- 9. Update exam_questions RLS
DROP POLICY IF EXISTS "select_exam_questions" ON public.exam_questions;
CREATE POLICY "select_exam_questions" ON public.exam_questions
FOR SELECT USING (
  is_admin() OR is_system_admin() OR (EXISTS (
    SELECT 1 FROM exams WHERE exams.id = exam_questions.exam_id AND exams.teacher_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "insert_exam_questions" ON public.exam_questions;
CREATE POLICY "insert_exam_questions" ON public.exam_questions
FOR INSERT WITH CHECK (
  is_admin() OR is_system_admin() OR (EXISTS (
    SELECT 1 FROM exams WHERE exams.id = exam_questions.exam_id AND exams.teacher_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "update_exam_questions" ON public.exam_questions;
CREATE POLICY "update_exam_questions" ON public.exam_questions
FOR UPDATE USING (
  is_admin() OR is_system_admin() OR (EXISTS (
    SELECT 1 FROM exams WHERE exams.id = exam_questions.exam_id AND exams.teacher_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "delete_exam_questions" ON public.exam_questions;
CREATE POLICY "delete_exam_questions" ON public.exam_questions
FOR DELETE USING (
  is_admin() OR is_system_admin() OR (EXISTS (
    SELECT 1 FROM exams WHERE exams.id = exam_questions.exam_id AND exams.teacher_id = auth.uid()
  ))
);
