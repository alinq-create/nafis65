import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Save, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSignedImageUrls } from "@/lib/imageUrls";

interface UnifiedQuestion {
  id: string;
  source: string;
  subject: string;
  grade: string;
  semester: string;
  question_number: number;
  question_type: string;
  question_text: string | null;
  correct_answer: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  page_image_name: string | null;
  teacher_id: string;
  frame_top: number | null;
  frame_left: number | null;
  frame_width: number | null;
  frame_height: number | null;
  visible_to_students: boolean;
  notes: string | null;
  created_at: string;
}

const CreateNewExam = () => {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step management
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 state
  const [examName, setExamName] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [classPermissions, setClassPermissions] = useState<{ from: number; to: number } | null>(null);

  // Step 2 state
  const [questions, setQuestions] = useState<UnifiedQuestion[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit question states
  const [editingQuestion, setEditingQuestion] = useState<UnifiedQuestion | null>(null);
  const [editForm, setEditForm] = useState({ question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_answer: "" });
  const [saving, setSaving] = useState(false);

  const openEditDialog = (q: UnifiedQuestion) => {
    setEditingQuestion(q);
    setEditForm({
      question_text: q.question_text || "",
      option_a: q.option_a || "",
      option_b: q.option_b || "",
      option_c: q.option_c || "",
      option_d: q.option_d || "",
      correct_answer: q.correct_answer || "",
    });
  };

  const handleEditSave = async () => {
    if (!editingQuestion) return;
    setSaving(true);
    try {
      if (editingQuestion.source === "text") {
        const { error } = await supabase
          .from("text_question_bank")
          .update({
            question_text: editForm.question_text,
            option_a: editForm.option_a,
            option_b: editForm.option_b,
            option_c: editForm.option_c,
            option_d: editForm.option_d,
            correct_answer: editForm.correct_answer,
          })
          .eq("id", editingQuestion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("question_bank")
          .update({ correct_answer: editForm.correct_answer })
          .eq("id", editingQuestion.id);
        if (error) throw error;
      }
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === editingQuestion.id
            ? {
                ...q,
                ...(editingQuestion.source === "text"
                  ? { question_text: editForm.question_text, option_a: editForm.option_a, option_b: editForm.option_b, option_c: editForm.option_c, option_d: editForm.option_d, correct_answer: editForm.correct_answer }
                  : { correct_answer: editForm.correct_answer }),
              }
            : q
        )
      );
      toast({ title: "تم حفظ التعديلات بنجاح" });
      setEditingQuestion(null);
    } catch (err: any) {
      toast({ title: "خطأ في حفظ التعديلات", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const subject = authUser?.profile?.subject || "رياضيات";

  // Fetch class permissions
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from("class_permissions")
      .select("from_class, to_class")
      .eq("teacher_id", authUser.user.id)
      .single()
      .then(({ data }) => {
        if (data) setClassPermissions({ from: data.from_class, to: data.to_class });
      });
  }, [authUser]);

  const toggleClass = (classNum: number) => {
    setSelectedClasses((prev) =>
      prev.includes(classNum) ? prev.filter((c) => c !== classNum) : [...prev, classNum]
    );
  };

  const handleNextStep = () => {
    if (!examName.trim()) {
      toast({ title: "يرجى إدخال اسم الاختبار", variant: "destructive" });
      return;
    }
    if (selectedClasses.length === 0) {
      toast({ title: "يرجى اختيار فصل واحد على الأقل", variant: "destructive" });
      return;
    }
    setStep(2);
    fetchQuestions();
  };

  const fetchQuestions = async () => {
    setQuestionsLoading(true);
    const { data, error } = await supabase.rpc("get_teacher_questions", {
      p_subject: subject,
    });
    if (error) {
      toast({ title: "خطأ في جلب الأسئلة", variant: "destructive" });
    }
    setQuestions((data as UnifiedQuestion[]) ?? []);
    setQuestionsLoading(false);
  };

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(questionId) ? prev.filter((q) => q !== questionId) : [...prev, questionId]
    );
  };

  const getImageUrl = (question: UnifiedQuestion) => {
    if (!authUser || !question.page_image_name) return "";
    const isOwnQuestion = question.teacher_id === authUser.user.id;
    const path = isOwnQuestion
      ? `${authUser.user.id}/${question.page_image_name}`
      : `shared/${question.page_image_name}`;
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSaveExam = async () => {
    if (!authUser) return;
    if (selectedQuestions.length === 0) {
      toast({ title: "يرجى اختيار سؤال واحد على الأقل", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: codeData } = await supabase.rpc("generate_exam_code", { p_subject: subject });
      const examCode = codeData || `${subject}-101`;

      const { data: exam, error: examError } = await supabase
        .from("exams")
        .insert({
          teacher_id: authUser.user.id,
          exam_name: examName,
          subject,
          target_classes: selectedClasses,
          status: "مسودة",
          exam_code: examCode,
        })
        .select()
        .single();

      if (examError) throw examError;

      const examQuestions = selectedQuestions.map((qId, index) => {
        const q = questions.find((question) => question.id === qId);
        return {
          exam_id: exam.id,
          question_id: qId,
          question_order: index + 1,
          source_type: q?.source === "text" ? "text" : "image",
        };
      });

      const { error: eqError } = await supabase.from("exam_questions").insert(examQuestions as any);
      if (eqError) throw eqError;

      toast({
        title: "تم إنشاء الاختبار بنجاح",
        description: `رمز الاختبار: ${examCode}`,
      });

      navigate("/teacher/exams");
    } catch (err: any) {
      toast({ title: "حدث خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">إنشاء اختبار جديد</h2>
          <p className="text-muted-foreground mt-1">
            {step === 1 ? "الخطوة 1: بيانات الاختبار" : "الخطوة 2: اختيار الأسئلة"}
          </p>
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>بيانات الاختبار</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>اسم الاختبار</Label>
                <Input
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="مثال: اختبار الفصل الأول"
                />
              </div>

              <div className="space-y-2">
                <Label>المادة</Label>
                <Input value={subject} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label>الفصول المستهدفة</Label>
                {classPermissions ? (
                  <div className="flex flex-wrap gap-3">
                    {Array.from(
                      { length: classPermissions.to - classPermissions.from + 1 },
                      (_, i) => classPermissions.from + i
                    ).map((classNum) => (
                      <label key={classNum} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedClasses.includes(classNum)}
                          onCheckedChange={() => toggleClass(classNum)}
                        />
                        <span>فصل {classNum}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">جاري تحميل الفصول...</p>
                )}
              </div>

              <Button onClick={handleNextStep} className="w-full sm:w-auto">
                التالي
                <ArrowRight className="h-4 w-4 mr-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <Badge variant="secondary" className="text-base px-4 py-2">
                عدد الأسئلة المختارة: {selectedQuestions.length}
              </Badge>
              <Button variant="outline" onClick={() => setStep(1)}>
                رجوع للخطوة السابقة
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>اختيار الأسئلة</CardTitle>
              </CardHeader>
              <CardContent>
                {questionsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : questions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد أسئلة متاحة</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right w-[50px]">اختيار</TableHead>
                        <TableHead className="text-right">رقم السؤال</TableHead>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">الإجابة</TableHead>
                        <TableHead className="text-right">معاينة</TableHead>
                        <TableHead className="text-right w-[50px]">تعديل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {questions.map((q) => (
                        <TableRow key={`${q.source}-${q.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedQuestions.includes(q.id)}
                              onCheckedChange={() => toggleQuestion(q.id)}
                            />
                          </TableCell>
                          <TableCell>{q.question_number}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {q.question_type === "اختيار متعدد" ? "اختيار متعدد" : "إدخال"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{q.correct_answer}</TableCell>
                          <TableCell>
                            {q.page_image_name && q.frame_width && q.frame_height ? (
                              <div
                                className="w-24 h-16 bg-muted rounded overflow-hidden flex-shrink-0"
                                style={{
                                  backgroundImage: `url(${getImageUrl(q)})`,
                                  backgroundSize: `${100 / q.frame_width}% ${100 / q.frame_height}%`,
                                  backgroundPosition: `${(q.frame_left ?? 0) * 100}% ${(q.frame_top ?? 0) * 100}%`,
                                }}
                              />
                            ) : (
                              <p className="text-sm text-muted-foreground max-w-[200px] truncate">
                                {q.question_text || "—"}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(q)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveExam}
                disabled={isSubmitting || selectedQuestions.length === 0}
                className="min-w-[180px]"
              >
                <Save className="h-4 w-4 ml-2" />
                {isSubmitting ? "جاري الحفظ..." : "حفظ الاختبار"}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Edit Question Dialog */}
      <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل السؤال رقم {editingQuestion?.question_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingQuestion?.source === "text" && (
              <div className="space-y-2">
                <Label>نص السؤال</Label>
                <Textarea
                  value={editForm.question_text}
                  onChange={(e) => setEditForm((f) => ({ ...f, question_text: e.target.value }))}
                  rows={3}
                />
              </div>
            )}
            {editingQuestion?.source === "text" && editingQuestion?.question_type === "اختيار متعدد" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>الخيار أ</Label>
                    <Input value={editForm.option_a} onChange={(e) => setEditForm((f) => ({ ...f, option_a: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>الخيار ب</Label>
                    <Input value={editForm.option_b} onChange={(e) => setEditForm((f) => ({ ...f, option_b: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>الخيار ج</Label>
                    <Input value={editForm.option_c} onChange={(e) => setEditForm((f) => ({ ...f, option_c: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>الخيار د</Label>
                    <Input value={editForm.option_d} onChange={(e) => setEditForm((f) => ({ ...f, option_d: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>الإجابة الصحيحة</Label>
              <Input value={editForm.correct_answer} onChange={(e) => setEditForm((f) => ({ ...f, correct_answer: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingQuestion(null)}>إلغاء</Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CreateNewExam;
