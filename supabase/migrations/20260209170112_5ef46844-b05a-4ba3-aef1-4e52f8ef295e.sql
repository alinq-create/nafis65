
-- Create text_question_bank table
CREATE TABLE public.text_question_bank (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imported_by UUID NOT NULL,
  subject TEXT NOT NULL DEFAULT 'رياضيات',
  grade TEXT NOT NULL,
  semester TEXT NOT NULL,
  question_number INTEGER NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'اختيار متعدد',
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  correct_answer_text TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicates
ALTER TABLE public.text_question_bank
  ADD CONSTRAINT unique_text_question UNIQUE (subject, grade, semester, question_number);

-- Enable RLS
ALTER TABLE public.text_question_bank ENABLE ROW LEVEL SECURITY;

-- SELECT: admin + system_admin + teacher (no subject filter)
CREATE POLICY "select_text_questions"
  ON public.text_question_bank FOR SELECT
  USING (is_admin() OR is_system_admin() OR is_teacher());

-- INSERT: system_admin only
CREATE POLICY "insert_text_questions"
  ON public.text_question_bank FOR INSERT
  WITH CHECK (is_system_admin());

-- UPDATE: system_admin only
CREATE POLICY "update_text_questions"
  ON public.text_question_bank FOR UPDATE
  USING (is_system_admin());

-- DELETE: system_admin only
CREATE POLICY "delete_text_questions"
  ON public.text_question_bank FOR DELETE
  USING (is_system_admin());
