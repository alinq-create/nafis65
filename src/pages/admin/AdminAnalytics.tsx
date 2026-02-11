import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { exportExcelReport } from "@/lib/exportExcelReport";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [classStats, setClassStats] = useState<ClassStats[]>([]);
  const [examStats, setExamStats] = useState<ExamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">التحليلات العامة</h2>
            <p className="text-muted-foreground mt-1">إحصاءات شاملة لجميع المواد والفصول (بعد الاعتماد فقط)</p>
          </div>
          {subjectStats.length > 0 && (
            <Button disabled={exporting} onClick={async () => {
              setExporting(true);
              try {
                const { data: exams } = await supabase.from("exams").select("id, exam_name, subject");
                const examIds = exams?.map((e) => e.id) || [];
                const { data: attempts } = await supabase.from("student_attempts").select("*").in("exam_id", examIds).eq("status", "معتمد");
                const { data: eqs } = await supabase.from("exam_questions").select("exam_id, question_id, question_order, source_type").in("exam_id", examIds);

                const qCountMap: Record<string, number> = {};
                eqs?.forEach((eq) => { qCountMap[eq.exam_id] = (qCountMap[eq.exam_id] || 0) + 1; });
                const examNameMap: Record<string, { name: string; subject: string }> = {};
                exams?.forEach((e) => { examNameMap[e.id] = { name: e.exam_name, subject: e.subject }; });

                const examSummary = examIds.map((eid) => {
                  const ea = attempts?.filter((a) => a.exam_id === eid) || [];
                  const scores = ea.map((a) => a.approved_score ?? 0);
                  const totalQ = qCountMap[eid] || 1;
                  return {
                    "اسم الاختبار": examNameMap[eid]?.name || "",
                    "المادة": examNameMap[eid]?.subject || "",
                    "عدد الطالبات": ea.length,
                    "متوسط الدرجات": ea.length ? Math.round((scores.reduce((a, b) => a + b, 0) / ea.length) * 100) / 100 : 0,
                    "أعلى درجة": scores.length ? Math.max(...scores) : 0,
                    "أدنى درجة": scores.length ? Math.min(...scores) : 0,
                    "نسبة النجاح": ea.length ? `${Math.round((scores.filter((s) => s >= totalQ * 0.5).length / ea.length) * 100)}%` : "0%",
                  };
                }).filter((e) => e["عدد الطالبات"] > 0);

                const studentPerformance = (attempts || []).map((a) => {
                  const totalQ = qCountMap[a.exam_id] || 1;
                  return {
                    "الطالبة": a.student_name,
                    "الفصل": a.class_number,
                    "الاختبار": examNameMap[a.exam_id]?.name || "",
                    "المادة": examNameMap[a.exam_id]?.subject || "",
                    "الدرجة": a.approved_score ?? 0,
                    "من": totalQ,
                    "النسبة": `${Math.round(((a.approved_score ?? 0) / totalQ) * 100)}%`,
                  };
                });

                const attemptIds = (attempts || []).map((a) => a.id);
                let allAnswers: { question_id: string; auto_correct: boolean | null }[] = [];
                for (let i = 0; i < attemptIds.length; i += 500) {
                  const { data } = await supabase.from("student_answers").select("question_id, auto_correct").in("attempt_id", attemptIds.slice(i, i + 500));
                  if (data) allAnswers.push(...data);
                }

                const imageQIds = eqs?.filter((eq) => eq.source_type === "image").map((eq) => eq.question_id) || [];
                const textQIds = eqs?.filter((eq) => eq.source_type === "text").map((eq) => eq.question_id) || [];
                const qTypeMap: Record<string, string> = {};
                if (imageQIds.length) {
                  const { data } = await supabase.from("question_bank").select("id, question_type").in("id", imageQIds);
                  data?.forEach((q) => { qTypeMap[q.id] = q.question_type; });
                }
                if (textQIds.length) {
                  const { data } = await supabase.from("text_question_bank").select("id, question_type").in("id", textQIds);
                  data?.forEach((q) => { qTypeMap[q.id] = q.question_type; });
                }

                const questionStats = (eqs || []).map((eq) => {
                  const qAnswers = allAnswers.filter((a) => a.question_id === eq.question_id);
                  const total = qAnswers.length || 1;
                  const correct = qAnswers.filter((a) => a.auto_correct === true).length;
                  const correctPct = Math.round((correct / total) * 100);
                  return {
                    "الاختبار": examNameMap[eq.exam_id]?.name || "",
                    "رقم السؤال": eq.question_order,
                    "نوع السؤال": qTypeMap[eq.question_id] || "اختيار متعدد",
                    "نسبة الصواب": `${correctPct}%`,
                    "نسبة الخطأ": `${100 - correctPct}%`,
                    "التصنيف": correctPct > 70 ? "سهل" : correctPct >= 40 ? "متوسط" : "صعب",
                  };
                });

                exportExcelReport({ examSummary, studentPerformance, questionStats }, "تقرير_نافس_شامل");
                toast({ title: "تم التصدير بنجاح" });
              } catch {
                toast({ title: "حدث خطأ أثناء التصدير", variant: "destructive" });
              }
              setExporting(false);
            }}>
              {exporting ? "جاري التصدير..." : "تصدير تقرير Excel"}
            </Button>
          )}
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
