import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchAndMergeQuestions(adminClient: any, examId: string) {
  const { data: examQuestions } = await adminClient
    .from("exam_questions")
    .select("question_id, question_order, source_type")
    .eq("exam_id", examId)
    .order("question_order");

  if (!examQuestions?.length) return null;

  const imageIds = examQuestions.filter(q => q.source_type === "image").map(q => q.question_id);
  const textIds = examQuestions.filter(q => q.source_type === "text").map(q => q.question_id);

  const [imageResult, textResult] = await Promise.all([
    imageIds.length > 0
      ? adminClient.from("question_bank").select("id, question_type, page_image_name, frame_top, frame_left, frame_width, frame_height").in("id", imageIds)
      : { data: [] },
    textIds.length > 0
      ? adminClient.from("text_question_bank").select("id, question_type, question_text, option_a, option_b, option_c, option_d").in("id", textIds)
      : { data: [] },
  ]);

  const imageMap = new Map((imageResult.data || []).map(q => [q.id, { ...q, source_type: "image" }]));
  const textMap = new Map((textResult.data || []).map(q => [q.id, { ...q, source_type: "text" }]));

  return examQuestions.map(eq => {
    const q = imageMap.get(eq.question_id) || textMap.get(eq.question_id);
    return { ...q, question_order: eq.question_order };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { studentName, classNumber, subject, examId } = await req.json();

    if (!studentName || !classNumber || !subject) {
      return new Response(JSON.stringify({ error: "جميع الحقول مطلوبة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pattern 2: Fetch specific exam questions
    if (examId) {
      const { data: exam, error: examError } = await adminClient
        .from("exams")
        .select("id, exam_name, target_classes, status, subject")
        .eq("id", examId)
        .single();

      if (examError || !exam) {
        return new Response(JSON.stringify({ error: "الاختبار غير موجود" }), {
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

      if (exam.subject !== subject || !exam.target_classes.includes(classNumber)) {
        return new Response(JSON.stringify({ error: "هذا الاختبار غير متاح لك" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orderedQuestions = await fetchAndMergeQuestions(adminClient, exam.id);
      if (!orderedQuestions) {
        return new Response(JSON.stringify({ error: "لا توجد أسئلة في هذا الاختبار" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ examId: exam.id, examName: exam.exam_name, questions: orderedQuestions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pattern 1: Search for available exams by subject + class
    const { data: exams, error: examsError } = await adminClient
      .from("exams")
      .select("id, exam_name")
      .eq("status", "منشور")
      .eq("subject", subject)
      .contains("target_classes", [classNumber]);

    if (examsError) {
      return new Response(JSON.stringify({ error: "حدث خطأ في البحث عن الاختبارات" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!exams || exams.length === 0) {
      return new Response(
        JSON.stringify({ error: "لا يوجد اختبار متاح الآن لهذه المادة والفصل" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If exactly one exam, return its questions directly
    if (exams.length === 1) {
      const exam = exams[0];
      const orderedQuestions = await fetchAndMergeQuestions(adminClient, exam.id);
      if (!orderedQuestions) {
        return new Response(JSON.stringify({ error: "لا توجد أسئلة في هذا الاختبار" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ examId: exam.id, examName: exam.exam_name, questions: orderedQuestions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multiple exams: return list for selection
    return new Response(
      JSON.stringify({ exams }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
