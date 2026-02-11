import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, User, BookOpen, TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, AlertCircle, Lightbulb, ThumbsUp, ThumbsDown } from "lucide-react";

interface AttemptData {
  id: string;
  exam_id: string;
  approved_score: number | null;
  submission_time: string;
  exam_name: string;
}

interface AnswerData {
  question_id: string;
  student_answer: string | null;
  auto_correct: boolean | null;
  question_type: string;
}

const StudentProfile = () => {
  const { name, class: classNumber } = useParams<{ name: string; class: string }>();
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptData[]>([]);
  const [answers, setAnswers] = useState<AnswerData[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});

  const studentName = decodeURIComponent(name || "");
  const classNum = Number(classNumber);

  useEffect(() => {
    const fetchData = async () => {
      if (!authUser?.user || !studentName || !classNum) return;
      setLoading(true);

      // Get teacher's exams
      const { data: exams } = await supabase
        .from("exams")
        .select("id, exam_name")
        .eq("teacher_id", authUser.user.id);

      if (!exams || exams.length === 0) {
        setLoading(false);
        return;
      }

      const examIds = exams.map((e) => e.id);
      const examNameMap: Record<string, string> = {};
      exams.forEach((e) => { examNameMap[e.id] = e.exam_name; });

      // Get approved attempts for this student
      const { data: attemptsData } = await supabase
        .from("student_attempts")
        .select("id, exam_id, approved_score, submission_time")
        .in("exam_id", examIds)
        .eq("student_name", studentName)
        .eq("class_number", classNum)
        .eq("status", "معتمد")
        .order("submission_time", { ascending: true });

      if (!attemptsData || attemptsData.length === 0) {
        setAttempts([]);
        setLoading(false);
        return;
      }

      const mappedAttempts: AttemptData[] = attemptsData.map((a) => ({
        ...a,
        exam_name: examNameMap[a.exam_id] || "اختبار",
      }));
      setAttempts(mappedAttempts);

      // Get question counts per exam
      const { data: eqData } = await supabase
        .from("exam_questions")
        .select("exam_id, question_id, source_type")
        .in("exam_id", examIds);

      const qCountMap: Record<string, number> = {};
      eqData?.forEach((eq) => {
        qCountMap[eq.exam_id] = (qCountMap[eq.exam_id] || 0) + 1;
      });
      setQuestionCounts(qCountMap);

      // Get all question IDs and their types
      const questionIds = eqData?.map((eq) => eq.question_id) || [];
      const imageQIds = eqData?.filter((eq) => eq.source_type === "image").map((eq) => eq.question_id) || [];
      const textQIds = eqData?.filter((eq) => eq.source_type === "text").map((eq) => eq.question_id) || [];

      // Fetch question types
      const typeMap: Record<string, string> = {};

      if (imageQIds.length > 0) {
        const { data: imgQ } = await supabase
          .from("question_bank")
          .select("id, question_type")
          .in("id", imageQIds);
        imgQ?.forEach((q) => { typeMap[q.id] = q.question_type; });
      }

      if (textQIds.length > 0) {
        const { data: txtQ } = await supabase
          .from("text_question_bank")
          .select("id, question_type")
          .in("id", textQIds);
        txtQ?.forEach((q) => { typeMap[q.id] = q.question_type; });
      }

      // Get answers
      const attemptIds = attemptsData.map((a) => a.id);
      const { data: answersData } = await supabase
        .from("student_answers")
        .select("question_id, student_answer, auto_correct")
        .in("attempt_id", attemptIds);

      const mappedAnswers: AnswerData[] = (answersData || []).map((a) => ({
        ...a,
        question_type: typeMap[a.question_id] || "اختيار متعدد",
      }));
      setAnswers(mappedAnswers);
      setLoading(false);
    };

    fetchData();
  }, [authUser, studentName, classNum]);

  // === Computed metrics ===
  const totalExams = attempts.length;

  const avgScore = useMemo(() => {
    if (attempts.length === 0) return 0;
    const scores = attempts.map((a) => {
      const total = questionCounts[a.exam_id] || 1;
      return ((a.approved_score || 0) / total) * 100;
    });
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [attempts, questionCounts]);

  const latestScore = useMemo(() => {
    if (attempts.length === 0) return 0;
    const last = attempts[attempts.length - 1];
    const total = questionCounts[last.exam_id] || 1;
    return Math.round(((last.approved_score || 0) / total) * 100);
  }, [attempts, questionCounts]);

  const correctPct = useMemo(() => {
    if (answers.length === 0) return 0;
    const correct = answers.filter((a) => a.auto_correct === true).length;
    return Math.round((correct / answers.length) * 100);
  }, [answers]);

  const unansweredPct = useMemo(() => {
    if (answers.length === 0) return 0;
    const unanswered = answers.filter((a) => !a.student_answer || a.student_answer.trim() === "").length;
    return Math.round((unanswered / answers.length) * 100);
  }, [answers]);

  const trend = useMemo(() => {
    if (attempts.length < 2) return "مستقر";
    const scores = attempts.map((a) => {
      const total = questionCounts[a.exam_id] || 1;
      return ((a.approved_score || 0) / total) * 100;
    });
    const half = Math.ceil(scores.length / 2);
    const first = scores.slice(0, half);
    const last = scores.slice(-half);
    const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
    const avgLast = last.reduce((a, b) => a + b, 0) / last.length;
    if (avgLast - avgFirst > 5) return "تحسن";
    if (avgFirst - avgLast > 5) return "تراجع";
    return "مستقر";
  }, [attempts, questionCounts]);

  const level = avgScore >= 80 ? "ممتاز" : avgScore >= 60 ? "جيد" : "يحتاج دعم";

  // Strengths & Weaknesses by question type
  const typeAnalysis = useMemo(() => {
    const map = new Map<string, { correct: number; total: number; unanswered: number }>();
    answers.forEach((a) => {
      if (!map.has(a.question_type)) {
        map.set(a.question_type, { correct: 0, total: 0, unanswered: 0 });
      }
      const entry = map.get(a.question_type)!;
      entry.total++;
      if (a.auto_correct === true) entry.correct++;
      if (!a.student_answer || a.student_answer.trim() === "") entry.unanswered++;
    });

    const strengths: { type: string; pct: number }[] = [];
    const weaknesses: { type: string; pct: number; unansweredPct: number }[] = [];

    map.forEach((val, type) => {
      const pct = Math.round((val.correct / val.total) * 100);
      const uPct = Math.round((val.unanswered / val.total) * 100);
      if (pct >= 70) strengths.push({ type, pct });
      if (pct < 50) weaknesses.push({ type, pct, unansweredPct: uPct });
    });

    return { strengths, weaknesses };
  }, [answers]);

  // Recommendations
  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (unansweredPct > 30) recs.push("تحتاج الطالبة لتشجيع على محاولة جميع الأسئلة");
    typeAnalysis.weaknesses.forEach((w) => {
      recs.push(`تحتاج دعم في أسئلة ${w.type}`);
    });
    if (trend === "تحسن") recs.push("تظهر الطالبة تحسناً ملحوظاً في الاختبارات الأخيرة");
    if (level === "ممتاز") recs.push("أداء متميز - يمكن تكليفها بمهام إثرائية");
    if (trend === "تراجع") recs.push("يُلاحظ تراجع في الأداء الأخير - قد تحتاج متابعة");
    if (recs.length === 0) recs.push("أداء مستقر - يُنصح بمتابعة مستمرة");
    return recs;
  }, [unansweredPct, typeAnalysis, trend, level]);

  const TrendIcon = trend === "تحسن" ? TrendingUp : trend === "تراجع" ? TrendingDown : Minus;
  const trendColor = trend === "تحسن" ? "text-green-600" : trend === "تراجع" ? "text-red-500" : "text-muted-foreground";
  const levelVariant = level === "ممتاز" ? "default" : level === "جيد" ? "secondary" : "destructive";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64" dir="rtl">
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        {/* Back button + Print */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/teacher/students")} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            العودة للقائمة
          </Button>
          <Button variant="default" onClick={() => navigate(`/teacher/student-report/${encodeURIComponent(studentName)}/${classNum}`)}>
            طباعة تقرير الطالبة
          </Button>
        </div>

        {/* Header Summary */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <h1 className="text-2xl font-bold">{studentName}</h1>
                <p className="text-muted-foreground">فصل {classNum}</p>
              </div>
              <div className="flex gap-6 flex-wrap text-center">
                <div>
                  <p className="text-2xl font-bold">{totalExams}</p>
                  <p className="text-xs text-muted-foreground">اختبارات</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgScore}%</p>
                  <p className="text-xs text-muted-foreground">المتوسط</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{latestScore}%</p>
                  <p className="text-xs text-muted-foreground">آخر درجة</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold">{correctPct}%</p>
              <p className="text-sm text-muted-foreground">الإجابات الصحيحة</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="text-2xl font-bold">{unansweredPct}%</p>
              <p className="text-sm text-muted-foreground">غير مجابة</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <TrendIcon className={`h-8 w-8 mx-auto mb-2 ${trendColor}`} />
              <p className="text-2xl font-bold">{trend}</p>
              <p className="text-sm text-muted-foreground">الاتجاه</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <BookOpen className="h-8 w-8 mx-auto mb-2 text-primary" />
              <Badge variant={levelVariant} className="text-base px-4 py-1">{level}</Badge>
              <p className="text-sm text-muted-foreground mt-2">المستوى العام</p>
            </CardContent>
          </Card>
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <ThumbsUp className="h-5 w-5" />
                نقاط القوة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {typeAnalysis.strengths.length === 0 ? (
                <p className="text-muted-foreground text-sm">لا توجد بيانات كافية</p>
              ) : (
                <div className="space-y-3">
                  {typeAnalysis.strengths.map((s) => (
                    <div key={s.type} className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <span className="font-medium">{s.type}</span>
                      <Badge variant="default">{s.pct}% صواب</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <ThumbsDown className="h-5 w-5" />
                نقاط الضعف
              </CardTitle>
            </CardHeader>
            <CardContent>
              {typeAnalysis.weaknesses.length === 0 ? (
                <p className="text-muted-foreground text-sm">لا توجد نقاط ضعف واضحة</p>
              ) : (
                <div className="space-y-3">
                  {typeAnalysis.weaknesses.map((w) => (
                    <div key={w.type} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                      <span className="font-medium">{w.type}</span>
                      <div className="flex gap-2">
                        <Badge variant="destructive">{w.pct}% صواب</Badge>
                        {w.unansweredPct > 20 && (
                          <Badge variant="outline">{w.unansweredPct}% بلا إجابة</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Exam History */}
        <Card>
          <CardHeader>
            <CardTitle>سجل الاختبارات</CardTitle>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">لا توجد اختبارات معتمدة</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاختبار</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الدرجة</TableHead>
                    <TableHead className="text-right">النسبة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...attempts].reverse().map((a) => {
                    const total = questionCounts[a.exam_id] || 1;
                    const pct = Math.round(((a.approved_score || 0) / total) * 100);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.exam_name}</TableCell>
                        <TableCell>{new Date(a.submission_time).toLocaleDateString("ar-SA")}</TableCell>
                        <TableCell>{a.approved_score || 0} / {total}</TableCell>
                        <TableCell>
                          <Badge variant={pct >= 80 ? "default" : pct >= 60 ? "secondary" : "destructive"}>
                            {pct}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Smart Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              توصيات ذكية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <XCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentProfile;
