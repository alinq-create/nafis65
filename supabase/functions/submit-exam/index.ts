import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeArabic(text: string): string {
  if (!text) return "";
  return text.replace(/[أإآٱ]/g, "ا");
}

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

    const { examId, studentName, classNumber, answers } = await req.json();

    if (!examId || !studentName || !classNumber || !answers) {
      return new Response(JSON.stringify({ error: "بيانات غير مكتملة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify exam exists and is published
    const { data: exam } = await adminClient
      .from("exams")
      .select("id, status, target_classes")
      .eq("id", examId)
      .single();

    if (!exam || exam.status !== "منشور") {
      return new Response(JSON.stringify({ error: "الاختبار غير متاح" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!exam.target_classes.includes(classNumber)) {
      return new Response(JSON.stringify({ error: "فصلك غير مستهدف" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get correct answers for auto-scoring from both question banks
    const questionIds = answers.map((a: any) => a.questionId);
    
    const { data: imgAnswers } = await adminClient
      .from("question_bank")
      .select("id, correct_answer, question_type")
      .in("id", questionIds);

    const correctMap = new Map(imgAnswers?.map((q) => [q.id, q]) ?? []);

    // Find IDs not in question_bank and search text_question_bank
    const missingIds = questionIds.filter((id: string) => !correctMap.has(id));
    if (missingIds.length > 0) {
      const { data: textAnswers } = await adminClient
        .from("text_question_bank")
        .select("id, correct_answer, question_type")
        .in("id", missingIds);
      textAnswers?.forEach((q) => correctMap.set(q.id, q));
    }

    // Calculate auto score
    let correctCount = 0;
    const studentAnswers = answers.map((a: any) => {
      const correct = correctMap.get(a.questionId);
      const isCorrect = correct
        ? normalizeArabic(a.answer?.trim().toLowerCase()) === normalizeArabic(correct.correct_answer?.trim().toLowerCase())
        : false;
      if (isCorrect) correctCount++;

      return {
        question_id: a.questionId,
        student_answer: a.answer || null,
        auto_correct: isCorrect,
      };
    });

    // Create attempt
    const { data: attempt, error: attemptError } = await adminClient
      .from("student_attempts")
      .insert({
        exam_id: examId,
        student_name: studentName,
        class_number: classNumber,
        auto_score: correctCount,
        status: "بانتظار الاعتماد",
      })
      .select()
      .single();

    if (attemptError) {
      throw attemptError;
    }

    // Insert answers
    const answersToInsert = studentAnswers.map((a: any) => ({
      ...a,
      attempt_id: attempt.id,
    }));

    const { error: answersError } = await adminClient.from("student_answers").insert(answersToInsert);

    if (answersError) {
      throw answersError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
