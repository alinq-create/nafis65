import { createClient } from "npm:@supabase/supabase-js@2";

const STAFF = [
  { email: "eatedal138@gmail.com", name: "المديرة اعتدال", password: "eatedal123@", role: "admin", subject: null },
  { email: "t788777@mkgh.moe.gov.sa", name: "غادة خوج", password: "ghada123@", role: "teacher", subject: "رياضيات" },
  { email: "t208545@mkhg.moe.gov.sa", name: "عفاف الحربي", password: "afaf123@", role: "teacher", subject: "رياضيات" },
  { email: "t92946268@asrg.moe.gov.sa", name: "أماني الغامدي", password: "amani123@", role: "teacher", subject: "علوم" },
];

Deno.serve(async () => {
  const c = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const out: any[] = [];
  for (const s of STAFF) {
    const { data, error } = await c.auth.admin.createUser({ email: s.email, password: s.password, email_confirm: true });
    if (error) { out.push({ email: s.email, error: error.message }); continue; }
    const id = data.user.id;
    await c.from("profiles").insert({ user_id: id, name: s.name, username: s.email, subject: s.subject, status: "active" });
    await c.from("user_roles").insert({ user_id: id, role: s.role });
    if (s.role === "teacher") await c.from("class_permissions").insert({ teacher_id: id, from_class: 1, to_class: 20 });
    out.push({ email: s.email, ok: true });
  }
  return new Response(JSON.stringify(out));
});
