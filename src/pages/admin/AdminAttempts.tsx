import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ApprovedAttempt {
  id: string;
  student_name: string;
  class_number: number;
  submission_time: string;
  approved_score: number | null;
  exam_name: string;
  subject: string;
}

const AdminAttempts = () => {
  const [attempts, setAttempts] = useState<ApprovedAttempt[]>([]);
  const [filteredAttempts, setFilteredAttempts] = useState<ApprovedAttempt[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classes, setClasses] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApprovedAttempts = async () => {
      setLoading(true);

      const { data: exams } = await supabase
        .from("exams")
        .select("id, exam_name, subject");

      if (!exams?.length) {
        setLoading(false);
        return;
      }

      const examMap = new Map(exams.map((e) => [e.id, e]));
      const examIds = exams.map((e) => e.id);

      const { data: attemptsData } = await supabase
        .from("student_attempts")
        .select("*")
        .in("exam_id", examIds)
        .eq("status", "معتمد")
        .order("submission_time", { ascending: false });

      const mapped: ApprovedAttempt[] = (attemptsData ?? []).map((a) => ({
        id: a.id,
        student_name: a.student_name,
        class_number: a.class_number,
        submission_time: a.submission_time,
        approved_score: a.approved_score,
        exam_name: examMap.get(a.exam_id)?.exam_name ?? "",
        subject: examMap.get(a.exam_id)?.subject ?? "",
      }));

      setAttempts(mapped);

      const uniqueSubjects = [...new Set(mapped.map((a) => a.subject))];
      const uniqueClasses = [...new Set(mapped.map((a) => a.class_number))].sort((a, b) => a - b);
      setSubjects(uniqueSubjects);
      setClasses(uniqueClasses);
      setLoading(false);
    };

    fetchApprovedAttempts();
  }, []);

  useEffect(() => {
    let filtered = attempts;
    if (subjectFilter !== "all") {
      filtered = filtered.filter((a) => a.subject === subjectFilter);
    }
    if (classFilter !== "all") {
      filtered = filtered.filter((a) => a.class_number === parseInt(classFilter));
    }
    setFilteredAttempts(filtered);
  }, [attempts, subjectFilter, classFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">المحاولات المعتمدة</h2>
          <p className="text-muted-foreground mt-1">نتائج الطالبات بعد اعتماد المعلمة</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="تصفية حسب المادة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المواد</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="تصفية حسب الفصل" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفصول</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c} value={String(c)}>فصل {c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>النتائج المعتمدة ({filteredAttempts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredAttempts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد محاولات معتمدة</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالبة</TableHead>
                    <TableHead className="text-right">الفصل</TableHead>
                    <TableHead className="text-right">الاختبار</TableHead>
                    <TableHead className="text-right">المادة</TableHead>
                    <TableHead className="text-right">الدرجة المعتمدة</TableHead>
                    <TableHead className="text-right">وقت الإرسال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-medium">{attempt.student_name}</TableCell>
                      <TableCell>{attempt.class_number}</TableCell>
                      <TableCell>{attempt.exam_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{attempt.subject}</Badge>
                      </TableCell>
                      <TableCell className="font-bold">{attempt.approved_score ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(attempt.submission_time).toLocaleDateString("ar-SA")}
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

export default AdminAttempts;
