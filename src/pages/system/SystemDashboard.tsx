import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SystemDashboard = () => {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteLughati = async () => {
    setDeleting(true);
    const { error, count } = await supabase
      .from("text_question_bank")
      .delete({ count: "exact" })
      .eq("subject", "لغتي");
    setDeleting(false);
    setShowDeleteDialog(false);
    if (error) {
      toast.error("حدث خطأ أثناء الحذف: " + error.message);
    } else {
      toast.success(`تم حذف ${count ?? 0} سؤال من أسئلة لغتي بنجاح`);
    }
  };
  const cards = [
    {
      title: "استيراد بنك الأسئلة (رياضيات)",
      description: "رفع ملف إكسل وصور الصفحات لاستيراد الأسئلة",
      icon: Upload,
      path: "/system/import",
    },
    {
      title: "استيراد أسئلة العلوم",
      description: "رفع ملف إكسل لاستيراد أسئلة اختيار من متعدد لمادة العلوم",
      icon: FileText,
      path: "/system/import-text?subject=علوم",
    },
    {
      title: "استيراد أسئلة لغتي",
      description: "رفع ملف إكسل لاستيراد أسئلة اختيار من متعدد لمادة لغتي",
      icon: FileText,
      path: "/system/import-text?subject=لغتي",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">لوحة مدير النظام</h2>
          <p className="text-muted-foreground mt-1">إدارة النظام والبيانات</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.path}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(card.path)}
              >
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            حذف جميع أسئلة لغتي
          </Button>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف جميع أسئلة مادة لغتي من بنك الأسئلة النصية. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteLughati} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? "جاري الحذف..." : "تأكيد الحذف"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default SystemDashboard;
