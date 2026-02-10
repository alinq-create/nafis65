import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attempt_id } = await req.json();
    if (!attempt_id) {
      return new Response(JSON.stringify({ error: "attempt_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch attempt
    const { data: attempt, error: attemptErr } = await adminClient
      .from("student_attempts")
      .select("*")
      .eq("id", attempt_id)
      .single();

    if (attemptErr || !attempt) {
      return new Response(JSON.stringify({ error: "Attempt not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch exam questions
    const { data: examQuestions } = await adminClient
      .from("exam_questions")
      .select("question_id, source_type, question_order")
      .eq("exam_id", attempt.exam_id)
      .order("question_order", { ascending: true });

    if (!examQuestions?.length) {
      return new Response(
        JSON.stringify({ attempt, questions: [], total_questions: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Split by source
    const imageIds = examQuestions
      .filter((q) => q.source_type === "image")
      .map((q) => q.question_id);
    const textIds = examQuestions
      .filter((q) => q.source_type === "text")
      .map((q) => q.question_id);

    // 4. Fetch question details in parallel
    const [imageResult, textResult, answersResult] = await Promise.all([
      imageIds.length > 0
        ? adminClient
            .from("question_bank")
            .select(
              "id, correct_answer, question_number, question_type, page_image_name, frame_top, frame_left, frame_width, frame_height"
            )
            .in("id", imageIds)
        : { data: [] },
      textIds.length > 0
        ? adminClient
            .from("text_question_bank")
            .select(
              "id, correct_answer, question_number, question_type, question_text, option_a, option_b, option_c, option_d"
            )
            .in("id", textIds)
        : { data: [] },
      adminClient
        .from("student_answers")
        .select("question_id, student_answer, auto_correct")
        .eq("attempt_id", attempt_id),
    ]);

    const imageMap = new Map(
      (imageResult.data ?? []).map((q) => [q.id, q])
    );
    const textMap = new Map(
      (textResult.data ?? []).map((q) => [q.id, q])
    );
    const answerMap = new Map(
      (answersResult.data ?? []).map((a) => [a.question_id, a])
    );

    // 5. Merge
    const questions = examQuestions.map((eq) => {
      const answer = answerMap.get(eq.question_id);
      const isImage = eq.source_type === "image";
      const qData = isImage
        ? imageMap.get(eq.question_id)
        : textMap.get(eq.question_id);

      if (isImage) {
        const img = qData as any;
        return {
          question_id: eq.question_id,
          source_type: "image",
          question_order: eq.question_order,
          question_type: img?.question_type ?? "",
          question_text: null,
          page_image_name: img?.page_image_name ?? null,
          frame_top: img?.frame_top ?? 0,
          frame_left: img?.frame_left ?? 0,
          frame_width: img?.frame_width ?? 1,
          frame_height: img?.frame_height ?? 1,
          options: null,
          correct_answer: img?.correct_answer ?? "",
          student_answer: answer?.student_answer ?? null,
          auto_correct: answer?.auto_correct ?? null,
        };
      } else {
        const txt = qData as any;
        return {
          question_id: eq.question_id,
          source_type: "text",
          question_order: eq.question_order,
          question_type: txt?.question_type ?? "",
          question_text: txt?.question_text ?? "",
          page_image_name: null,
          frame_top: 0,
          frame_left: 0,
          frame_width: 0,
          frame_height: 0,
          options: {
            a: txt?.option_a ?? "",
            b: txt?.option_b ?? "",
            c: txt?.option_c ?? "",
            d: txt?.option_d ?? "",
          },
          correct_answer: txt?.correct_answer ?? "",
          student_answer: answer?.student_answer ?? null,
          auto_correct: answer?.auto_correct ?? null,
        };
      }
    });

    return new Response(
      JSON.stringify({
        attempt,
        questions,
        total_questions: questions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
