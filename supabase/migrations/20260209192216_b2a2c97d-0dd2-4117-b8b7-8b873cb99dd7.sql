
-- Add visible_to_students column to text_question_bank
ALTER TABLE public.text_question_bank 
  ADD COLUMN visible_to_students boolean DEFAULT true NOT NULL;

-- Recreate the view to use actual column value
CREATE OR REPLACE VIEW public.teacher_question_bank_view WITH (security_invoker = true) AS
SELECT
  qb.id,
  'image'::text AS source,
  qb.subject,
  ''::text AS grade,
  ''::text AS semester,
  qb.question_number,
  qb.question_type,
  NULL::text AS question_text,
  qb.correct_answer,
  NULL::text AS option_a,
  NULL::text AS option_b,
  NULL::text AS option_c,
  NULL::text AS option_d,
  qb.page_image_name,
  qb.teacher_id,
  qb.frame_top,
  qb.frame_left,
  qb.frame_width,
  qb.frame_height,
  qb.visible_to_students,
  qb.notes,
  qb.created_at
FROM public.question_bank qb

UNION ALL

SELECT
  tq.id,
  'text'::text AS source,
  tq.subject,
  tq.grade,
  tq.semester,
  tq.question_number,
  tq.question_type,
  tq.question_text,
  tq.correct_answer,
  tq.option_a,
  tq.option_b,
  tq.option_c,
  tq.option_d,
  NULL::text AS page_image_name,
  tq.imported_by AS teacher_id,
  NULL::double precision AS frame_top,
  NULL::double precision AS frame_left,
  NULL::double precision AS frame_width,
  NULL::double precision AS frame_height,
  tq.visible_to_students,
  tq.notes,
  tq.created_at
FROM public.text_question_bank tq;
