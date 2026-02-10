import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ArrowRight, ChevronDown, Users, TrendingUp, Award, Target } from "lucide-react";

interface QuestionDetail {
  questionId: string;
  questionNumber: number;
  questionType: string;
  correctAnswer: string;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalCount: number;
  correctPct: number;
  wrongPct: number;
  unansweredPct: number;
  difficulty: string;
  optionCounts: Record<string, number>;
  questionText?: string;
  source: string;
}

const ExamAnalytics = () => {
  const { examId } = useParams<{ examId: string }>();
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [examName, setExamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lowScore, setLowScore] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [scoreDistribution, setScoreDistribution] = useState<{ range: string; count: number }[]>([]);
  const [questions, setQuestions] = useState<QuestionDetail[]>([]);
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!examId || !authUser) return;

    const fetchData = async () => {
      setLoading(true);

      // 1. Exam info
      const { data: exam } = await supabase
        .from("exams")
        .select("exam_name, teacher_id")
        .eq("id", examId)
        .single();

      if (!exam || exam.teacher_id !== authUser.user.id) {
        setLoading(false);
        return;
      }
      setExamName(exam.exam_name);

      // 2. Approved attempts
      const { data: attempts } = await supabase
        .from("student_attempts")
        .select("id, approved_score")
        .eq("exam_id", examId)
        .eq("status", "معتمد");

      if (!attempts?.length) {
        setLoading(false);
        return;
      }

      // Summary stats
      const scores = attempts.map((a) => a.approved_score ?? 0);
      setTotalStudents(attempts.length);
      setAvgScore(Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100);
      setHighScore(Math.max(...scores));
      setLowScore(Math.min(...scores));

      // Get exam questions to know total
      const { data: examQuestions } = await supabase
        .from("exam_questions")
        .select("question_id, question_order, source_type")
        .eq("exam_id", examId)
        .order("question_order");

      const totalQ = examQuestions?.length ?? 1;
      const passThreshold = totalQ * 0.5;
      const passCount = scores.filter((s) => s >= passThreshold).length;
      setSuccessRate(Math.round((passCount / scores.length) * 100));

      // Score distribution
      const dist = [
        { range: "0-20%", count: 0 },
        { range: "21-40%", count: 0 },
        { range: "41-60%", count: 0 },
        { range: "61-80%", count: 0 },
        { range: "81-100%", count: 0 },
      ];
      scores.forEach((s) => {
        const pct = (s / totalQ) * 100;
        if (pct <= 20) dist[0].count++;
        else if (pct <= 40) dist[1].count++;
        else if (pct <= 60) dist[2].count++;
        else if (pct <= 80) dist[3].count++;
        else dist[4].count++;
      });
      setScoreDistribution(dist);

      // 3. Student answers
      const attemptIds = attempts.map((a) => a.id);
      const allAnswers: { question_id: string; student_answer: string | null; auto_correct: boolean | null }[] = [];
      
      // Batch fetch answers (handle >1000 attempts)
      for (let i = 0; i < attemptIds.length; i += 500) {
        const batch = attemptIds.slice(i, i + 500);
        const { data } = await supabase
          .from("student_answers")
          .select("question_id, student_answer, auto_correct")
          .in("attempt_id", batch);
        if (data) allAnswers.push(...data);
      }

      // 4. Question details
      if (!examQuestions?.length) {
        setLoading(false);
        return;
      }

      const imageQIds = examQuestions.filter((q) => q.source_type === "image").map((q) => q.question_id);
      const textQIds = examQuestions.filter((q) => q.source_type === "text").map((q) => q.question_id);

      const [{ data: imageQs }, { data: textQs }] = await Promise.all([
        imageQIds.length
          ? supabase.from("question_bank").select("id, question_number, question_type, correct_answer").in("id", imageQIds)
          : Promise.resolve({ data: [] }),
        textQIds.length
          ? supabase.from("text_question_bank").select("id, question_number, question_type, correct_answer, question_text").in("id", textQIds)
          : Promise.resolve({ data: [] }),
      ]);

      const qInfoMap = new Map<string, { questionNumber: number; questionType: string; correctAnswer: string; questionText?: string; source: string }>();
      imageQs?.forEach((q) => qInfoMap.set(q.id, { questionNumber: q.question_number, questionType: q.question_type, correctAnswer: q.correct_answer, source: "image" }));
      textQs?.forEach((q) => qInfoMap.set(q.id, { questionNumber: q.question_number, questionType: q.question_type, correctAnswer: q.correct_answer, questionText: q.question_text ?? undefined, source: "text" }));

      // Build question analytics
      const qAnalytics: QuestionDetail[] = [];
      const orderMap = new Map(examQuestions.map((eq) => [eq.question_id, eq.question_order]));

      for (const eq of examQuestions) {
        const info = qInfoMap.get(eq.question_id);
        if (!info) continue;

        const qAnswers = allAnswers.filter((a) => a.question_id === eq.question_id);
        const total = attempts.length;
        const answered = qAnswers.filter((a) => a.student_answer && a.student_answer.trim() !== "");
        const correct = qAnswers.filter((a) => a.auto_correct === true).length;
        const wrong = answered.length - correct;
        const unanswered = total - answered.length;

        const correctPct = total > 0 ? Math.round((correct / total) * 100) : 0;
        const wrongPct = total > 0 ? Math.round((wrong / total) * 100) : 0;
        const unansweredPct = total > 0 ? Math.round((unanswered / total) * 100) : 0;

        const difficulty = correctPct > 70 ? "سهل" : correctPct >= 40 ? "متوسط" : "صعب";

        // Option counts for MCQ
        const optionCounts: Record<string, number> = { أ: 0, ب: 0, ج: 0, د: 0 };
        qAnswers.forEach((a) => {
          if (a.student_answer && optionCounts.hasOwnProperty(a.student_answer)) {
            optionCounts[a.student_answer]++;
          }
        });

        qAnalytics.push({
          questionId: eq.question_id,
          questionNumber: orderMap.get(eq.question_id) ?? info.questionNumber,
          questionType: info.questionType,
          correctAnswer: info.correctAnswer,
          correctCount: correct,
          wrongCount: wrong,
          unansweredCount: unanswered,
          totalCount: total,
          correctPct,
          wrongPct,
          unansweredPct,
          difficulty,
          optionCounts,
          questionText: info.questionText,
          source: info.source,
        });
      }

      qAnalytics.sort((a, b) => a.questionNumber - b.questionNumber);
      setQuestions(qAnalytics);
      setLoading(false);
    };

    fetchData();
  }, [examId, authUser]);

  const toggleQuestion = (id: string) => {
    setOpenQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getDifficultyBadge = (difficulty: string) => {
    const styles: Record<string, string> = {
      "سهل": "bg-green-100 text-green-700 border-green-200",
      "متوسط": "bg-yellow-100 text-yellow-700 border-yellow-200",
      "صعب": "bg-red-100 text-red-700 border-red-200",
    };
    return <Badge variant="outline" className={styles[difficulty] || ""}>{difficulty}</Badge>;
  };

  const getOptionBar = (option: string, count: number, total: number, isCorrect: boolean, isMostWrong: boolean) => {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    let barColor = "bg-muted";
    if (isCorrect) barColor = "bg-green-500";
    else if (isMostWrong && count > 0) barColor = "bg-orange-400";

    return (
      <div key={option} className="flex items-center gap-3 text-sm">
        <span className={`w-8 font-bold text-center ${isCorrect ? "text-green-700" : ""}`}>{option}</span>
        <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-16 text-left text-muted-foreground">{count} ({pct}%)</span>
      </div>
    );
  };

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
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">تحليلات الاختبار</h2>
            <p className="text-muted-foreground mt-1">{examName}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/teacher/analytics")}>
            <ArrowRight className="ml-2 h-4 w-4" />
            رجوع
          </Button>
        </div>

        {totalStudents === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">لا توجد نتائج معتمدة لهذا الاختبار بعد</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{totalStudents}</p>
                  <p className="text-sm text-muted-foreground">عدد الطالبات</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{avgScore}</p>
                  <p className="text-sm text-muted-foreground">متوسط الدرجات</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Award className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{highScore} / {lowScore}</p>
                  <p className="text-sm text-muted-foreground">أعلى / أدنى درجة</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{successRate}%</p>
                  <p className="text-sm text-muted-foreground">نسبة النجاح</p>
                </CardContent>
              </Card>
            </div>

            {/* Score Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>توزيع الدرجات</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={scoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value: number) => [value, "عدد الطالبات"]} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Question Analysis Table */}
            <Card>
              <CardHeader>
                <CardTitle>تحليل الأسئلة</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">السؤال</TableHead>
                      <TableHead className="text-right">الصواب</TableHead>
                      <TableHead className="text-right">الخطأ</TableHead>
                      <TableHead className="text-right">لم تجب</TableHead>
                      <TableHead className="text-right">التصنيف</TableHead>
                      <TableHead className="text-right w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((q) => {
                      const isOpen = openQuestions.has(q.questionId);
                      const isMCQ = q.questionType === "اختيار" || q.questionType === "multiple_choice";

                      // Find most selected wrong option
                      const wrongOptions = Object.entries(q.optionCounts).filter(([opt]) => opt !== q.correctAnswer);
                      const mostWrongOption = wrongOptions.length > 0
                        ? wrongOptions.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
                        : "";

                      return (
                        <Collapsible key={q.questionId} open={isOpen} onOpenChange={() => toggleQuestion(q.questionId)} asChild>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow className="cursor-pointer hover:bg-muted/50">
                                <TableCell className="font-medium">
                                  سؤال {q.questionNumber}
                                  {q.questionText && (
                                    <span className="block text-xs text-muted-foreground truncate max-w-[200px]">{q.questionText}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-green-600 font-semibold">{q.correctPct}%</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-red-500 font-semibold">{q.wrongPct}%</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-muted-foreground">{q.unansweredPct}%</span>
                                </TableCell>
                                <TableCell>{getDifficultyBadge(q.difficulty)}</TableCell>
                                <TableCell>
                                  {isMCQ && <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            {isMCQ && (
                              <CollapsibleContent asChild>
                                <TableRow>
                                  <TableCell colSpan={6} className="bg-muted/20 px-8 py-4">
                                    <div className="space-y-2 max-w-md">
                                      <p className="text-sm font-medium mb-3">توزيع الإجابات:</p>
                                      {["أ", "ب", "ج", "د"].map((opt) =>
                                        getOptionBar(
                                          opt,
                                          q.optionCounts[opt] || 0,
                                          q.totalCount,
                                          opt === q.correctAnswer,
                                          opt === mostWrongOption
                                        )
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            )}
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ExamAnalytics;
