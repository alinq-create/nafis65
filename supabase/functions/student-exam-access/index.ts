import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { studentName, classNumber, examCode } = await req.json();

    if (!studentName || !classNumber || !examCode) {
      return new Response(JSON.stringify({ error: "جميع الحقول مطلوبة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the exam
    const { data: exam, error: examError } = await adminClient
      .from("exams")
      .select("id, exam_name, target_classes, status")
      .eq("exam_code", examCode)
      .single();

    if (examError || !exam) {
      return new Response(JSON.stringify({ error: "رمز الاختبار غير صحيح" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (exam.status !== "منشور") {
      return new Response(JSON.stringify({ error: "الاختبار غير متاح حاليًا" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!exam.target_classes.includes(classNumber)) {
      return new Response(JSON.stringify({ error: "فصلك غير مستهدف في هذا الاختبار" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get exam questions (WITHOUT correct_answer)
    const { data: examQuestions } = await adminClient
      .from("exam_questions")
      .select("question_id, question_order")
      .eq("exam_id", exam.id)
      .order("question_order");

    if (!examQuestions?.length) {
      return new Response(JSON.stringify({ error: "لا توجد أسئلة في هذا الاختبار" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questionIds = examQuestions.map((q) => q.question_id);
    const { data: questions } = await adminClient
      .from("question_bank")
      .select("id, question_type, page_image_name, frame_top, frame_left, frame_width, frame_height")
      .in("id", questionIds);

    // Merge with order info
    const orderedQuestions = examQuestions.map((eq) => {
      const q = questions?.find((q) => q.id === eq.question_id);
      return {
        ...q,
        question_order: eq.question_order,
      };
    });

    return new Response(
      JSON.stringify({
        examId: exam.id,
        examName: exam.exam_name,
        questions: orderedQuestions,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
