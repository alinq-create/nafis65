
-- Create unified view combining both question banks
CREATE OR REPLACE VIEW public.teacher_question_bank_view AS
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

-- Create RPC function to query the unified view
CREATE OR REPLACE FUNCTION public.get_teacher_questions(p_subject text)
RETURNS TABLE(
  id uuid,
  source text,
  subject text,
  grade text,
  semester text,
  question_number integer,
  question_type text,
  question_text text,
  correct_answer text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  page_image_name text,
  teacher_id uuid,
  frame_top double precision,
  frame_left double precision,
  frame_width double precision,
  frame_height double precision,
  visible_to_students boolean,
  notes text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.teacher_question_bank_view
  WHERE subject = p_subject
  ORDER BY question_number ASC, created_at ASC;
$$;
