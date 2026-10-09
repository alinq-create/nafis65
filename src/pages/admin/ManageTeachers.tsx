import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface TeacherData {
  user_id: string;
  name: string;
  username: string;
  subject: string | null;
  status: string;
  from_class?: number;
  to_class?: number;
}

const SUBJECTS = ["رياضيات", "علوم", "لغتي"];

const ManageTeachers = () => {
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherData | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    subject: "رياضيات",
    fromClass: "1",
    toClass: "10",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTeachers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, username, subject, status");

    if (!profiles) return;

    // Filter only teachers by checking user_roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "teacher");

    const teacherUserIds = new Set(roles?.map((r) => r.user_id) ?? []);

    const { data: permissions } = await supabase
      .from("class_permissions")
      .select("teacher_id, from_class, to_class");

    const teachersList: TeacherData[] = profiles
      .filter((p) => teacherUserIds.has(p.user_id))
      .map((p) => {
        const perm = permissions?.find((cp) => cp.teacher_id === p.user_id);
        return {
          ...p,
          from_class: perm?.from_class,
          to_class: perm?.to_class,
        };
      });

    setTeachers(teachersList);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-teacher", {
        body: {
          action: "create",
          name: formData.name,
          username: formData.username,
          password: formData.password,
          subject: formData.subject,
          fromClass: parseInt(formData.fromClass),
          toClass: parseInt(formData.toClass),
        },
      });

      if (error || data?.error) {
        let msg = data?.error || "حدث خطأ";
        try {
          const body = await (error as any)?.context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      toast({ title: "تمت إضافة المعلمة بنجاح" });
      setIsOpen(false);
      setFormData({ name: "", username: "", password: "", subject: "رياضيات", fromClass: "1", toClass: "10" });
      fetchTeachers();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (teacher: TeacherData) => {
    const newStatus = teacher.status === "active" ? "inactive" : "active";
    await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("user_id", teacher.user_id);
    
    toast({
      title: newStatus === "active" ? "تم تفعيل المعلمة" : "تم تعطيل المعلمة",
    });
    fetchTeachers();
  };

  const handleUpdatePermissions = async () => {
    if (!editingTeacher) return;
    setIsSubmitting(true);

    try {
      // Update or insert class permissions
      const { data: existing } = await supabase
        .from("class_permissions")
        .select("id")
        .eq("teacher_id", editingTeacher.user_id)
        .single();

      if (existing) {
        await supabase
          .from("class_permissions")
          .update({
            from_class: parseInt(formData.fromClass),
            to_class: parseInt(formData.toClass),
          })
          .eq("teacher_id", editingTeacher.user_id);
      } else {
        await supabase.from("class_permissions").insert({
          teacher_id: editingTeacher.user_id,
          from_class: parseInt(formData.fromClass),
          to_class: parseInt(formData.toClass),
        });
      }

      // Update subject
      await supabase
        .from("profiles")
        .update({ subject: formData.subject })
        .eq("user_id", editingTeacher.user_id);

      toast({ title: "تم تحديث البيانات بنجاح" });
      setEditingTeacher(null);
      fetchTeachers();
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeacher = async (teacher: TeacherData) => {
    setDeletingTeacherId(teacher.user_id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-teacher", {
        body: {
          action: "delete",
          userId: teacher.user_id,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || "حدث خطأ في الحذف");
      }

      toast({ title: "تم حذف المعلمة وجميع بياناتها بنجاح" });
      fetchTeachers();
    } catch (err: any) {
      toast({ title: "خطأ في الحذف", description: err.message, variant: "destructive" });
    } finally {
      setDeletingTeacherId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">إدارة المعلمات</h2>
            <p className="text-muted-foreground mt-1">إضافة وإدارة حسابات المعلمات</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                إضافة معلمة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة معلمة جديدة</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddTeacher} className="space-y-4">
                <div className="space-y-2">
                  <Label>الاسم</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="اسم المعلمة"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم المستخدم (بالإنجليزية فقط)</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9._-]/g, "");
                      setFormData({ ...formData, username: val });
                    }}
                    placeholder="مثال: teacher1"
                    required
                    dir="ltr"
                    className="text-left"
                    pattern="[a-zA-Z0-9._-]+"
                    title="يجب أن يكون اسم المستخدم بالإنجليزية فقط (أحرف وأرقام)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>كلمة المرور</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="كلمة المرور"
                    required
                    minLength={6}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label>المادة</Label>
                  <Select value={formData.subject} onValueChange={(v) => setFormData({ ...formData, subject: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>من فصل</Label>
                    <Select value={formData.fromClass} onValueChange={(v) => setFormData({ ...formData, fromClass: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>إلى فصل</Label>
                    <Select value={formData.toClass} onValueChange={(v) => setFormData({ ...formData, toClass: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "جاري الإضافة..." : "إضافة المعلمة"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Permissions Dialog */}
        <Dialog open={!!editingTeacher} onOpenChange={(open) => !open && setEditingTeacher(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل بيانات المعلمة: {editingTeacher?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>المادة</Label>
                <Select value={formData.subject} onValueChange={(v) => setFormData({ ...formData, subject: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>من فصل</Label>
                  <Select value={formData.fromClass} onValueChange={(v) => setFormData({ ...formData, fromClass: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>إلى فصل</Label>
                  <Select value={formData.toClass} onValueChange={(v) => setFormData({ ...formData, toClass: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleUpdatePermissions} className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "جاري التحديث..." : "حفظ التعديلات"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>قائمة المعلمات</CardTitle>
          </CardHeader>
          <CardContent>
            {teachers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد معلمات بعد</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">اسم المستخدم</TableHead>
                    <TableHead className="text-right">المادة</TableHead>
                    <TableHead className="text-right">الفصول</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => (
                    <TableRow key={teacher.user_id}>
                      <TableCell className="font-medium">{teacher.name}</TableCell>
                      <TableCell>{teacher.username}</TableCell>
                      <TableCell>{teacher.subject || "-"}</TableCell>
                      <TableCell>
                        {teacher.from_class && teacher.to_class
                          ? `${teacher.from_class} - ${teacher.to_class}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={teacher.status === "active" ? "default" : "secondary"}>
                          {teacher.status === "active" ? "مفعّلة" : "معطّلة"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingTeacher(teacher);
                              setFormData({
                                ...formData,
                                subject: teacher.subject || "رياضيات",
                                fromClass: String(teacher.from_class || 1),
                                toClass: String(teacher.to_class || 10),
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={teacher.status === "active" ? "destructive" : "default"}
                            size="sm"
                            onClick={() => handleToggleStatus(teacher)}
                          >
                            {teacher.status === "active" ? "تعطيل" : "تفعيل"}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={deletingTeacherId === teacher.user_id}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف المعلمة</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل تريدين حذف المعلمة "{teacher.name}"؟ سيتم حذف جميع اختباراتها ومحاولات الطالبات ونتائجهن المرتبطة بها نهائياً، ولن تظهر في التحليلات.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteTeacher(teacher)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  حذف نهائي
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

export default ManageTeachers;
