GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank, public.text_question_bank TO authenticated;
GRANT SELECT ON public.teacher_question_bank_view TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_questions(text) TO authenticated;