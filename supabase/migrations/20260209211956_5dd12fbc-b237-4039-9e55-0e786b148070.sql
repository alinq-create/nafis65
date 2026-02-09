ALTER TABLE public.exam_questions 
ADD COLUMN source_type text NOT NULL DEFAULT 'image';