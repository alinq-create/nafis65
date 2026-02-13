
-- Add DELETE policy for student_answers (admin only, needed for attempt deletion)
CREATE POLICY "delete_answers"
ON public.student_answers
FOR DELETE
USING (is_admin() OR is_system_admin());
