import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ExamAnalytics {
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
  const [examAnalytics, setExamAnalytics] = useState<ExamAnalytics[]>([]);
  const [classAnalytics, setClassAnalytics] = useState<ClassAnalytics[]>([]);
  const [questionAnalytics, setQuestionAnalytics] = useState<QuestionAnalytics[]>([]);
  const [allowedClasses, setAllowedClasses] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

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
        Array.from(examStatsMap.values()).map((d) => ({
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
