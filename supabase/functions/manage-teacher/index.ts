import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization")!;

    // Verify the caller is an authenticated admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role using service client
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "غير مصرح - مديرة فقط" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, name, username, password, subject, fromClass, toClass, userId } = await req.json();

    if (action === "create") {
      // Validate all inputs
      if (!username || typeof username !== "string" || username.length > 50 || !/^[a-zA-Z0-9._-]+$/.test(username)) {
        return new Response(JSON.stringify({ error: "اسم المستخدم يجب أن يكون بالإنجليزية فقط (أحرف وأرقام) وأقل من 50 حرف" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!name || typeof name !== "string" || name.length > 100) {
        return new Response(JSON.stringify({ error: "الاسم مطلوب وأقل من 100 حرف" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!password || typeof password !== "string" || password.length < 6 || password.length > 100) {
        return new Response(JSON.stringify({ error: "كلمة المرور يجب أن تكون بين 6 و 100 حرف" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!subject || typeof subject !== "string" || subject.length > 50) {
        return new Response(JSON.stringify({ error: "المادة مطلوبة" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof fromClass !== "number" || !Number.isInteger(fromClass) || fromClass < 1 || fromClass > 20) {
        return new Response(JSON.stringify({ error: "رقم الفصل (من) غير صالح" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof toClass !== "number" || !Number.isInteger(toClass) || toClass < 1 || toClass > 20 || toClass < fromClass) {
        return new Response(JSON.stringify({ error: "رقم الفصل (إلى) غير صالح" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const email = `${username}@nafes.app`;

      // Create auth user
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const newUserId = authData.user.id;

      // Create profile
      await adminClient.from("profiles").insert({
        user_id: newUserId,
        name,
        username,
        subject,
        status: "active",
      });

      // Assign teacher role
      await adminClient.from("user_roles").insert({
        user_id: newUserId,
        role: "teacher",
      });

      // Set class permissions
      await adminClient.from("class_permissions").insert({
        teacher_id: newUserId,
        from_class: fromClass,
        to_class: toClass,
      });

      return new Response(JSON.stringify({ success: true, userId: newUserId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!userId) {
        return new Response(JSON.stringify({ error: "معرف المعلمة مطلوب" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Get teacher's exams
      const { data: exams } = await adminClient
        .from("exams")
        .select("id")
        .eq("teacher_id", userId);

      const examIds = exams?.map((e: any) => e.id) ?? [];

      if (examIds.length > 0) {
        // 2. Get attempts for those exams
        const { data: attempts } = await adminClient
          .from("student_attempts")
          .select("id")
          .in("exam_id", examIds);

        const attemptIds = attempts?.map((a: any) => a.id) ?? [];

        // 3. Delete student_answers
        if (attemptIds.length > 0) {
          await adminClient.from("student_answers").delete().in("attempt_id", attemptIds);
        }

        // 4. Delete student_attempts
        await adminClient.from("student_attempts").delete().in("exam_id", examIds);

        // 5. Delete exam_questions
        await adminClient.from("exam_questions").delete().in("exam_id", examIds);

        // 6. Delete exams
        await adminClient.from("exams").delete().eq("teacher_id", userId);
      }

      // 7. Delete question_bank
      await adminClient.from("question_bank").delete().eq("teacher_id", userId);

      // 8. Delete class_permissions
      await adminClient.from("class_permissions").delete().eq("teacher_id", userId);

      // 9. Delete user_roles
      await adminClient.from("user_roles").delete().eq("user_id", userId);

      // 10. Delete profile
      await adminClient.from("profiles").delete().eq("user_id", userId);

      // 11. Delete auth user
      await adminClient.auth.admin.deleteUser(userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "إجراء غير معروف" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
