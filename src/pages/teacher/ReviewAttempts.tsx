import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Eye, Loader2 } from "lucide-react";

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
  const [adjustedScore, setAdjustedScore] = useState("");
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
    setAdjustedScore(String(attempt.approved_score ?? attempt.auto_score ?? 0));
    setIsLoadingReview(true);
    setQuestions([]);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-attempt-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt_id: attempt.id }),
      });

      if (!res.ok) throw new Error("Failed to fetch review data");

      const data = await res.json();
      setQuestions(data.questions ?? []);
      setTotalQuestions(data.total_questions ?? 0);
    } catch {
      toast({ title: "خطأ في جلب بيانات المراجعة", variant: "destructive" });
    } finally {
      setIsLoadingReview(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedAttempt) return;
    setIsSubmitting(true);

    try {
      await supabase
        .from("student_attempts")
        .update({
          approved_score: parseFloat(adjustedScore),
          status: "معتمد",
        })
        .eq("id", selectedAttempt.id);

      toast({ title: "تم اعتماد النتيجة بنجاح" });
      setSelectedAttempt(null);
      fetchAttempts();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingAttempts = attempts.filter((a) => a.status === "بانتظار الاعتماد");
  const approvedAttempts = attempts.filter((a) => a.status === "معتمد");

  const getOptionStyle = (
    optionKey: string,
    correctAnswer: string,
    studentAnswer: string | null
  ) => {
    const isCorrect = optionKey === correctAnswer?.toLowerCase();
    const isStudentChoice = optionKey === studentAnswer?.toLowerCase();

    if (isCorrect) return "border-green-500 bg-green-50 dark:bg-green-950/30";
    if (isStudentChoice && !isCorrect) return "border-red-500 bg-red-50 dark:bg-red-950/30";
    return "border-border";
  };

  const renderQuestionCard = (q: ReviewQuestion, index: number) => {
    const autoScore = q.auto_correct === true ? 1 : 0;

    return (
      <Card key={q.question_id} className="mb-3">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">
              السؤال {q.question_order}
            </span>
            <Badge
              variant={q.auto_correct === true ? "default" : q.auto_correct === false ? "destructive" : "secondary"}
              className={q.auto_correct === true ? "bg-green-600" : ""}
            >
              {q.auto_correct === true ? "صحيحة ✓" : q.auto_correct === false ? "خاطئة ✗" : "—"}
            </Badge>
          </div>

          {/* Question content */}
          {q.source_type === "text" && q.question_text && (
            <p className="text-sm leading-relaxed">{q.question_text}</p>
          )}

          {q.source_type === "image" && q.page_image_name && (
            <div className="overflow-hidden rounded border bg-muted">
              <img
                src={`${SUPABASE_URL}/storage/v1/object/public/question-images/${q.page_image_name}`}
                alt={`سؤال ${q.question_order}`}
                className="w-full"
                style={{
                  objectFit: "none",
                  objectPosition: `-${q.frame_left}px -${q.frame_top}px`,
                  width: `${q.frame_width}px`,
                  height: `${q.frame_height}px`,
                  maxWidth: "100%",
                }}
              />
            </div>
          )}

          {/* Options for text questions */}
          {q.source_type === "text" && q.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(["a", "b", "c", "d"] as const).map((key) => (
                <div
                  key={key}
                  className={`border rounded-md p-2 text-sm flex items-center gap-2 ${getOptionStyle(key, q.correct_answer, q.student_answer)}`}
                >
                  <span className="font-bold text-muted-foreground">{optionLabels[key]}</span>
                  <span>{q.options![key as keyof typeof q.options]}</span>
                  {key === q.correct_answer?.toLowerCase() && (
                    <CheckCircle className="h-4 w-4 text-green-600 mr-auto" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* For image questions, show answer comparison inline */}
          {q.source_type === "image" && (
            <div className="flex gap-4 text-sm">
              <span>إجابة الطالبة: <strong>{q.student_answer || "—"}</strong></span>
              <span>الإجابة الصحيحة: <strong className="text-green-600">{q.correct_answer}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

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

  const correctCount = questions.filter((q) => q.auto_correct === true).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">مراجعة المحاولات</h2>
          <p className="text-muted-foreground mt-1">مراجعة واعتماد نتائج الطالبات</p>
        </div>

        <Dialog open={!!selectedAttempt} onOpenChange={(open) => !open && setSelectedAttempt(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                إجابات {selectedAttempt?.student_name} - فصل {selectedAttempt?.class_number}
              </DialogTitle>
            </DialogHeader>

            {isLoadingReview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted">
                  <span className="text-sm font-medium">
                    الدرجة الآلية: {correctCount} / {totalQuestions}
                  </span>
                </div>

                {/* Questions */}
                {questions.map((q, i) => renderQuestionCard(q, i))}

                {questions.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد أسئلة</p>
                )}

                {/* Approve section */}
                {selectedAttempt?.status !== "معتمد" && questions.length > 0 && (
                  <div className="flex items-center gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">الدرجة:</span>
                      <Input
                        type="number"
                        value={adjustedScore}
                        onChange={(e) => setAdjustedScore(e.target.value)}
                        className="w-24"
                        dir="ltr"
                      />
                      <span className="text-muted-foreground">من {totalQuestions}</span>
                    </div>
                    <Button onClick={handleApprove} disabled={isSubmitting}>
                      <CheckCircle className="h-4 w-4 ml-2" />
                      {isSubmitting ? "جاري الاعتماد..." : "اعتماد النتيجة"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

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
