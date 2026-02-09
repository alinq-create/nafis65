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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is system_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Decode JWT to get user id
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Verify system_admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "system_admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "ليس لديك صلاحية مدير النظام" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { questions } = await req.json();

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "لا توجد أسئلة لاستيرادها" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Deduplication: find existing questions by (subject, page_number, question_number) ───

    // Collect unique subjects for the query
    const subjects = [...new Set(questions.map((q: any) => q.subject || "رياضيات"))];

    // Fetch existing questions for these subjects
    const { data: existingQuestions } = await adminClient
      .from("question_bank")
      .select("subject, page_number, question_number")
      .in("subject", subjects);

    // Build a set of "subject|page|question" keys for fast lookup
    const existingKeys = new Set<string>();
    if (existingQuestions) {
      for (const eq of existingQuestions) {
        existingKeys.add(`${eq.subject}|${eq.page_number}|${eq.question_number}`);
      }
    }

    // Filter out duplicates
    const newQuestions = questions.filter((q: any) => {
      const key = `${q.subject || "رياضيات"}|${q.page_number}|${q.question_number}`;
      return !existingKeys.has(key);
    });

    const skippedCount = questions.length - newQuestions.length;

    if (newQuestions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        importedCount: 0,
        skippedCount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build rows for insertion
    const rows = newQuestions.map((q: any) => ({
      teacher_id: userId,
      subject: q.subject || "رياضيات",
      page_number: q.page_number,
      question_number: q.question_number,
      question_type: q.question_type || "اختيار متعدد",
      page_image_name: q.page_image_name,
      frame_top: q.frame_top || 0,
      frame_left: q.frame_left || 0,
      frame_width: q.frame_width || 1,
      frame_height: q.frame_height || 1,
      correct_answer: q.correct_answer,
      visible_to_students: q.visible_to_students !== undefined ? q.visible_to_students : true,
      notes: q.notes || null,
    }));

    const { data: inserted, error: insertError } = await adminClient
      .from("question_bank")
      .insert(rows)
      .select("id");

    if (insertError) {
      return new Response(JSON.stringify({ error: `خطأ في إدراج الأسئلة: ${insertError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      importedCount: inserted?.length || 0,
      skippedCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
