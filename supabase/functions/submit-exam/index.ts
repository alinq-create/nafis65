import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeArabic(text: string): string {
  if (!text) return "";
  return text.replace(/[أإآٱ]/g, "ا");
}

function validateUUID(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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

    const body = await req.json();
    const { examId, studentName, classNumber, answers } = body;

    // Input validation
    if (!validateUUID(examId)) {
      return new Response(JSON.stringify({ error: "معرف الاختبار غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof studentName !== "string" || studentName.trim().length < 1 || studentName.length > 100) {
      return new Response(JSON.stringify({ error: "اسم الطالبة غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof classNumber !== "number" || !Number.isInteger(classNumber) || classNumber < 1 || classNumber > 20) {
      return new Response(JSON.stringify({ error: "رقم الفصل غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(answers) || answers.length === 0 || answers.length > 200) {
      return new Response(JSON.stringify({ error: "بيانات الإجابات غير صالحة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate each answer
    for (const a of answers) {
      if (!a || !validateUUID(a.questionId)) {
        return new Response(JSON.stringify({ error: "بيانات إجابة غير صالحة" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (a.answer !== undefined && a.answer !== null && (typeof a.answer !== "string" || a.answer.length > 500)) {
        return new Response(JSON.stringify({ error: "نص الإجابة طويل جداً" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const sanitizedName = studentName.trim().slice(0, 100);

    // Verify exam exists and is published
    const { data: exam } = await adminClient
      .from("exams")
      .select("id, status, target_classes")
      .eq("id", examId)
      .single();

    if (!exam || exam.status !== "منشور") {
      return new Response(JSON.stringify({ error: "الاختبار غير متاح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!exam.target_classes.includes(classNumber)) {
      return new Response(JSON.stringify({ error: "فصلك غير مستهدف" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get correct answers for auto-scoring from both question banks
    const questionIds = answers.map((a: any) => a.questionId);
    
    const { data: imgAnswers } = await adminClient
      .from("question_bank")
      .select("id, correct_answer, question_type")
      .in("id", questionIds);

    const correctMap = new Map(imgAnswers?.map((q) => [q.id, q]) ?? []);

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
        student_answer: a.answer ? String(a.answer).slice(0, 500) : null,
        auto_correct: isCorrect,
      };
    });

    // Create attempt
    const { data: attempt, error: attemptError } = await adminClient
      .from("student_attempts")
      .insert({
        exam_id: examId,
        student_name: sanitizedName,
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
    return new Response(JSON.stringify({ error: "حدث خطأ في الخادم" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
