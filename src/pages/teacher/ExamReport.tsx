import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Printer, ArrowRight } from "lucide-react";
import schoolLogo from "@/assets/school-logo.png";

interface StudentRow {
  name: string;
  classNumber: number;
  score: number;
  total: number;
  pct: number;
}

interface ClassStat {
  classNumber: number;
  count: number;
  avg: number;
  high: number;
  low: number;
}

const ExamReport = () => {
  const { examId } = useParams<{ examId: string }>();
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classStats, setClassStats] = useState<ClassStat[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [successRate, setSuccessRate] = useState(0);

  useEffect(() => {
    if (!examId || !authUser) return;
    const fetch = async () => {
      setLoading(true);

      const { data: exam } = await supabase
        .from("exams")
        .select("exam_name, subject, teacher_id")
        .eq("id", examId)
        .single();

      if (!exam) { setLoading(false); return; }
      setExamName(exam.exam_name);
      setSubject(exam.subject);

      const { data: eqs } = await supabase
        .from("exam_questions")
        .select("question_id")
        .eq("exam_id", examId);
      const totalQ = eqs?.length || 1;
      setTotalQuestions(totalQ);

      const { data: attempts } = await supabase
        .from("student_attempts")
        .select("student_name, class_number, approved_score")
        .eq("exam_id", examId)
        .eq("status", "معتمد")
        .order("class_number")
        .order("student_name");

      if (!attempts?.length) { setLoading(false); return; }

      const rows: StudentRow[] = attempts.map((a) => ({
        name: a.student_name,
        classNumber: a.class_number,
        score: a.approved_score ?? 0,
        total: totalQ,
        pct: Math.round(((a.approved_score ?? 0) / totalQ) * 100),
      }));
      setStudents(rows);
      setTotalStudents(rows.length);

      const scores = rows.map((r) => r.score);
      setAvgScore(Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100);
      setSuccessRate(Math.round((scores.filter((s) => s >= totalQ * 0.5).length / scores.length) * 100));

      // Class stats
      const classMap = new Map<number, number[]>();
      rows.forEach((r) => {
        if (!classMap.has(r.classNumber)) classMap.set(r.classNumber, []);
        classMap.get(r.classNumber)!.push(r.score);
      });
      const cs: ClassStat[] = Array.from(classMap.entries()).map(([cn, sc]) => ({
        classNumber: cn,
        count: sc.length,
        avg: Math.round((sc.reduce((a, b) => a + b, 0) / sc.length) * 100) / 100,
        high: Math.max(...sc),
        low: Math.min(...sc),
      }));
      setClassStats(cs);
      setLoading(false);
    };
    fetch();
  }, [examId, authUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-8" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      {/* Action buttons - hidden on print */}
      <div className="no-print flex gap-3 mb-6">
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة / حفظ PDF
        </Button>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          رجوع
        </Button>
      </div>

      {/* Report Header with Logo */}
      <div className="report-header flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-6">
        <img src={schoolLogo} alt="شعار المدرسة" className="w-20 h-20 object-contain" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold">منصة نافس - تقرير الاختبار</h1>
          <p className="text-lg font-semibold mt-1">{examName}</p>
          <p className="text-sm text-gray-600 mt-1">التاريخ: {new Date().toLocaleDateString("ar-SA")}</p>
        </div>
        <div className="w-20" /> {/* Spacer for symmetry */}
      </div>

      {/* Exam Summary */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b pb-2">ملخص الاختبار</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">المادة</p>
            <p className="font-bold text-lg">{subject}</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">عدد الطالبات</p>
            <p className="font-bold text-lg">{totalStudents}</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">متوسط الدرجات</p>
            <p className="font-bold text-lg">{avgScore} / {totalQuestions}</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">نسبة النجاح</p>
            <p className="font-bold text-lg">{successRate}%</p>
          </div>
        </div>
      </div>

      {/* Class Statistics */}
      {classStats.length > 1 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 border-b pb-2">إحصاءات الفصول</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-right">الفصل</th>
                <th className="border p-2 text-right">عدد الطالبات</th>
                <th className="border p-2 text-right">المتوسط</th>
                <th className="border p-2 text-right">أعلى درجة</th>
                <th className="border p-2 text-right">أدنى درجة</th>
              </tr>
            </thead>
            <tbody>
              {classStats.map((c) => (
                <tr key={c.classNumber}>
                  <td className="border p-2 font-medium">فصل {c.classNumber}</td>
                  <td className="border p-2">{c.count}</td>
                  <td className="border p-2">{c.avg}</td>
                  <td className="border p-2">{c.high}</td>
                  <td className="border p-2">{c.low}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Scores Table */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b pb-2">درجات الطالبات</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-right">م</th>
              <th className="border p-2 text-right">اسم الطالبة</th>
              <th className="border p-2 text-right">الفصل</th>
              <th className="border p-2 text-right">الدرجة</th>
              <th className="border p-2 text-right">النسبة</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border p-2">{i + 1}</td>
                <td className="border p-2 font-medium">{s.name}</td>
                <td className="border p-2">{s.classNumber}</td>
                <td className="border p-2">{s.score} / {s.total}</td>
                <td className="border p-2 font-semibold">{s.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
        <p>تم إنشاء هذا التقرير من منصة نافس - {new Date().toLocaleDateString("ar-SA")}</p>
      </div>
    </div>
  );
};

export default ExamReport;
