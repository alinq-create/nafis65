import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Users, Search, Eye } from "lucide-react";

interface StudentSummary {
  name: string;
  classNumber: number;
  totalExams: number;
  avgScore: number;
  level: string;
}

const StudentsList = () => {
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  useEffect(() => {
    const fetchStudents = async () => {
      if (!authUser?.user) return;
      setLoading(true);

      // Get teacher's exams
      const { data: exams } = await supabase
        .from("exams")
        .select("id")
        .eq("teacher_id", authUser.user.id);

      if (!exams || exams.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const examIds = exams.map((e) => e.id);

      // Get approved attempts
      const { data: attempts } = await supabase
        .from("student_attempts")
        .select("student_name, class_number, approved_score, exam_id")
        .in("exam_id", examIds)
        .eq("status", "معتمد");

      if (!attempts || attempts.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Get question counts per exam
      const { data: examQuestions } = await supabase
        .from("exam_questions")
        .select("exam_id")
        .in("exam_id", examIds);

      const questionCountMap: Record<string, number> = {};
      examQuestions?.forEach((eq) => {
        questionCountMap[eq.exam_id] = (questionCountMap[eq.exam_id] || 0) + 1;
      });

      // Group by student
      const studentMap = new Map<string, { name: string; classNumber: number; scores: number[] }>();

      attempts.forEach((a) => {
        const key = `${a.student_name}__${a.class_number}`;
        if (!studentMap.has(key)) {
          studentMap.set(key, { name: a.student_name, classNumber: a.class_number, scores: [] });
        }
        const total = questionCountMap[a.exam_id] || 1;
        const pct = ((a.approved_score || 0) / total) * 100;
        studentMap.get(key)!.scores.push(pct);
      });

      const result: StudentSummary[] = [];
      studentMap.forEach((val) => {
        const avg = val.scores.reduce((a, b) => a + b, 0) / val.scores.length;
        const level = avg >= 80 ? "ممتاز" : avg >= 60 ? "جيد" : "يحتاج دعم";
        result.push({
          name: val.name,
          classNumber: val.classNumber,
          totalExams: val.scores.length,
          avgScore: Math.round(avg),
          level,
        });
      });

      result.sort((a, b) => a.name.localeCompare(b.name, "ar"));
      setStudents(result);
      setLoading(false);
    };

    fetchStudents();
  }, [authUser]);

  const classes = useMemo(() => {
    const set = new Set(students.map((s) => s.classNumber));
    return Array.from(set).sort((a, b) => a - b);
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchSearch = !search || s.name.includes(search);
      const matchClass = classFilter === "all" || s.classNumber === Number(classFilter);
      return matchSearch && matchClass;
    });
  }, [students, search, classFilter]);

  const getLevelVariant = (level: string) => {
    if (level === "ممتاز") return "default";
    if (level === "جيد") return "secondary";
    return "destructive";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">الطالبات</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة الطالبات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={classFilter} onValueChange={setClassFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="الفصل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفصول</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      فصل {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الفصل</TableHead>
                    <TableHead className="text-right">عدد الاختبارات</TableHead>
                    <TableHead className="text-right">المتوسط</TableHead>
                    <TableHead className="text-right">المستوى</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={`${s.name}__${s.classNumber}`}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>فصل {s.classNumber}</TableCell>
                      <TableCell>{s.totalExams}</TableCell>
                      <TableCell>{s.avgScore}%</TableCell>
                      <TableCell>
                        <Badge variant={getLevelVariant(s.level)}>{s.level}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(`/teacher/students/${encodeURIComponent(s.name)}/${s.classNumber}`)
                          }
                        >
                          <Eye className="h-4 w-4 ml-1" />
                          عرض الملف
                        </Button>
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

export default StudentsList;
