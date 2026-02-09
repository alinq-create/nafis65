import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

const SubmissionConfirmation = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full shadow-lg border-0">
        <CardContent className="p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">تم إرسال إجاباتك بنجاح</h1>
            <p className="text-muted-foreground">
              شكرًا لك على إكمال الاختبار. سيتم مراجعة إجاباتك من قبل المعلمة.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/student")}
            className="w-full"
          >
            العودة للصفحة الرئيسية
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubmissionConfirmation;
