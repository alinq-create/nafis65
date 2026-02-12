import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import ImageCropEditor from "@/components/teacher/ImageCropEditor";

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

const QuestionBank = () => {
  const { authUser } = useAuth();
  const [questions, setQuestions] = useState<UnifiedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<UnifiedQuestion | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState<UnifiedQuestion | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { toast } = useToast();

  const fetchQuestions = async () => {
    if (!authUser) return;
    const teacherSubject = authUser.profile?.subject || "رياضيات";
    const { data, error } = await supabase.rpc('get_teacher_questions', {
      p_subject: teacherSubject,
    });
    if (error) {
      console.error("Error fetching questions:", error);
      toast({ title: "خطأ في جلب الأسئلة", variant: "destructive" });
    }
    setQuestions((data as UnifiedQuestion[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, [authUser]);

  const handleDeleteQuestion = async (question: UnifiedQuestion) => {
    const table = question.source === 'image' ? 'question_bank' : 'text_question_bank';
    const { error } = await supabase.from(table).delete().eq("id", question.id);
    if (error) {
      toast({ title: "فشل حذف السؤال", variant: "destructive" });
    } else {
      setQuestions(prev => prev.filter(q => !(q.id === question.id && q.source === question.source)));
      toast({ title: "تم حذف السؤال بنجاح" });
    }
    setDeletingQuestion(null);
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const imageIds = questions.filter(q => q.source === 'image').map(q => q.id);
    const textIds = questions.filter(q => q.source === 'text').map(q => q.id);
    let hasError = false;

    if (imageIds.length > 0) {
      const { error } = await supabase.from('question_bank').delete().in('id', imageIds);
      if (error) hasError = true;
    }
    if (textIds.length > 0) {
      const { error } = await supabase.from('text_question_bank').delete().in('id', textIds);
      if (error) hasError = true;
    }

    if (hasError) {
      toast({ title: "حدث خطأ أثناء حذف بعض الأسئلة", variant: "destructive" });
    } else {
      toast({ title: `تم حذف ${questions.length} سؤال بنجاح` });
      setQuestions([]);
    }
    setBulkDeleting(false);
    setShowBulkDelete(false);
  };

  const getImageUrl = (question: UnifiedQuestion) => {
    if (!question.page_image_name) return "";
    const path = `shared/${question.page_image_name}`;
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSaveCrop = async (top: number, left: number, width: number, height: number) => {
    if (!editingQuestion) return;
    const prev = editingQuestion;

    // Optimistic update
    setQuestions(qs => qs.map(q =>
      q.id === prev.id && q.source === prev.source
        ? { ...q, frame_top: top, frame_left: left, frame_width: width, frame_height: height }
        : q
    ));
    setEditingQuestion(null);

    const { error } = await supabase
      .from("question_bank")
      .update({ frame_top: top, frame_left: left, frame_width: width, frame_height: height })
      .eq("id", prev.id);

    if (error) {
      // Revert
      setQuestions(qs => qs.map(q =>
        q.id === prev.id && q.source === prev.source
          ? { ...q, frame_top: prev.frame_top, frame_left: prev.frame_left, frame_width: prev.frame_width, frame_height: prev.frame_height }
          : q
      ));
      toast({ title: "فشل حفظ القص", variant: "destructive" });
    } else {
      toast({ title: "تم حفظ إطار القص بنجاح" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">بنك الأسئلة</h2>
            <p className="text-muted-foreground mt-1">
              {questions.length} سؤال في البنك
            </p>
          </div>
          {questions.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDelete(true)}
            >
              <Trash2 className="h-4 w-4 ml-2" />
              حذف جميع الأسئلة
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>الأسئلة</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : questions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا توجد أسئلة بعد. ارفعي ملف إكسل لإضافة الأسئلة.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم السؤال</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الإجابة</TableHead>
                    <TableHead className="text-right">معاينة</TableHead>
                    <TableHead className="text-right w-[60px]">حذف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q) => (
                    <TableRow key={`${q.source}-${q.id}`}>
                      <TableCell>{q.question_number}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {q.question_type === "اختيار متعدد" ? "اختيار متعدد" : "إدخال"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{q.correct_answer}</TableCell>
                      <TableCell>
                        {q.source === "image" && q.page_image_name && q.frame_width && q.frame_height ? (
                          <div
                            className="w-24 h-16 bg-muted rounded overflow-hidden relative cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                            style={{
                              backgroundImage: `url(${getImageUrl(q)})`,
                              backgroundSize: `${100 / q.frame_width}% ${100 / q.frame_height}%`,
                              backgroundPosition: `${(q.frame_left ?? 0) * 100}% ${(q.frame_top ?? 0) * 100}%`,
                            }}
                            onClick={() => setEditingQuestion(q)}
                            title="اضغطي لتعديل إطار القص"
                          />
                        ) : q.page_image_name ? (
                          <div
                            className="w-24 h-16 bg-muted rounded overflow-hidden relative cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                            style={{
                              backgroundImage: `url(${getImageUrl(q)})`,
                              backgroundSize: "cover",
                            }}
                            onClick={() => q.source === "image" && setEditingQuestion(q)}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {q.question_text || "—"}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingQuestion(q)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Crop Editor Dialog */}
      <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              تعديل إطار القص — سؤال {editingQuestion?.question_number}
            </DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <ImageCropEditor
              imageUrl={getImageUrl(editingQuestion)}
              initialTop={editingQuestion.frame_top ?? 0}
              initialLeft={editingQuestion.frame_left ?? 0}
              initialWidth={editingQuestion.frame_width ?? 1}
              initialHeight={editingQuestion.frame_height ?? 1}
              onSave={handleSaveCrop}
              onCancel={() => setEditingQuestion(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingQuestion} onOpenChange={(open) => !open && setDeletingQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف السؤال</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنتِ متأكدة من حذف السؤال رقم {deletingQuestion?.question_number}؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingQuestion && handleDeleteQuestion(deletingQuestion)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف جميع الأسئلة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنتِ متأكدة من حذف جميع الأسئلة ({questions.length} سؤال)؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? "جارٍ الحذف..." : "تأكيد حذف الكل"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default QuestionBank;
