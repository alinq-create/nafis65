import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, ChevronLeft, ChevronRight, Eye, Loader2, ArrowRight } from "lucide-react";

interface AttemptWithExam {
  id: string;
  student_name: string;
  class_number: number;
  submission_time: string;
  auto_score: number | null;
  approved_score: number | null;
  status: string;
  exam_name: string;
  exam_code: string;
}

interface ReviewQuestion {
  question_id: string;
  source_type: string;
  question_order: number;
  question_type: string;
  question_text: string | null;
  page_image_name: string | null;
  frame_top: number;
  frame_left: number;
  frame_width: number;
  frame_height: number;
  options: { a: string; b: string; c: string; d: string } | null;
  correct_answer: string;
  student_answer: string | null;
  auto_correct: boolean | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const optionLabels: Record<string, string> = { a: "أ", b: "ب", c: "ج", d: "د" };

const ReviewAttempts = () => {
  const { authUser } = useAuth();
  const [attempts, setAttempts] = useState<AttemptWithExam[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptWithExam | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionScores, setQuestionScores] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const { toast } = useToast();

  const fetchAttempts = async () => {
    if (!authUser) return;

    const { data: exams } = await supabase
      .from("exams")
      .select("id, exam_name, exam_code")
      .eq("teacher_id", authUser.user.id);

    if (!exams?.length) return;

    const examMap = new Map(exams.map((e) => [e.id, e]));
    const examIds = exams.map((e) => e.id);

    const { data: attemptsData } = await supabase
      .from("student_attempts")
      .select("*")
      .in("exam_id", examIds)
      .order("submission_time", { ascending: false });

    const mapped: AttemptWithExam[] = (attemptsData ?? []).map((a) => ({
      ...a,
      exam_name: examMap.get(a.exam_id)?.exam_name ?? "",
      exam_code: examMap.get(a.exam_id)?.exam_code ?? "",
    }));

    setAttempts(mapped);
  };

  useEffect(() => {
    fetchAttempts();
  }, [authUser]);

  const handleViewAttempt = async (attempt: AttemptWithExam) => {
    setSelectedAttempt(attempt);
    setCurrentQuestionIndex(0);
    setIsLoadingReview(true);
    setQuestions([]);
    setQuestionScores([]);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-attempt-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: attempt.id }),
      });

      if (!res.ok) throw new Error("Failed to fetch review data");

      const data = await res.json();
      const qs: ReviewQuestion[] = data.questions ?? [];
      setQuestions(qs);
      setTotalQuestions(data.total_questions ?? 0);
      // Initialize scores from auto_correct
      setQuestionScores(qs.map((q) => (q.auto_correct === true ? 1 : 0)));
    } catch {
      toast({ title: "خطأ في جلب بيانات المراجعة", variant: "destructive" });
    } finally {
      setIsLoadingReview(false);
    }
  };

  const handleBackToList = () => {
    setSelectedAttempt(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setQuestionScores([]);
  };

  const currentTotalScore = questionScores.reduce((sum, s) => sum + s, 0);

  const handleApprove = async () => {
    if (!selectedAttempt) return;
    setIsSubmitting(true);

    try {
      await supabase
        .from("student_attempts")
        .update({
          approved_score: currentTotalScore,
          status: "معتمد",
        })
        .eq("id", selectedAttempt.id);

      toast({ title: "تم اعتماد النتيجة بنجاح" });
      handleBackToList();
      fetchAttempts();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScoreChange = (index: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0 || num > 1) return;
    setQuestionScores((prev) => {
      const next = [...prev];
      next[index] = num;
      return next;
    });
  };

  const getImageUrl = (imageName?: string | null) => {
    if (!imageName) return "";
    const { data } = supabase.storage
      .from("question-images")
      .getPublicUrl(`shared/${imageName}`);
    return data.publicUrl;
  };

  const getOptionStyle = (
    optionKey: string,
    correctAnswer: string,
    studentAnswer: string | null
  ) => {
    const isCorrect = optionKey === correctAnswer?.toLowerCase();
    const isStudentChoice = optionKey === studentAnswer?.toLowerCase();

    if (isCorrect) return "border-green-500 bg-green-50 dark:bg-green-950/30";
    if (isStudentChoice && !isCorrect) return "border-blue-500 bg-blue-50 dark:bg-blue-950/30";
    return "border-border";
  };

  const pendingAttempts = attempts.filter((a) => a.status === "بانتظار الاعتماد");
  const approvedAttempts = attempts.filter((a) => a.status === "معتمد");

  // ─── Review View (question by question) ───
  if (selectedAttempt) {
    const currentQ = questions[currentQuestionIndex];
    const progressPercent = totalQuestions > 0
      ? ((currentQuestionIndex + 1) / totalQuestions) * 100
      : 0;

    return (
      <DashboardLayout>
        <div className="flex flex-col min-h-[calc(100vh-4rem)]" dir="rtl">
          {/* Header */}
          <div className="space-y-3 pb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleBackToList}>
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-xl font-bold">{selectedAttempt.exam_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedAttempt.student_name} — الفصل {selectedAttempt.class_number}
                </p>
              </div>
            </div>

            {!isLoadingReview && totalQuestions > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>السؤال {currentQuestionIndex + 1} من {totalQuestions}</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1">
            {isLoadingReview ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : questions.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">لا توجد أسئلة</p>
            ) : currentQ ? (
              <Card className="max-w-3xl mx-auto">
                <CardContent className="p-6 space-y-5">
                  {/* Question Display */}
                  {currentQ.source_type === "text" && currentQ.question_text && (
                    <p className="text-lg font-medium leading-relaxed">{currentQ.question_text}</p>
                  )}

                  {currentQ.source_type === "image" && currentQ.page_image_name && (
                    <div
                      className="w-full min-h-[300px] rounded-lg border bg-muted"
                      style={{
                        backgroundImage: `url(${getImageUrl(currentQ.page_image_name)})`,
                        backgroundSize: `${100 / (currentQ.frame_width || 1)}% ${100 / (currentQ.frame_height || 1)}%`,
                        backgroundPosition: `${((currentQ.frame_left || 0) / (1 - (currentQ.frame_width || 1))) * 100}% ${((currentQ.frame_top || 0) / (1 - (currentQ.frame_height || 1))) * 100}%`,
                        backgroundRepeat: "no-repeat",
                      }}
                    />
                  )}

                  {/* Options for text MCQ */}
                  {currentQ.source_type === "text" && currentQ.options && (
                    <div className="space-y-2">
                      {(["a", "b", "c", "d"] as const).map((key) => {
                        const isCorrect = key === currentQ.correct_answer?.toLowerCase();
                        const isStudentChoice = key === currentQ.student_answer?.toLowerCase();
                        return (
                          <div
                            key={key}
                            className={`border-2 rounded-lg p-3 flex items-center gap-3 text-sm transition-colors ${getOptionStyle(key, currentQ.correct_answer, currentQ.student_answer)}`}
                          >
                            <span className="font-bold text-muted-foreground w-6 text-center">
                              {optionLabels[key]}
                            </span>
                            <span className="flex-1">
                              {currentQ.options![key as keyof typeof currentQ.options]}
                            </span>
                            {isCorrect && (
                              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                            )}
                            {isStudentChoice && !isCorrect && (
                              <span className="text-xs text-blue-600 shrink-0">إجابة الطالبة</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Image question answer display */}
                  {currentQ.source_type === "image" && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">إجابة الطالبة:</span>
                        {currentQ.student_answer ? (
                          <span className="font-bold text-blue-600">{currentQ.student_answer}</span>
                        ) : (
                          <span className="text-muted-foreground italic">لم تجب الطالبة على هذا السؤال</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">الإجابة الصحيحة:</span>
                        <span className="font-bold text-green-600 flex items-center gap-1">
                          {currentQ.correct_answer}
                          <CheckCircle className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  )}

                  {/* No answer message for text questions */}
                  {currentQ.source_type === "text" && !currentQ.student_answer && (
                    <p className="text-sm text-muted-foreground italic bg-muted/50 rounded-lg p-3">
                      لم تجب الطالبة على هذا السؤال
                    </p>
                  )}

                  {/* Scoring section */}
                  <div className="border-t pt-4 flex items-center gap-4 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      الدرجة التلقائية: {currentQ.auto_correct === true ? 1 : 0} / 1
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">الدرجة:</span>
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.5}
                        value={questionScores[currentQuestionIndex] ?? 0}
                        onChange={(e) => handleScoreChange(currentQuestionIndex, e.target.value)}
                        className="w-20 text-center"
                        dir="ltr"
                      />
                      <span className="text-sm text-muted-foreground">من 1</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          {/* Navigation */}
          {!isLoadingReview && questions.length > 0 && (
            <div className="max-w-3xl mx-auto w-full flex items-center justify-between py-4">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex((i) => i - 1)}
                disabled={currentQuestionIndex === 0}
              >
                <ChevronRight className="h-4 w-4 ml-1" />
                السابق
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex((i) => i + 1)}
                disabled={currentQuestionIndex === totalQuestions - 1}
              >
                التالي
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          )}

          {/* Sticky Footer */}
          {!isLoadingReview && questions.length > 0 && (
            <div className="sticky bottom-0 bg-card border-t px-6 py-4 -mx-6 -mb-6">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                <span className="font-medium">
                  المجموع: {currentTotalScore} / {totalQuestions}
                </span>

                {selectedAttempt.status !== "معتمد" ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isSubmitting}>
                        <CheckCircle className="h-4 w-4 ml-2" />
                        اعتماد النتيجة
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد اعتماد النتيجة</AlertDialogTitle>
                        <AlertDialogDescription>
                          سيتم اعتماد درجة {currentTotalScore} من {totalQuestions} للطالبة {selectedAttempt.student_name}.
                          هل أنتِ متأكدة؟
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove} disabled={isSubmitting}>
                          {isSubmitting ? "جاري الاعتماد..." : "نعم، اعتماد"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Badge variant="default" className="bg-green-600 text-sm px-4 py-1">
                    معتمدة ✓
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ─── Attempts List View ───
  const renderAttemptsTable = (items: AttemptWithExam[]) => {
    if (items.length === 0) {
      return <p className="text-center text-muted-foreground py-8">لا توجد محاولات</p>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">الطالبة</TableHead>
            <TableHead className="text-right">الفصل</TableHead>
            <TableHead className="text-right">الاختبار</TableHead>
            <TableHead className="text-right">الدرجة الآلية</TableHead>
            <TableHead className="text-right">الدرجة المعتمدة</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((attempt) => (
            <TableRow key={attempt.id}>
              <TableCell className="font-medium">{attempt.student_name}</TableCell>
              <TableCell>{attempt.class_number}</TableCell>
              <TableCell>{attempt.exam_name}</TableCell>
              <TableCell>{attempt.auto_score ?? "—"}</TableCell>
              <TableCell>{attempt.approved_score ?? "—"}</TableCell>
              <TableCell>
                <Badge
                  variant={attempt.status === "معتمد" ? "default" : "secondary"}
                  className={attempt.status === "معتمد" ? "bg-green-600" : ""}
                >
                  {attempt.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => handleViewAttempt(attempt)}>
                  <Eye className="h-4 w-4 ml-1" />
                  عرض
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">مراجعة المحاولات</h2>
          <p className="text-muted-foreground mt-1">مراجعة واعتماد نتائج الطالبات</p>
        </div>

        <Tabs defaultValue="pending" dir="rtl">
          <TabsList>
            <TabsTrigger value="pending">بانتظار الاعتماد ({pendingAttempts.length})</TabsTrigger>
            <TabsTrigger value="approved">معتمدة ({approvedAttempts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>المحاولات بانتظار الاعتماد</CardTitle>
              </CardHeader>
              <CardContent>{renderAttemptsTable(pendingAttempts)}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardHeader>
                <CardTitle>المحاولات المعتمدة</CardTitle>
              </CardHeader>
              <CardContent>{renderAttemptsTable(approvedAttempts)}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ReviewAttempts;
