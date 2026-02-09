import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, ClipboardCheck } from "lucide-react";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    publishedExams: 0,
    totalAttempts: 0,
    pendingAttempts: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [examsRes, attemptsRes, pendingRes] = await Promise.all([
        supabase.from("exams").select("id", { count: "exact", head: true }).eq("status", "منشور"),
        supabase.from("student_attempts").select("id", { count: "exact", head: true }),
        supabase.from("student_attempts").select("id", { count: "exact", head: true }).eq("status", "بانتظار الاعتماد"),
      ]);

      setStats({
        publishedExams: examsRes.count ?? 0,
        totalAttempts: attemptsRes.count ?? 0,
        pendingAttempts: pendingRes.count ?? 0,
      });
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: "الاختبارات المنشورة", value: stats.publishedExams, icon: FileText, color: "text-primary" },
    { title: "إجمالي المحاولات", value: stats.totalAttempts, icon: Users, color: "text-accent" },
    { title: "بانتظار الاعتماد", value: stats.pendingAttempts, icon: ClipboardCheck, color: "text-warning" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold">لوحة التحكم</h2>
          <p className="text-muted-foreground mt-1">إحصاءات عامة عن المنصة</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
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

export default AdminDashboard;
