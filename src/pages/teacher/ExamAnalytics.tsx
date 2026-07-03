import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowRight, Users, TrendingUp, Award, Target, AlertTriangle, Eye, UserCheck } from "lucide-react";
import { getSignedImageUrl } from "@/lib/imageUrls";

interface StudentScore {
  id: string;
  studentName: string;
  classNumber: number;
  score: number;
  totalQ: number;
  pct: number;
}

interface ClassQuestionStat {
  questionId: string;
  questionOrder: number;
  sourceType: string;
  correctPct: number;
  wrongCount: number;
}

interface ClassStudentStat {
  name: string;
  score: number;
  totalQ: number;
  pct: number;
  classNumber: number;
}

interface ClassStats {
  classNumber: number;
  studentCount: number;
  avgPct: number;
  highPct: number;
  lowPct: number;
  passRate: number;
  hardest3: ClassQuestionStat[];
  easiest3: ClassQuestionStat[];
  students: ClassStudentStat[];
}

interface QuestionAnalysis {
  questionId: string;
  questionOrder: number;
  sourceType: string;
  correctCount: number;
  wrongCount: number;
  totalCount: number;
  correctPct: number;
}

interface QuestionPreview {
  questionText?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
  pageImageName?: string;
  frameTop?: number;
  frameLeft?: number;
  frameWidth?: number;
  frameHeight?: number;
  sourceType: string;
}

