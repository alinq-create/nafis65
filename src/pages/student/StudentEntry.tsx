import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap } from "lucide-react";

const StudentEntry = () => {
  const [studentName, setStudentName] = useState("");
  const [classNumber, setClassNumber] = useState("");
  const [examCode, setExamCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !classNumber || !examCode.trim()) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("student-exam-access", {
        body: {
          studentName: studentName.trim(),
          classNumber: parseInt(classNumber),
          examCode: examCode.trim(),
        },
      });

      if (error || data?.error) {
        toast({
          title: "خطأ",
          description: data?.error || "لا يمكن الوصول للاختبار",
          variant: "destructive",
        });
        return;
      }

      // Navigate to exam with data
      navigate("/student/exam", {
        state: {
          examId: data.examId,
          examName: data.examName,
          studentName: studentName.trim(),
          classNumber: parseInt(classNumber),
          questions: data.questions,
        },
      });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">منصة نافس</h1>
          <p className="text-muted-foreground mt-2">أدخلي بياناتك للبدء بالاختبار</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">دخول الاختبار</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label>اسم الطالبة</Label>
                <Input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="أدخلي اسمك الكامل"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>رقم الفصل</Label>
                <Select value={classNumber} onValueChange={setClassNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختاري رقم الفصل" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        فصل {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>رمز الاختبار</Label>
                <Input
                  value={examCode}
                  onChange={(e) => setExamCode(e.target.value)}
                  placeholder="مثال: رياضيات-101"
                  required
                  dir="rtl"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "جاري التحقق..." : "دخول الاختبار"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/login")}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            هل أنتِ معلمة أو مديرة؟ تسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentEntry;
