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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Check system_admin role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "system_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "صلاحية غير كافية" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { questions } = await req.json();
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "لا توجد أسئلة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let importedCount = 0;
    let skippedCount = 0;
    let invalidCount = 0;

    // Collect unique subjects from the batch to pre-fetch existing records
    const subjects = [...new Set(questions.map((q: any) => q.subject).filter(Boolean))];
    
    // Pre-fetch all existing records for these subjects and build a Set of composite keys
    const existingKeys = new Set<string>();
    for (const subj of subjects) {
      let allRows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await adminClient
          .from("text_question_bank")
          .select("subject, grade, semester, question_number, question_text")
          .eq("subject", subj)
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      for (const row of allRows) {
        const key = `${row.subject}|${row.grade}|${row.semester}|${row.question_number}|${row.question_text}`;
        existingKeys.add(key);
      }
    }
    console.log(`Pre-fetched ${existingKeys.size} existing composite keys`);

    for (const q of questions) {
      // Skip rows with empty question_text
      if (!q.question_text || q.question_text.toString().trim() === '') {
        invalidCount++;
        continue;
      }

      const compositeKey = `${q.subject}|${q.grade}|${q.semester}|${q.question_number}|${q.question_text}`;

      if (existingKeys.has(compositeKey)) {
        console.log("Skipping duplicate:", compositeKey);
        skippedCount++;
        continue;
      }

      const { error: insertError } = await adminClient
        .from("text_question_bank")
        .insert({
          imported_by: userId,
          subject: q.subject,
          grade: q.grade,
          semester: q.semester,
          question_number: q.question_number,
          question_type: q.question_type || "اختيار متعدد",
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          correct_answer_text: q.correct_answer_text || null,
          notes: q.notes || null,
          visible_to_students: false,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        skippedCount++;
      } else {
        importedCount++;
        existingKeys.add(compositeKey); // Prevent intra-batch duplicates
      }
    }

    return new Response(
      JSON.stringify({ importedCount, skippedCount, invalidCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "حدث خطأ في الخادم" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
