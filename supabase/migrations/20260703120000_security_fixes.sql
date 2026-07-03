-- =====================================================
-- Security fixes migration
-- =====================================================

-- 1. get_teacher_questions() - switch to SECURITY INVOKER so RLS applies
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

-- 2. question_bank SELECT policy - restrict cross-teacher answer visibility.
-- Teachers can only read their own questions or admin-level access.
DROP POLICY IF EXISTS "select_questions" ON public.question_bank;
CREATE POLICY "select_questions" ON public.question_bank
FOR SELECT USING (
  is_admin() OR is_system_admin() OR (teacher_id = auth.uid())
);

-- Same tightening for update_questions - only owners/admins may modify.
DROP POLICY IF EXISTS "update_questions" ON public.question_bank;
CREATE POLICY "update_questions" ON public.question_bank
FOR UPDATE USING (
  is_admin() OR is_system_admin() OR (is_teacher() AND teacher_id = auth.uid())
);

-- 3. text_question_bank SELECT - restrict to teachers whose subject matches
DROP POLICY IF EXISTS "select_text_questions" ON public.text_question_bank;
CREATE POLICY "select_text_questions" ON public.text_question_bank
FOR SELECT USING (
  is_admin() OR is_system_admin() OR (
    is_teacher() AND subject = (
      SELECT p.subject FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
    )
  )
);

-- 4. text_question_bank DELETE - restrict to teachers whose subject matches
DROP POLICY IF EXISTS "teachers_delete_text_questions" ON public.text_question_bank;
CREATE POLICY "teachers_delete_text_questions" ON public.text_question_bank
FOR DELETE USING (
  is_teacher() AND subject = (
    SELECT p.subject FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1
  )
);

-- Tighten update_text_questions similarly (already admin-only, keep it)
-- teachers_update_visibility remains for visibility only; keep as is but scope to subject:
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

-- 5. student_attempts - explicit restrictive INSERT policy.
-- All legitimate inserts go through the submit-exam edge function using service_role,
-- which bypasses RLS. Direct client inserts must be blocked.
DROP POLICY IF EXISTS "insert_attempts" ON public.student_attempts;
CREATE POLICY "insert_attempts" ON public.student_attempts
FOR INSERT WITH CHECK (
  is_admin() OR is_system_admin()
);

-- Also block direct student_answers inserts from clients
DROP POLICY IF EXISTS "insert_answers" ON public.student_answers;
CREATE POLICY "insert_answers" ON public.student_answers
FOR INSERT WITH CHECK (
  is_admin() OR is_system_admin()
);

-- 6. Storage bucket - keep publicly readable for the shared/ folder only
-- (student flow is anonymous), but scope UPDATE/DELETE to file owner.
-- Public bucket flag drives auto-generated public URLs; we retain it to
-- keep the student experience working, and rely on tight write policies.

-- Restrict public read to shared/ prefix only (protect teacher private folders)
DROP POLICY IF EXISTS "public_read_images" ON storage.objects;
CREATE POLICY "public_read_images" ON storage.objects
FOR SELECT TO public
USING (
  bucket_id = 'question-images'
  AND (storage.foldername(name))[1] = 'shared'
);

-- Authenticated users can read their own folder as well as shared
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

-- Uploads: only into own folder or shared/ (teachers/admins only)
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

-- Update: only own files (or admin)
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

-- Delete: only own files (or admin)
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

-- Mark the bucket as non-public to satisfy the public-bucket finding;
-- reads are still allowed via the storage.objects SELECT policy above.
UPDATE storage.buckets SET public = false WHERE id = 'question-images';
