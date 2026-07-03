
DROP FUNCTION IF EXISTS public.get_teacher_questions(text);

CREATE OR REPLACE FUNCTION public.get_teacher_questions(p_subject text)
RETURNS SETOF public.teacher_question_bank_view
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.teacher_question_bank_view
  WHERE subject = p_subject
  ORDER BY question_number ASC, created_at ASC;
$$;

DROP POLICY IF EXISTS "select_questions" ON public.question_bank;
CREATE POLICY "select_questions" ON public.question_bank
FOR SELECT USING (
  is_admin() OR is_system_admin() OR (teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "update_questions" ON public.question_bank;
CREATE POLICY "update_questions" ON public.question_bank
FOR UPDATE USING (
  is_admin() OR is_system_admin() OR (is_teacher() AND teacher_id = auth.uid())
);

DROP POLICY IF EXISTS "select_text_questions" ON public.text_question_bank;
CREATE POLICY "select_text_questions" ON public.text_question_bank
FOR SELECT USING (
  is_admin() OR is_system_admin() OR (
    is_teacher() AND subject = (
      SELECT p.subject FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
    )
  )
);

DROP POLICY IF EXISTS "teachers_delete_text_questions" ON public.text_question_bank;
CREATE POLICY "teachers_delete_text_questions" ON public.text_question_bank
FOR DELETE USING (
  is_teacher() AND subject = (
    SELECT p.subject FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

DROP POLICY IF EXISTS "teachers_update_visibility" ON public.text_question_bank;
CREATE POLICY "teachers_update_visibility" ON public.text_question_bank
FOR UPDATE USING (
  is_teacher() AND subject = (
    SELECT p.subject FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
) WITH CHECK (
  is_teacher() AND subject = (
    SELECT p.subject FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

DROP POLICY IF EXISTS "insert_attempts" ON public.student_attempts;
CREATE POLICY "insert_attempts" ON public.student_attempts
FOR INSERT WITH CHECK (
  is_admin() OR is_system_admin()
);

DROP POLICY IF EXISTS "insert_answers" ON public.student_answers;
CREATE POLICY "insert_answers" ON public.student_answers
FOR INSERT WITH CHECK (
  is_admin() OR is_system_admin()
);

DROP POLICY IF EXISTS "public_read_images" ON storage.objects;
CREATE POLICY "public_read_images" ON storage.objects
FOR SELECT TO public
USING (
  bucket_id = 'question-images'
  AND (storage.foldername(name))[1] = 'shared'
);

DROP POLICY IF EXISTS "authenticated_read_own_images" ON storage.objects;
CREATE POLICY "authenticated_read_own_images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'question-images'
  AND (
    (storage.foldername(name))[1] = 'shared'
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin()
    OR public.is_system_admin()
  )
);

DROP POLICY IF EXISTS "authenticated_upload_images" ON storage.objects;
CREATE POLICY "authenticated_upload_images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'question-images'
  AND (public.is_teacher() OR public.is_admin() OR public.is_system_admin())
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] = 'shared'
    OR public.is_admin()
    OR public.is_system_admin()
  )
);

DROP POLICY IF EXISTS "authenticated_update_images" ON storage.objects;
CREATE POLICY "authenticated_update_images" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'question-images'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin()
    OR public.is_system_admin()
  )
);

DROP POLICY IF EXISTS "authenticated_delete_images" ON storage.objects;
CREATE POLICY "authenticated_delete_images" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'question-images'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin()
    OR public.is_system_admin()
  )
);
