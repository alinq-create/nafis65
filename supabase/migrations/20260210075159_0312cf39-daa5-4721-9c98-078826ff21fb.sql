DROP POLICY "update_questions" ON public.question_bank;
CREATE POLICY "update_questions" ON public.question_bank
  FOR UPDATE USING (
    is_admin() OR is_system_admin() 
    OR (is_teacher() AND teacher_id = auth.uid())
    OR (is_teacher() AND subject = (
      SELECT p.subject FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1
    ))
  );