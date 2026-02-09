import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, BookOpen, ClipboardCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TeacherDashboard = () => {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalExams: 0,
    pendingAttempts: 0,
  });

  useEffect(() => {
    if (!authUser) return;
    const fetchStats = async () => {
      const [questionsRes, examsRes, attemptsRes] = await Promise.all([
        supabase.from("question_bank").select("id", { count: "exact", head: true }).eq("teacher_id", authUser.user.id),
        supabase.from("exams").select("id", { count: "exact", head: true }).eq("teacher_id", authUser.user.id),
        supabase.from("student_attempts").select("id, exam_id", { count: "exact" }).eq("status", "بانتظار الاعتماد"),
      ]);

      // Filter attempts for teacher's exams
      const { data: teacherExams } = await supabase
        .from("exams")
        .select("id")
        .eq("teacher_id", authUser.user.id);
      
      const teacherExamIds = new Set(teacherExams?.map((e) => e.id) ?? []);
      const pendingCount = attemptsRes.data?.filter((a) => teacherExamIds.has(a.exam_id)).length ?? 0;

      setStats({
        totalQuestions: questionsRes.count ?? 0,
        totalExams: examsRes.count ?? 0,
        pendingAttempts: pendingCount,
      });
    };

    fetchStats();
  }, [authUser]);

  const statCards = [
    { title: "بنك الأسئلة", value: stats.totalQuestions, icon: BookOpen, color: "text-primary", path: "/teacher/questions" },
    { title: "الاختبارات", value: stats.totalExams, icon: FileText, color: "text-accent", path: "/teacher/exams" },
    { title: "بانتظار الاعتماد", value: stats.pendingAttempts, icon: ClipboardCheck, color: "text-warning", path: "/teacher/attempts" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold">مرحبًا، {authUser?.profile?.name}</h2>
          <p className="text-muted-foreground mt-1">مادة {authUser?.profile?.subject}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(stat.path)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
