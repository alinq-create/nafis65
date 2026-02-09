import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Send } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Exam = Tables<"exams">;
type Question = Tables<"question_bank">;

const CreateExam = () => {
  const { authUser } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [examName, setExamName] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [classPermissions, setClassPermissions] = useState<{ from: number; to: number }>({ from: 1, to: 10 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!authUser) return;

    const fetchData = async () => {
      const [examsRes, questionsRes, permRes] = await Promise.all([
        supabase.from("exams").select("*").eq("teacher_id", authUser.user.id).order("created_at", { ascending: false }),
        supabase.from("question_bank").select("*").eq("teacher_id", authUser.user.id).eq("visible_to_students", true).order("page_number").order("question_number"),
        supabase.from("class_permissions").select("from_class, to_class").eq("teacher_id", authUser.user.id).single(),
      ]);

      setExams(examsRes.data ?? []);
      setQuestions(questionsRes.data ?? []);
      if (permRes.data) {
        setClassPermissions({ from: permRes.data.from_class, to: permRes.data.to_class });
      }
    };

    fetchData();
  }, [authUser]);

  const handleCreateExam = async (asDraft: boolean) => {
    if (!authUser || !examName.trim() || selectedClasses.length === 0 || selectedQuestions.length === 0) {
      toast({ title: "يرجى تعبئة جميع الحقول", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate exam code
      const subject = authUser.profile?.subject || "رياضيات";
      const { data: codeData } = await supabase.rpc("generate_exam_code", { p_subject: subject });
      const examCode = codeData || `${subject}-101`;

      // Create exam
      const { data: exam, error: examError } = await supabase
        .from("exams")
        .insert({
          teacher_id: authUser.user.id,
          exam_name: examName,
          subject,
          target_classes: selectedClasses,
          status: asDraft ? "مسودة" : "منشور",
          exam_code: examCode,
        })
        .select()
        .single();

      if (examError) throw examError;

      // Add questions
      const examQuestions = selectedQuestions.map((qId, index) => ({
        exam_id: exam.id,
        question_id: qId,
        question_order: index + 1,
      }));

      await supabase.from("exam_questions").insert(examQuestions);

      toast({
        title: asDraft ? "تم حفظ المسودة" : "تم نشر الاختبار",
        description: `رمز الاختبار: ${examCode}`,
      });

      setIsOpen(false);
      setExamName("");
      setSelectedClasses([]);
      setSelectedQuestions([]);

      // Refresh exams
      const { data: updatedExams } = await supabase
        .from("exams")
        .select("*")
        .eq("teacher_id", authUser.user.id)
        .order("created_at", { ascending: false });
      setExams(updatedExams ?? []);
    } catch (err: any) {
      toast({ title: "حدث خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishExam = async (examId: string) => {
    await supabase.from("exams").update({ status: "منشور" }).eq("id", examId);
    toast({ title: "تم نشر الاختبار" });
    const { data } = await supabase.from("exams").select("*").eq("teacher_id", authUser!.user.id).order("created_at", { ascending: false });
    setExams(data ?? []);
  };

  const handleCloseExam = async (examId: string) => {
    await supabase.from("exams").update({ status: "مغلق" }).eq("id", examId);
    toast({ title: "تم إغلاق الاختبار" });
    const { data } = await supabase.from("exams").select("*").eq("teacher_id", authUser!.user.id).order("created_at", { ascending: false });
    setExams(data ?? []);
  };

  const toggleClass = (classNum: number) => {
    setSelectedClasses((prev) =>
      prev.includes(classNum) ? prev.filter((c) => c !== classNum) : [...prev, classNum]
    );
  };

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(questionId) ? prev.filter((q) => q !== questionId) : [...prev, questionId]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "مسودة":
        return <Badge variant="secondary">مسودة</Badge>;
      case "منشور":
        return <Badge className="bg-success text-success-foreground">منشور</Badge>;
      case "مغلق":
        return <Badge variant="outline">مغلق</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">الاختبارات</h2>
            <p className="text-muted-foreground mt-1">إنشاء وإدارة الاختبارات</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                اختبار جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء اختبار جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>اسم الاختبار</Label>
                  <Input
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="مثال: اختبار الفصل الأول"
                  />
                </div>

                <div className="space-y-2">
                  <Label>الفصول المستهدفة</Label>
                  <div className="flex flex-wrap gap-3">
                    {Array.from(
                      { length: classPermissions.to - classPermissions.from + 1 },
                      (_, i) => classPermissions.from + i
                    ).map((classNum) => (
                      <label
                        key={classNum}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedClasses.includes(classNum)}
                          onCheckedChange={() => toggleClass(classNum)}
                        />
                        <span>فصل {classNum}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>اختيار الأسئلة ({selectedQuestions.length} سؤال محدد)</Label>
                  {questions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">لا توجد أسئلة متاحة</p>
                  ) : (
                    <div className="border rounded-lg max-h-60 overflow-y-auto">
                      {questions.map((q) => (
                        <label
                          key={q.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={selectedQuestions.includes(q.id)}
                            onCheckedChange={() => toggleQuestion(q.id)}
                          />
                          <span className="text-sm">
                            صفحة {q.page_number} - سؤال {q.question_number} ({q.question_type})
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleCreateExam(true)}
                    disabled={isSubmitting}
                  >
                    حفظ كمسودة
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleCreateExam(false)}
                    disabled={isSubmitting}
                  >
                    <Send className="h-4 w-4 ml-2" />
                    نشر الاختبار
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة الاختبارات</CardTitle>
          </CardHeader>
          <CardContent>
            {exams.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد اختبارات بعد</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">اسم الاختبار</TableHead>
                    <TableHead className="text-right">رمز الاختبار</TableHead>
                    <TableHead className="text-right">الفصول</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.exam_name}</TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-sm">{exam.exam_code}</code>
                      </TableCell>
                      <TableCell>{exam.target_classes.join("، ")}</TableCell>
                      <TableCell>{getStatusBadge(exam.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {exam.status === "مسودة" && (
                            <Button size="sm" onClick={() => handlePublishExam(exam.id)}>
                              نشر
                            </Button>
                          )}
                          {exam.status === "منشور" && (
                            <Button size="sm" variant="outline" onClick={() => handleCloseExam(exam.id)}>
                              إغلاق
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CreateExam;
