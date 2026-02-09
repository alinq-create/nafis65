import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Exam = Tables<"exams">;

const CreateExam = () => {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const { toast } = useToast();

  const fetchExams = async () => {
    if (!authUser) return;
    const { data } = await supabase
      .from("exams")
      .select("*")
      .eq("teacher_id", authUser.user.id)
      .order("created_at", { ascending: false });
    setExams(data ?? []);
  };

  useEffect(() => {
    fetchExams();
  }, [authUser]);

  const handlePublishExam = async (examId: string) => {
    await supabase.from("exams").update({ status: "منشور" }).eq("id", examId);
    toast({ title: "تم نشر الاختبار" });
    fetchExams();
  };

  const handleCloseExam = async (examId: string) => {
    await supabase.from("exams").update({ status: "مغلق" }).eq("id", examId);
    toast({ title: "تم إغلاق الاختبار" });
    fetchExams();
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
          <Button onClick={() => navigate("/teacher/create-exam")}>
            <Plus className="h-4 w-4 ml-2" />
            اختبار جديد
          </Button>
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
