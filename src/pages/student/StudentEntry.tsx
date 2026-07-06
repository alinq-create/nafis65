import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, LogIn } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import nafisLogo from "@/assets/nafis-logo.png";

interface AvailableExam {
  id: string;
  exam_name: string;
}

const SUBJECTS = ["رياضيات", "علوم", "لغتي"];

const StudentEntry = () => {
  const [studentName, setStudentName] = useState("");
  const [classNumber, setClassNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [availableExams, setAvailableExams] = useState<AvailableExam[] | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !classNumber || !subject) return;

    setIsLoading(true);
    setAvailableExams(null);

    try {
      const { data, error } = await supabase.functions.invoke("student-exam-access", {
        body: {
          studentName: studentName.trim(),
          classNumber: parseInt(classNumber),
          subject
        }
      });

      if (error || data?.error) {
        toast({
          title: "تنبيه",
          description: data?.error || "لا يمكن الوصول للاختبار",
          variant: "destructive"
        });
        return;
      }

      if (data.examId) {
        navigate("/student/exam", {
          state: {
            examId: data.examId,
            examName: data.examName,
            studentName: studentName.trim(),
            classNumber: parseInt(classNumber),
            questions: data.questions
          }
        });
        return;
      }

      if (data.exams?.length) {
        setAvailableExams(data.exams);
      }
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExamSelect = async (examId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("student-exam-access", {
        body: {
          studentName: studentName.trim(),
          classNumber: parseInt(classNumber),
          subject,
          examId
        }
      });

      if (error || data?.error) {
        toast({
          title: "خطأ",
          description: data?.error || "لا يمكن الوصول للاختبار",
          variant: "destructive"
        });
        return;
      }

      navigate("/student/exam", {
        state: {
          examId: data.examId,
          examName: data.examName,
          studentName: studentName.trim(),
          classNumber: parseInt(classNumber),
          questions: data.questions
        }
      });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (availableExams) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <img src={nafisLogo} alt="شعار نافس" className="h-24 mx-auto mb-4 object-contain" />
              <h1 className="text-3xl font-bold text-foreground">اختر الاختبار</h1>
              <p className="text-muted-foreground mt-2">يوجد أكثر من اختبار متاح، اختاري واحدًا</p>
            </div>

            <div className="space-y-3">
              {availableExams.map((exam) =>
              <Card
                key={exam.id}
                className="cursor-pointer hover:border-primary transition-colors shadow-sm"
                onClick={() => handleExamSelect(exam.id)}>

                  <CardContent className="flex items-center justify-between p-5">
                    <span className="font-medium text-lg">{exam.exam_name}</span>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="text-center mt-6">
              <Button variant="outline" onClick={() => setAvailableExams(null)} disabled={isLoading}>
                {isLoading ? "جاري التحميل..." : "رجوع"}
              </Button>
            </div>
          </div>
        </div>
      </AppShell>);

  }

  const loginButton = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate("/login")}
            className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-all duration-300">
            <LogIn className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>دخول المديرة والمعلمات</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <AppShell headerExtra={loginButton}>
      <div className="flex flex-1 items-start justify-center px-4 pb-8 pt-2 sm:pt-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-7">
            <div className="mx-auto mb-4 flex h-28 w-44 items-center justify-center rounded-2xl bg-white/85 shadow-[0_16px_40px_rgba(15,23,42,0.08)] ring-1 ring-white">
              <img src={nafisLogo} alt="شعار نافس" className="h-24 object-contain" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-normal text-primary">منصة تدريب نافس</h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground">أدخلي بياناتك للبدء بالاختبار</p>
          </div>

          <div className="rounded-xl bg-gradient-to-l from-primary via-accent to-warning p-[2px] shadow-[0_0_28px_rgba(14,116,144,0.32),0_0_52px_rgba(20,184,166,0.22)]">
            <Card className="border-0 bg-white/95 shadow-[0_22px_55px_rgba(15,23,42,0.10)] backdrop-blur">
              <CardHeader className="text-center pb-5 pt-7">
                <CardTitle className="text-2xl font-extrabold">دخول الاختبار</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-7">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="font-bold">اسم الطالبة</Label>
                  <Input
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="أدخلي اسمك الكامل"
                    className="h-11 bg-background/70 text-right"
                    required />

                </div>

                <div className="space-y-2">
                  <Label className="font-bold">رقم الفصل</Label>
                  <Select value={classNumber} onValueChange={setClassNumber}>
                    <SelectTrigger className="h-11 bg-background/70">
                      <SelectValue placeholder="اختاري رقم الفصل" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) =>
                      <SelectItem key={i + 1} value={String(i + 1)}>
                          فصل {i + 1}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="font-bold">المادة</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="h-11 bg-background/70">
                      <SelectValue placeholder="اختاري المادة" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) =>
                      <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="h-11 w-full text-base font-extrabold shadow-md shadow-primary/20" disabled={isLoading || !studentName.trim() || !classNumber || !subject}>
                  {isLoading ? "جاري البحث..." : "دخول الاختبار"}
                </Button>
              </form>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </AppShell>);

};

export default StudentEntry;
