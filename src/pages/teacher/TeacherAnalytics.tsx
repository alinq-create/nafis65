import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportExcelReport } from "@/lib/exportExcelReport";
import { useToast } from "@/hooks/use-toast";

interface ExamAnalyticsData {
  examId: string;
  examName: string;
  avgScore: number;
  totalAttempts: number;
}

interface ClassAnalytics {
  classNumber: number;
  avgScore: number;
  totalAttempts: number;
}

interface QuestionAnalytics {
  label: string;
  correctRate: number;
}

const TeacherAnalytics = () => {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [examAnalytics, setExamAnalytics] = useState<ExamAnalyticsData[]>([]);
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalytics[]>([]);
  const [questionAnalytics, setQuestionAnalytics] = useState<QuestionAnalytics[]>([]);
  const [allowedClasses, setAllowedClasses] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!authUser) return;

    const fetchAnalytics = async () => {
      setLoading(true);

      // Get teacher's allowed class range
      const { data: permissions } = await supabase
        .from("class_permissions")
        .select("from_class, to_class")
        .eq("teacher_id", authUser.user.id);

      const allowed: number[] = [];
      permissions?.forEach((p) => {
        for (let i = p.from_class; i <= p.to_class; i++) {
          allowed.push(i);
        }
      });
      setAllowedClasses(allowed);

      // Get teacher's exams
      const { data: exams } = await supabase
        .from("exams")
        .select("id, exam_name")
        .eq("teacher_id", authUser.user.id);

      if (!exams?.length) {
        setLoading(false);
        return;
      }

      const examMap = new Map(exams.map((e) => [e.id, e]));
      const examIds = exams.map((e) => e.id);

      // Get approved attempts only, filtered by allowed classes
      const { data: attempts } = await supabase
        .from("student_attempts")
        .select("*")
        .in("exam_id", examIds)
        .eq("status", "معتمد");

      // Filter by allowed classes client-side
      const filteredAttempts = (attempts ?? []).filter(
        (a) => allowed.length === 0 || allowed.includes(a.class_number)
      );

      if (!filteredAttempts.length) {
        setLoading(false);
        return;
      }

      // Exam analytics
      const examStatsMap = new Map<string, { total: number; count: number; name: string }>();
      filteredAttempts.forEach((a) => {
        const exam = examMap.get(a.exam_id);
        if (!exam || a.approved_score == null) return;
        const existing = examStatsMap.get(a.exam_id) || { total: 0, count: 0, name: exam.exam_name };
        existing.total += a.approved_score;
        existing.count += 1;
        examStatsMap.set(a.exam_id, existing);
      });

      setExamAnalytics(
        Array.from(examStatsMap.entries()).map(([examId, d]) => ({
          examId,
          examName: d.name,
          avgScore: Math.round((d.total / d.count) * 100) / 100,
          totalAttempts: d.count,
        }))
      );

      // Class analytics
      const classMap = new Map<number, { total: number; count: number }>();
      filteredAttempts.forEach((a) => {
        if (a.approved_score == null) return;
        const existing = classMap.get(a.class_number) || { total: 0, count: 0 };
        existing.total += a.approved_score;
        existing.count += 1;
        classMap.set(a.class_number, existing);
      });

      setClassAnalytics(
        Array.from(classMap.entries())
          .map(([classNumber, d]) => ({
            classNumber,
            avgScore: Math.round((d.total / d.count) * 100) / 100,
            totalAttempts: d.count,
          }))
          .sort((a, b) => a.classNumber - b.classNumber)
      );

      // Question-level analytics (correctness rate)
      const attemptIds = filteredAttempts.map((a) => a.id);
      const { data: answersData } = await supabase
        .from("student_answers")
        .select("question_id, auto_correct")
        .in("attempt_id", attemptIds);

      if (answersData?.length) {
        const questionIds = [...new Set(answersData.map((a) => a.question_id))];
        const { data: questions } = await supabase
          .from("question_bank")
          .select("id, page_number, question_number")
          .in("id", questionIds);

        const qMap = new Map(questions?.map((q) => [q.id, q]) ?? []);
        const qStatsMap = new Map<string, { correct: number; total: number; label: string }>();

        answersData.forEach((a) => {
          const q = qMap.get(a.question_id);
          if (!q) return;
          const label = `ص${q.page_number}-س${q.question_number}`;
          const existing = qStatsMap.get(a.question_id) || { correct: 0, total: 0, label };
          existing.total += 1;
          if (a.auto_correct === true) existing.correct += 1;
          qStatsMap.set(a.question_id, existing);
        });

        setQuestionAnalytics(
          Array.from(qStatsMap.values())
            .map((d) => ({
              label: d.label,
              correctRate: Math.round((d.correct / d.total) * 100),
            }))
            .sort((a, b) => a.label.localeCompare(b.label))
        );
      }

      setLoading(false);
    };

    fetchAnalytics();
  }, [authUser]);

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
            <h2 className="text-2xl font-bold">التحليلات</h2>
            <p className="text-muted-foreground mt-1">
              تحليل أداء الطالبات في اختباراتك (بعد الاعتماد فقط)
              {allowedClasses.length > 0 && (
                <span className="block text-xs mt-1">
                  الفصول المسموحة: {allowedClasses.join("، ")}
                </span>
              )}
            </p>
          </div>
          {examAnalytics.length > 0 && (
            <Button disabled={exporting} onClick={async () => {
              setExporting(true);
              try {
                const examIds = examAnalytics.map((e) => e.examId);
                const { data: exams } = await supabase.from("exams").select("id, exam_name, subject").in("id", examIds);
                const { data: attempts } = await supabase.from("student_attempts").select("*").in("exam_id", examIds).eq("status", "معتمد");
                const { data: eqs } = await supabase.from("exam_questions").select("exam_id, question_id, question_order, source_type").in("exam_id", examIds);

                const qCountMap: Record<string, number> = {};
                eqs?.forEach((eq) => { qCountMap[eq.exam_id] = (qCountMap[eq.exam_id] || 0) + 1; });

                const examNameMap: Record<string, { name: string; subject: string }> = {};
                exams?.forEach((e) => { examNameMap[e.id] = { name: e.exam_name, subject: e.subject }; });

                // Sheet 1
                const examSummary = examAnalytics.map((e) => {
                  const ea = attempts?.filter((a) => a.exam_id === e.examId) || [];
                  const scores = ea.map((a) => a.approved_score ?? 0);
                  const totalQ = qCountMap[e.examId] || 1;
                  return {
                    "اسم الاختبار": e.examName,
                    "المادة": examNameMap[e.examId]?.subject || "",
                    "عدد الطالبات": ea.length,
                    "متوسط الدرجات": e.avgScore,
                    "أعلى درجة": scores.length ? Math.max(...scores) : 0,
                    "أدنى درجة": scores.length ? Math.min(...scores) : 0,
                    "نسبة النجاح": scores.length ? `${Math.round((scores.filter((s) => s >= totalQ * 0.5).length / scores.length) * 100)}%` : "0%",
                  };
                });

                // Sheet 2
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

                // Sheet 3
                const attemptIds = (attempts || []).map((a) => a.id);
                let allAnswers: { question_id: string; auto_correct: boolean | null; student_answer: string | null }[] = [];
                for (let i = 0; i < attemptIds.length; i += 500) {
                  const { data } = await supabase.from("student_answers").select("question_id, auto_correct, student_answer").in("attempt_id", attemptIds.slice(i, i + 500));
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

                const eqExamMap: Record<string, string> = {};
                eqs?.forEach((eq) => { eqExamMap[eq.question_id] = eq.exam_id; });

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

                exportExcelReport({ examSummary, studentPerformance, questionStats });
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

        {examAnalytics.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">لا توجد نتائج معتمدة لعرض التحليلات</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Exam averages */}
            <Card>
              <CardHeader>
                <CardTitle>متوسط الدرجات لكل اختبار</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={examAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="examName" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number) => [value, "المتوسط"]}
                      labelFormatter={(label) => `الاختبار: ${label}`}
                    />
                    <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap gap-2">
                  {examAnalytics.map((exam) => (
                    <Button
                      key={exam.examId}
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/teacher/exam-analytics/${exam.examId}`)}
                    >
                      تفاصيل: {exam.examName}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Class comparison */}
            <Card>
              <CardHeader>
                <CardTitle>مقارنة أداء الفصول</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={classAnalytics}>
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

            {/* Question success rate */}
            {questionAnalytics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>نسبة الإجابات الصحيحة لكل سؤال</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(300, questionAnalytics.length * 35)}>
                    <BarChart data={questionAnalytics} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis dataKey="label" type="category" width={80} />
                      <Tooltip formatter={(value: number) => [`${value}%`, "نسبة الصواب"]} />
                      <Bar dataKey="correctRate" fill="hsl(142 76% 36%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeacherAnalytics;
