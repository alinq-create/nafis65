
CREATE POLICY "teachers_update_visibility"
ON public.text_question_bank
FOR UPDATE
USING (is_teacher())
WITH CHECK (is_teacher());
