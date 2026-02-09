import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface SubjectStats {
  subject: string;
  avgScore: number;
  totalAttempts: number;
}

interface ClassStats {
  classNumber: number;
  avgScore: number;
  totalAttempts: number;
}

interface ExamStats {
  examName: string;
  subject: string;
  totalAttempts: number;
  avgScore: number;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--muted))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
];

const AdminAnalytics = () => {
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [classStats, setClassStats] = useState<ClassStats[]>([]);
  const [examStats, setExamStats] = useState<ExamStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      // Fetch all exams
      const { data: exams } = await supabase
        .from("exams")
        .select("id, exam_name, subject");

      if (!exams?.length) {
        setLoading(false);
        return;
      }

      const examMap = new Map(exams.map((e) => [e.id, e]));
      const examIds = exams.map((e) => e.id);

      // Fetch approved attempts only
      const { data: attempts } = await supabase
        .from("student_attempts")
        .select("*")
        .in("exam_id", examIds)
        .eq("status", "معتمد");

      if (!attempts?.length) {
        setLoading(false);
        return;
      }

      // Compute subject stats
      const subjectMap = new Map<string, { total: number; count: number }>();
      attempts.forEach((a) => {
        const exam = examMap.get(a.exam_id);
        if (!exam || a.approved_score == null) return;
        const existing = subjectMap.get(exam.subject) || { total: 0, count: 0 };
        existing.total += a.approved_score;
        existing.count += 1;
        subjectMap.set(exam.subject, existing);
      });

      setSubjectStats(
        Array.from(subjectMap.entries()).map(([subject, data]) => ({
          subject,
          avgScore: Math.round((data.total / data.count) * 100) / 100,
          totalAttempts: data.count,
        }))
      );

      // Compute class stats
      const classMap = new Map<number, { total: number; count: number }>();
      attempts.forEach((a) => {
        if (a.approved_score == null) return;
        const existing = classMap.get(a.class_number) || { total: 0, count: 0 };
        existing.total += a.approved_score;
        existing.count += 1;
        classMap.set(a.class_number, existing);
      });

      setClassStats(
        Array.from(classMap.entries())
          .map(([classNumber, data]) => ({
            classNumber,
            avgScore: Math.round((data.total / data.count) * 100) / 100,
            totalAttempts: data.count,
          }))
          .sort((a, b) => a.classNumber - b.classNumber)
      );

      // Compute exam stats
      const examStatsMap = new Map<string, { total: number; count: number; name: string; subject: string }>();
      attempts.forEach((a) => {
        const exam = examMap.get(a.exam_id);
        if (!exam || a.approved_score == null) return;
        const existing = examStatsMap.get(a.exam_id) || { total: 0, count: 0, name: exam.exam_name, subject: exam.subject };
        existing.total += a.approved_score;
        existing.count += 1;
        examStatsMap.set(a.exam_id, existing);
      });

      setExamStats(
        Array.from(examStatsMap.values()).map((data) => ({
          examName: data.name,
          subject: data.subject,
          totalAttempts: data.count,
          avgScore: Math.round((data.total / data.count) * 100) / 100,
        }))
      );

      setLoading(false);
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold">التحليلات العامة</h2>
          <p className="text-muted-foreground mt-1">إحصاءات شاملة لجميع المواد والفصول (بعد الاعتماد فقط)</p>
        </div>

        {subjectStats.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">لا توجد بيانات معتمدة لعرض التحليلات</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Subject Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>متوسط الدرجات حسب المادة</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={subjectStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => [value, "المتوسط"]}
                        labelFormatter={(label) => `المادة: ${label}`}
                      />
                      <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>عدد المحاولات حسب المادة</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={subjectStats}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ subject, totalAttempts }) => `${subject}: ${totalAttempts}`}
                        outerRadius={100}
                        dataKey="totalAttempts"
                        nameKey="subject"
                      >
                        {subjectStats.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Class Stats */}
            <Card>
              <CardHeader>
                <CardTitle>متوسط الدرجات حسب الفصل</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={classStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="classNumber" tickFormatter={(v) => `فصل ${v}`} />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [value, "المتوسط"]}
                      labelFormatter={(label) => `فصل ${label}`}
                    />
                    <Bar dataKey="avgScore" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Exam Stats */}
            <Card>
              <CardHeader>
                <CardTitle>إحصاءات الاختبارات</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={examStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="examName" type="category" width={120} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        value,
                        name === "avgScore" ? "المتوسط" : "المحاولات",
                      ]}
                    />
                    <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAnalytics;
