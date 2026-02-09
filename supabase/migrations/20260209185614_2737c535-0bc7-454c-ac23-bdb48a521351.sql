
-- Fix: recreate view without SECURITY DEFINER (use SECURITY INVOKER which is default)
CREATE OR REPLACE VIEW public.teacher_question_bank_view
WITH (security_invoker = true)
AS
SELECT
  id,
  'image' AS source,
  subject,
  '' AS grade,
  '' AS semester,
  question_number,
  question_type,
  NULL::text AS question_text,
  correct_answer,
  NULL::text AS option_a,
  NULL::text AS option_b,
  NULL::text AS option_c,
  NULL::text AS option_d,
  page_image_name,
  teacher_id,
  frame_top,
  frame_left,
  frame_width,
  frame_height,
  visible_to_students,
  notes,
  created_at
FROM public.question_bank

UNION ALL

SELECT
  id,
  'text' AS source,
  subject,
  grade,
  semester,
  question_number,
  question_type,
  question_text,
  correct_answer,
  option_a,
  option_b,
  option_c,
  option_d,
  NULL::text AS page_image_name,
  imported_by AS teacher_id,
  NULL::double precision AS frame_top,
  NULL::double precision AS frame_left,
  NULL::double precision AS frame_width,
  NULL::double precision AS frame_height,
  true AS visible_to_students,
  notes,
  created_at
FROM public.text_question_bank;
