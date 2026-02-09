import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

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

  const handleToggleVisibility = async (question: UnifiedQuestion) => {
    const table = question.source === 'image' ? 'question_bank' : 'text_question_bank';

    await supabase
      .from(table)
      .update({ visible_to_students: !question.visible_to_students } as any)
      .eq("id", question.id);
    fetchQuestions();
  };

  const getImageUrl = (question: UnifiedQuestion) => {
    if (!authUser || !question.page_image_name) return "";
    const isOwnQuestion = question.teacher_id === authUser.user.id;
    const path = isOwnQuestion
      ? `${authUser.user.id}/${question.page_image_name}`
      : `shared/${question.page_image_name}`;
    const { data } = supabase.storage
      .from("question-images")
      .getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">بنك الأسئلة</h2>
            <p className="text-muted-foreground mt-1">
              {questions.length} سؤال في البنك
            </p>
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
                    <TableHead className="text-right">يظهر للطالبات</TableHead>
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
                        {q.page_image_name && q.frame_width && q.frame_height ? (
                          <div
                            className="w-24 h-16 bg-muted rounded overflow-hidden relative"
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
                        <Switch
                          checked={q.visible_to_students}
                          onCheckedChange={() => handleToggleVisibility(q)}
                        />
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

export default QuestionBank;