const ExamAnalytics = () => {
  const { examId } = useParams<{ examId: string }>();
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [examName, setExamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgScorePct, setAvgScorePct] = useState(0);
  const [highScorePct, setHighScorePct] = useState(0);
  const [lowScorePct, setLowScorePct] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [scoreDistribution, setScoreDistribution] = useState<{ range: string; count: number }[]>([]);
  const [questions, setQuestions] = useState<QuestionAnalysis[]>([]);
  const [performanceGap, setPerformanceGap] = useState(0);

  // Question preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<QuestionPreview | null>(null);
  const [previewOrder, setPreviewOrder] = useState(0);

  // Student & class level data
  const [studentScores, setStudentScores] = useState<StudentScore[]>([]);
  const [classStats, setClassStats] = useState<ClassStats[]>([]);

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
        .select("id, approved_score, student_name, class_number")
        .eq("exam_id", examId)
        .eq("status", "معتمد");

      if (!attempts?.length) {
        setLoading(false);
        return;
      }

      // 3. Exam questions
      const { data: examQuestions } = await supabase
        .from("exam_questions")
        .select("question_id, question_order, source_type")
        .eq("exam_id", examId)
        .order("question_order");

      const totalQ = examQuestions?.length ?? 1;

      // Summary stats as percentages
      const scores = attempts.map((a) => a.approved_score ?? 0);
      const scorePcts = scores.map((s) => (s / totalQ) * 100);
      setTotalStudents(attempts.length);
      setAvgScorePct(Math.round(scorePcts.reduce((s, v) => s + v, 0) / scorePcts.length));
      const high = Math.round(Math.max(...scorePcts));
      const low = Math.round(Math.min(...scorePcts));
      setHighScorePct(high);
      setLowScorePct(low);
      setPerformanceGap(high - low);

      const passCount = scorePcts.filter((p) => p >= 50).length;
      setSuccessRate(Math.round((passCount / attempts.length) * 100));

      // Score distribution - 4 ranges
      const dist = [
        { range: "90-100%", count: 0 },
        { range: "70-89%", count: 0 },
        { range: "50-69%", count: 0 },
        { range: "أقل من 50%", count: 0 },
      ];
      scorePcts.forEach((pct) => {
        if (pct >= 90) dist[0].count++;
        else if (pct >= 70) dist[1].count++;
        else if (pct >= 50) dist[2].count++;
        else dist[3].count++;
      });
      setScoreDistribution(dist);

      // 4. Student answers (include attempt_id for per-class analysis)
      const attemptIds = attempts.map((a) => a.id);
      const allAnswers: { question_id: string; auto_correct: boolean | null; attempt_id: string }[] = [];

      for (let i = 0; i < attemptIds.length; i += 500) {
        const batch = attemptIds.slice(i, i + 500);
        const { data } = await supabase
          .from("student_answers")
          .select("question_id, auto_correct, attempt_id")
          .in("attempt_id", batch);
        if (data) allAnswers.push(...data);
      }

      // 5. Build question analytics
      if (!examQuestions?.length) {
        setLoading(false);
        return;
      }

      const qAnalytics: QuestionAnalysis[] = examQuestions.map((eq) => {
        const qAnswers = allAnswers.filter((a) => a.question_id === eq.question_id);
        const total = attempts.length;
        const correct = qAnswers.filter((a) => a.auto_correct === true).length;
        const wrong = total - correct;
        const correctPct = total > 0 ? Math.round((correct / total) * 100) : 0;

        return {
          questionId: eq.question_id,
          questionOrder: eq.question_order,
          sourceType: eq.source_type,
          correctCount: correct,
          wrongCount: wrong,
          totalCount: total,
          correctPct,
        };
      });

      setQuestions(qAnalytics);

      // 6. Student scores table
      const stuScores: StudentScore[] = attempts.map((a) => {
        const pct = Math.round(((a.approved_score ?? 0) / totalQ) * 100);
        return {
          id: a.id,
          studentName: a.student_name,
          classNumber: a.class_number,
          score: a.approved_score ?? 0,
          totalQ,
          pct,
        };
      });
      stuScores.sort((a, b) => b.pct - a.pct);
      setStudentScores(stuScores);

      // 7. Class-level analytics with per-class question analysis
      // Build attempt -> class map
      const attemptClassMap = new Map<string, number>();
      attempts.forEach((a) => attemptClassMap.set(a.id, a.class_number));

      const classMap = new Map<number, number[]>();
      stuScores.forEach((s) => {
        if (!classMap.has(s.classNumber)) classMap.set(s.classNumber, []);
        classMap.get(s.classNumber)!.push(s.pct);
      });

      const cStats: ClassStats[] = [];
      classMap.forEach((pcts, cn) => {
        const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
        const hi = Math.max(...pcts);
        const lo = Math.min(...pcts);
        const pass = Math.round((pcts.filter((p) => p >= 50).length / pcts.length) * 100);

        // Per-class question analysis
        const classAttemptIds = new Set(
          attempts.filter((a) => a.class_number === cn).map((a) => a.id)
        );
        const classAnswers = allAnswers.filter((a) => classAttemptIds.has(a.attempt_id));
        const classStudentCount = classAttemptIds.size;

        const classQStats: ClassQuestionStat[] = (examQuestions ?? []).map((eq) => {
          const qAns = classAnswers.filter((a) => a.question_id === eq.question_id);
          const correct = qAns.filter((a) => a.auto_correct === true).length;
          const wrong = classStudentCount - correct;
          const correctPct = classStudentCount > 0 ? Math.round((correct / classStudentCount) * 100) : 0;
          return {
            questionId: eq.question_id,
            questionOrder: eq.question_order,
            sourceType: eq.source_type,
            correctPct,
            wrongCount: wrong,
          };
        });

        const sortedAsc = [...classQStats].sort((a, b) => a.correctPct - b.correctPct);
        const hardest3 = sortedAsc.slice(0, 3);
        const easiest3 = [...classQStats].sort((a, b) => b.correctPct - a.correctPct).slice(0, 3);

        const students: ClassStudentStat[] = stuScores
          .filter((s) => s.classNumber === cn)
          .map((s) => ({ name: s.studentName, score: s.score, totalQ: s.totalQ, pct: s.pct, classNumber: s.classNumber }));

        cStats.push({
          classNumber: cn, studentCount: pcts.length, avgPct: avg, highPct: hi, lowPct: lo, passRate: pass,
          hardest3, easiest3, students,
        });
      });
      cStats.sort((a, b) => a.classNumber - b.classNumber);
      setClassStats(cStats);

      setLoading(false);
    };

    fetchData();
  }, [examId, authUser]);

  // Get hardest 5 and easiest 3
  const sortedByDifficulty = [...questions].sort((a, b) => a.correctPct - b.correctPct);
  const hardest5 = sortedByDifficulty.slice(0, 5);
  const easiest3 = [...questions].sort((a, b) => b.correctPct - a.correctPct).slice(0, 3);

  // Question preview handler
  const openQuestionPreview = async (q: QuestionAnalysis) => {
    setPreviewOrder(q.questionOrder);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);

    if (q.sourceType === "text") {
      const { data } = await supabase
        .from("text_question_bank")
        .select("question_text, option_a, option_b, option_c, option_d, correct_answer")
        .eq("id", q.questionId)
        .single();

      if (data) {
        setPreviewData({
          questionText: data.question_text,
          optionA: data.option_a,
          optionB: data.option_b,
          optionC: data.option_c,
          optionD: data.option_d,
          correctAnswer: data.correct_answer,
          sourceType: "text",
        });
      }
    } else {
      const { data } = await supabase
        .from("question_bank")
        .select("page_image_name, frame_top, frame_left, frame_width, frame_height, correct_answer")
        .eq("id", q.questionId)
        .single();

      if (data) {
        setPreviewData({
          pageImageName: data.page_image_name,
          frameTop: data.frame_top,
          frameLeft: data.frame_left,
          frameWidth: data.frame_width,
          frameHeight: data.frame_height,
          correctAnswer: data.correct_answer,
          sourceType: "image",
        });
        if (data.page_image_name) {
          const url = await getSignedImageUrl(`shared/${data.page_image_name}`);
          setPreviewImageUrl(url);
        }
      }
    }
    setPreviewLoading(false);
  };

  const [previewImageUrl, setPreviewImageUrl] = useState<string>("");

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
          <div className="flex gap-2">
            <Button variant="default" onClick={() => navigate(`/teacher/exam-report/${examId}`)}>
              طباعة التقرير
            </Button>
            <Button variant="outline" onClick={() => navigate("/teacher/analytics")}>
              <ArrowRight className="ml-2 h-4 w-4" />
              رجوع
            </Button>
          </div>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                  <p className="text-2xl font-bold">{avgScorePct}%</p>
                  <p className="text-sm text-muted-foreground">متوسط الدرجات</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Award className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold">{highScorePct}%</p>
                  <p className="text-sm text-muted-foreground">أعلى درجة</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Award className="h-8 w-8 mx-auto mb-2 text-red-500" />
                  <p className="text-2xl font-bold">{lowScorePct}%</p>
                  <p className="text-sm text-muted-foreground">أدنى درجة</p>
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

            {/* Performance Gap Indicator */}
            {performanceGap > 40 && (
              <Card className="border-orange-300 bg-orange-50">
                <CardContent className="py-4 flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-orange-600 shrink-0" />
                  <p className="text-orange-800 font-medium">
                    يوجد تفاوت واضح في مستوى الطالبات داخل الفصل (فجوة الأداء: {performanceGap}%)
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>توزيع الدرجات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الشريحة</TableHead>
                        <TableHead className="text-right">عدد الطالبات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scoreDistribution.map((d) => (
                        <TableRow key={d.range}>
                          <TableCell className="font-medium">{d.range}</TableCell>
                          <TableCell>{d.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {/* Chart */}
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value: number) => [value, "عدد الطالبات"]} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Hardest 5 Questions */}
            <Card>
              <CardHeader>
                <CardTitle>أصعب 5 أسئلة</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم السؤال</TableHead>
                      <TableHead className="text-right">نسبة الإجابة الصحيحة</TableHead>
                      <TableHead className="text-right">عدد الإجابات الخاطئة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hardest5.map((q) => (
                      <TableRow key={q.questionId}>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-primary font-bold"
                            onClick={() => openQuestionPreview(q)}
                          >
                            <Eye className="h-4 w-4 ml-1" />
                            سؤال {q.questionOrder}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-semibold">{q.correctPct}%</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-red-500 font-semibold">{q.wrongCount}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Easiest 3 Questions */}
            <Card>
              <CardHeader>
                <CardTitle>أسهل 3 أسئلة</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم السؤال</TableHead>
                      <TableHead className="text-right">نسبة الإجابة الصحيحة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {easiest3.map((q) => (
                      <TableRow key={q.questionId}>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto text-primary font-bold"
                            onClick={() => openQuestionPreview(q)}
                          >
                            <Eye className="h-4 w-4 ml-1" />
                            سؤال {q.questionOrder}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-semibold">{q.correctPct}%</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Student Scores Table */}
            {studentScores.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    درجات الطالبات
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">اسم الطالبة</TableHead>
                        <TableHead className="text-right">الفصل</TableHead>
                        <TableHead className="text-right">الدرجة</TableHead>
                        <TableHead className="text-right">النسبة</TableHead>
                        <TableHead className="text-right">الملف</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentScores.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.studentName}</TableCell>
                          <TableCell>{s.classNumber}</TableCell>
                          <TableCell>{s.score}/{s.totalQ}</TableCell>
                          <TableCell>
                            <span className={s.pct >= 50 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
                              {s.pct}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto"
                              onClick={() => navigate(`/teacher/students/${s.studentName}/${s.classNumber}`)}
                            >
                              عرض الملف
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Class-Level Diagnostic Analytics */}
            {classStats.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold">تحليلات الفصول</h3>
                {classStats.map((cs) => (
                  <Card key={cs.classNumber}>
                    <CardHeader>
                      <CardTitle className="text-lg">فصل {cs.classNumber}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Summary row */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="font-bold text-lg">{cs.studentCount}</p>
                          <p className="text-muted-foreground">طالبة</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="font-bold text-lg">{cs.avgPct}%</p>
                          <p className="text-muted-foreground">المتوسط</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="font-bold text-lg text-green-600">{cs.highPct}%</p>
                          <p className="text-muted-foreground">أعلى</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="font-bold text-lg text-red-500">{cs.lowPct}%</p>
                          <p className="text-muted-foreground">أدنى</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="font-bold text-lg">{cs.passRate}%</p>
                          <p className="text-muted-foreground">نسبة النجاح</p>
                        </div>
                      </div>

                      {/* Hardest & Easiest questions side by side */}
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Hardest 3 */}
                        <div>
                          <h4 className="font-semibold mb-2 text-red-600">أصعب 3 أسئلة في الفصل</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">السؤال</TableHead>
                                <TableHead className="text-right">نسبة الصواب</TableHead>
                                <TableHead className="text-right">عدد الخطأ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {cs.hardest3.map((q) => (
                                <TableRow key={q.questionId}>
                                  <TableCell>
                                    <Button
                                      variant="link"
                                      className="p-0 h-auto text-primary font-bold"
                                      onClick={() => openQuestionPreview({ ...q, correctCount: 0, totalCount: 0 })}
                                    >
                                      <Eye className="h-4 w-4 ml-1" />
                                      سؤال {q.questionOrder}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-green-600 font-semibold">{q.correctPct}%</span>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-red-500 font-semibold">{q.wrongCount}</span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Easiest 3 */}
                        <div>
                          <h4 className="font-semibold mb-2 text-green-600">أسهل 3 أسئلة في الفصل</h4>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">السؤال</TableHead>
                                <TableHead className="text-right">نسبة الصواب</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {cs.easiest3.map((q) => (
                                <TableRow key={q.questionId}>
                                  <TableCell>
                                    <Button
                                      variant="link"
                                      className="p-0 h-auto text-primary font-bold"
                                      onClick={() => openQuestionPreview({ ...q, correctCount: 0, totalCount: 0 })}
                                    >
                                      <Eye className="h-4 w-4 ml-1" />
                                      سؤال {q.questionOrder}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-green-600 font-semibold">{q.correctPct}%</span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Students in this class */}
                      <div>
                        <h4 className="font-semibold mb-2">أداء الطالبات</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">الطالبة</TableHead>
                              <TableHead className="text-right">الدرجة</TableHead>
                              <TableHead className="text-right">النسبة</TableHead>
                              <TableHead className="text-right">الملف</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cs.students.map((st) => (
                              <TableRow key={st.name}>
                                <TableCell className="font-medium">{st.name}</TableCell>
                                <TableCell>{st.score}/{st.totalQ}</TableCell>
                                <TableCell>
                                  <span className={st.pct >= 50 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
                                    {st.pct}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 h-auto"
                                    onClick={() => navigate(`/teacher/students/${st.name}/${st.classNumber}`)}
                                  >
                                    عرض الملف
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Question Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>معاينة سؤال {previewOrder}</DialogTitle>
            </DialogHeader>
            {previewLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : previewData ? (
              <div className="space-y-4">
                {previewData.sourceType === "text" ? (
                  <>
                    <p className="font-medium text-base leading-relaxed">{previewData.questionText}</p>
                    <div className="space-y-2 text-sm">
                      {[
                        { label: "أ", value: previewData.optionA },
                        { label: "ب", value: previewData.optionB },
                        { label: "ج", value: previewData.optionC },
                        { label: "د", value: previewData.optionD },
                      ].map((opt) => (
                        <div
                          key={opt.label}
                          className={`p-2 rounded border ${
                            opt.label === previewData.correctAnswer
                              ? "border-green-400 bg-green-50 font-semibold"
                              : "border-border"
                          }`}
                        >
                          <span className="font-bold ml-2">{opt.label})</span>
                          {opt.value}
                        </div>
                      ))}
                    </div>
                  </>
                ) : previewData.pageImageName ? (
                  <div className="relative w-full overflow-hidden rounded border">
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={previewImageUrl}
                        alt="صورة السؤال"
                        className="w-full"
                        style={{
                          clipPath: `inset(${(previewData.frameTop ?? 0) * 100}% ${(1 - (previewData.frameLeft ?? 0) - (previewData.frameWidth ?? 1)) * 100}% ${(1 - (previewData.frameTop ?? 0) - (previewData.frameHeight ?? 1)) * 100}% ${(previewData.frameLeft ?? 0) * 100}%)`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      الإجابة الصحيحة: <span className="font-bold text-green-600">{previewData.correctAnswer}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">لا يمكن عرض السؤال</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">لا يمكن تحميل بيانات السؤال</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default ExamAnalytics;
