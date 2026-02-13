
-- Revoke direct SELECT on the view from public roles, forcing access through the RPC only
REVOKE SELECT ON public.teacher_question_bank_view FROM anon, authenticated;
