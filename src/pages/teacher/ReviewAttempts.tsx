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
import { CheckCircle, Eye } from "lucide-react";

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

interface AnswerDetail {
  id: string;
  question_id: string;
  student_answer: string | null;
  auto_correct: boolean | null;
  correct_answer: string;
  question_number: number;
  page_number: number;
  question_type: string;
  question_text?: string;
  source?: string;
}

const ReviewAttempts = () => {
  const { authUser } = useAuth();
  const [attempts, setAttempts] = useState<AttemptWithExam[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptWithExam | null>(null);
  const [answers, setAnswers] = useState<AnswerDetail[]>([]);
  const [adjustedScore, setAdjustedScore] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

    const { data: answersData } = await supabase
      .from("student_answers")
      .select("id, question_id, student_answer, auto_correct")
      .eq("attempt_id", attempt.id);

    if (!answersData?.length) {
      setAnswers([]);
      return;
    }

    const questionIds = answersData.map((a) => a.question_id);
    
    // Fetch from question_bank (image questions)
    const { data: imgQuestions } = await supabase
      .from("question_bank")
      .select("id, correct_answer, question_number, page_number, question_type")
      .in("id", questionIds);

    const questionMap = new Map(imgQuestions?.map((q) => [q.id, { ...q, source: "image" }]) ?? []);

    // Find missing IDs and fetch from text_question_bank
    const missingIds = questionIds.filter((id) => !questionMap.has(id));
    if (missingIds.length > 0) {
      const { data: textQuestions } = await supabase
        .from("text_question_bank")
        .select("id, correct_answer, question_number, question_type, question_text")
        .in("id", missingIds);
      textQuestions?.forEach((q) => questionMap.set(q.id, { ...q, page_number: 0, source: "text" }));
    }

    const details: AnswerDetail[] = answersData.map((a) => {
      const q = questionMap.get(a.question_id);
      return {
        ...a,
        correct_answer: q?.correct_answer ?? "",
        question_number: q?.question_number ?? 0,
        page_number: q?.page_number ?? 0,
        question_type: q?.question_type ?? "",
        question_text: (q as any)?.question_text ?? undefined,
        source: q?.source ?? "image",
      };
    });

    details.sort((a, b) => a.page_number - b.page_number || a.question_number - b.question_number);
    setAnswers(details);
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

  const renderAttemptsTable = (items: AttemptWithExam[], showApproveAction: boolean) => {
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
                  className={attempt.status === "معتمد" ? "bg-success text-success-foreground" : ""}
                >
                  {attempt.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleViewAttempt(attempt)}
                >
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

        <Dialog open={!!selectedAttempt} onOpenChange={(open) => !open && setSelectedAttempt(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                إجابات {selectedAttempt?.student_name} - فصل {selectedAttempt?.class_number}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">السؤال</TableHead>
                    <TableHead className="text-right">إجابة الطالبة</TableHead>
                    <TableHead className="text-right">الإجابة الصحيحة</TableHead>
                    <TableHead className="text-right">النتيجة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {answers.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {a.source === "text" && a.question_text
                          ? `س${a.question_number}: ${a.question_text.substring(0, 50)}${a.question_text.length > 50 ? "..." : ""}`
                          : `ص${a.page_number} - س${a.question_number}`}
                      </TableCell>
                      <TableCell>{a.student_answer || "—"}</TableCell>
                      <TableCell className="font-medium">{a.correct_answer}</TableCell>
                      <TableCell>
                        {a.auto_correct === true ? (
                          <Badge className="bg-success text-success-foreground">صحيحة</Badge>
                        ) : a.auto_correct === false ? (
                          <Badge variant="destructive">خاطئة</Badge>
                        ) : (
                          <Badge variant="secondary">—</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selectedAttempt?.status !== "معتمد" && (
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
                    <span className="text-muted-foreground">من {answers.length}</span>
                  </div>
                  <Button onClick={handleApprove} disabled={isSubmitting}>
                    <CheckCircle className="h-4 w-4 ml-2" />
                    {isSubmitting ? "جاري الاعتماد..." : "اعتماد النتيجة"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="pending" dir="rtl">
          <TabsList>
            <TabsTrigger value="pending">
              بانتظار الاعتماد ({pendingAttempts.length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              معتمدة ({approvedAttempts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>المحاولات بانتظار الاعتماد</CardTitle>
              </CardHeader>
              <CardContent>
                {renderAttemptsTable(pendingAttempts, true)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardHeader>
                <CardTitle>المحاولات المعتمدة</CardTitle>
              </CardHeader>
              <CardContent>
                {renderAttemptsTable(approvedAttempts, false)}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ReviewAttempts;
