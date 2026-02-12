import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, ChevronLeft, Send } from "lucide-react";
import AppShell from "@/components/layout/AppShell";

interface ExamQuestion {
  id: string;
  question_type: string;
  page_image_name?: string;
  frame_top?: number;
  frame_left?: number;
  frame_width?: number;
  frame_height?: number;
  question_order: number;
  source_type?: string;
  question_text?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
}

const TakeExam = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { examId, examName, studentName, classNumber, questions } = location.state || {};
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!examId || !questions?.length) {
    navigate("/student");
    return null;
  }

  const sortedQuestions: ExamQuestion[] = [...questions].sort(
    (a: ExamQuestion, b: ExamQuestion) => a.question_order - b.question_order
  );
  const currentQuestion = sortedQuestions[currentIndex];
  const totalQuestions = sortedQuestions.length;

  const getImageUrl = (imageName?: string) => {
    if (!imageName) return '';
    const { data } = supabase.storage
      .from("question-images")
      .getPublicUrl(`shared/${imageName}`);
    return data.publicUrl;
  };

  const isTextQuestion = currentQuestion?.source_type === 'text';

  const handleAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-exam", {
        body: {
          examId,
          studentName,
          classNumber,
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || "حدث خطأ");
      }

      navigate("/student/confirmation");
    } catch {
      toast({ title: "حدث خطأ في إرسال الإجابات", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell hideFooter>
      <div className="flex flex-col flex-1">
        {/* Exam Header */}
        <div className="bg-card border-b px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="font-bold text-lg">{examName}</h1>
            <span className="text-muted-foreground text-sm">
              السؤال {currentIndex + 1} من {totalQuestions}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted h-2">
          <div
            className="bg-primary h-2 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-3xl space-y-6">
            <Card className="overflow-hidden">
              <CardContent className={isTextQuestion ? "p-6" : "p-0"}>
                {isTextQuestion ? (
                  <div className="space-y-4">
                    <p className="text-lg font-medium leading-relaxed">{currentQuestion.question_text}</p>
                    <div className="grid grid-cols-1 gap-2 text-base">
                      {currentQuestion.option_a && <p>أ) {currentQuestion.option_a}</p>}
                      {currentQuestion.option_b && <p>ب) {currentQuestion.option_b}</p>}
                      {currentQuestion.option_c && <p>ج) {currentQuestion.option_c}</p>}
                      {currentQuestion.option_d && <p>د) {currentQuestion.option_d}</p>}
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-full min-h-[300px] bg-muted"
                    style={{
                      backgroundImage: `url(${getImageUrl(currentQuestion.page_image_name)})`,
                      backgroundSize: `${100 / (currentQuestion.frame_width || 1)}% ${100 / (currentQuestion.frame_height || 1)}%`,
                      backgroundPosition: `${((currentQuestion.frame_left || 0) / (1 - (currentQuestion.frame_width || 1))) * 100}% ${((currentQuestion.frame_top || 0) / (1 - (currentQuestion.frame_height || 1))) * 100}%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                {currentQuestion.question_type === "اختيار متعدد" ? (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={handleAnswer}
                    className="space-y-3"
                  >
                    {["أ", "ب", "ج", "د"].map((option) => (
                      <div
                        key={option}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      >
                        <RadioGroupItem value={option} id={`option-${option}`} />
                        <Label htmlFor={`option-${option}`} className="cursor-pointer flex-1 text-lg">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-base">اكتبي إجابتك:</Label>
                    <Input
                      value={answers[currentQuestion.id] || ""}
                      onChange={(e) => handleAnswer(e.target.value)}
                      placeholder="أدخلي الإجابة هنا"
                      className="text-lg py-6"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-card border-t px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentIndex((i) => i - 1)}
              disabled={currentIndex === 0}
            >
              <ChevronRight className="h-4 w-4 ml-1" />
              السابق
            </Button>

            {currentIndex === totalQuestions - 1 ? (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                <Send className="h-4 w-4 ml-2" />
                {isSubmitting ? "جاري الإرسال..." : "إرسال الإجابات"}
              </Button>
            ) : (
              <Button onClick={() => setCurrentIndex((i) => i + 1)}>
                التالي
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default TakeExam;
