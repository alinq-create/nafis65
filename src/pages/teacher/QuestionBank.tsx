import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Question = Tables<"question_bank">;

const QuestionBank = () => {
  const { authUser } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchQuestions = async () => {
    if (!authUser) return;
    const { data } = await supabase
      .from("question_bank")
      .select("*")
      .eq("teacher_id", authUser.user.id)
      .order("page_number", { ascending: true })
      .order("question_number", { ascending: true });

    setQuestions(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, [authUser]);

  const handleToggleVisibility = async (question: Question) => {
    await supabase
      .from("question_bank")
      .update({ visible_to_students: !question.visible_to_students })
      .eq("id", question.id);
    fetchQuestions();
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    toast({ title: "جاري معالجة الملف..." });

    try {
      const { data, error } = await supabase.functions.invoke("process-excel", {
        body: { teacherId: authUser.user.id, subject: authUser.profile?.subject || "رياضيات" },
      });

      if (error) throw error;
      toast({ title: "تم استيراد الأسئلة بنجاح", description: `تم إضافة ${data?.count || 0} سؤال` });
      fetchQuestions();
    } catch {
      toast({ title: "حدث خطأ في معالجة الملف", variant: "destructive" });
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authUser) return;

    toast({ title: "جاري رفع الصور..." });

    try {
      // Upload ZIP to storage
      const fileName = `${authUser.user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("question-images")
        .upload(fileName, file);

      if (error) throw error;
      toast({ title: "تم رفع الملف بنجاح", description: "سيتم معالجة الصور قريبًا" });
    } catch {
      toast({ title: "حدث خطأ في رفع الملف", variant: "destructive" });
    }
  };

  const getImageUrl = (imageName: string) => {
    if (!authUser) return "";
    const { data } = supabase.storage
      .from("question-images")
      .getPublicUrl(`${authUser.user.id}/${imageName}`);
    return data.publicUrl;
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
          <div className="flex gap-3">
            <label>
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleZipUpload}
              />
              <Button variant="outline" asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 ml-2" />
                  رفع صور (ZIP)
                </span>
              </Button>
            </label>
            <label>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleExcelUpload}
              />
              <Button asChild>
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 ml-2" />
                  رفع أسئلة (إكسل)
                </span>
              </Button>
            </label>
          </div>
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
                    <TableHead className="text-right">الصفحة</TableHead>
                    <TableHead className="text-right">رقم السؤال</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الإجابة</TableHead>
                    <TableHead className="text-right">معاينة</TableHead>
                    <TableHead className="text-right">يظهر للطالبات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>{q.page_number}</TableCell>
                      <TableCell>{q.question_number}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {q.question_type === "اختيار متعدد" ? "اختيار متعدد" : "إدخال"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{q.correct_answer}</TableCell>
                      <TableCell>
                        <div
                          className="w-24 h-16 bg-muted rounded overflow-hidden relative"
                          style={{
                            backgroundImage: `url(${getImageUrl(q.page_image_name)})`,
                            backgroundSize: `${100 / q.frame_width}% ${100 / q.frame_height}%`,
                            backgroundPosition: `${q.frame_left * 100}% ${q.frame_top * 100}%`,
                          }}
                        />
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
