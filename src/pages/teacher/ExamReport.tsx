import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Printer, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import schoolLogo from "@/assets/school-logo-65.png";
import nafisLogo from "@/assets/nafis-logo.png";

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

interface ScoreRange {
  label: string;
  count: number;
  color: string;
}

const ExamReport = () => {
  const { examId } = useParams<{ examId: string }>();
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [targetClasses, setTargetClasses] = useState<number[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classStats, setClassStats] = useState<ClassStat[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [avgPct, setAvgPct] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lowScore, setLowScore] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);

  useEffect(() => {
    if (!examId || !authUser) return;
    const fetchData = async () => {
      setLoading(true);

      const { data: exam } = await supabase
        .from("exams")
        .select("exam_name, subject, teacher_id, target_classes")
        .eq("id", examId)
        .single();

      if (!exam) { setLoading(false); return; }
      setExamName(exam.exam_name);
      setSubject(exam.subject);
      setTargetClasses(exam.target_classes || []);

      // Fetch teacher name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", exam.teacher_id)
        .single();
      if (profile) setTeacherName(profile.name);

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
      const pcts = rows.map((r) => r.pct);
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
      const avgP = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      const high = Math.max(...scores);
      const low = Math.min(...scores);

      setAvgScore(avg);
      setAvgPct(avgP);
      setHighScore(high);
      setLowScore(low);
      setSuccessRate(Math.round((scores.filter((s) => s >= totalQ * 0.5).length / scores.length) * 100));

      // Score distribution
      const ranges: ScoreRange[] = [
        { label: "90–100%", count: pcts.filter((p) => p >= 90).length, color: "hsl(152, 60%, 40%)" },
        { label: "70–89%", count: pcts.filter((p) => p >= 70 && p < 90).length, color: "hsl(199, 70%, 45%)" },
        { label: "50–69%", count: pcts.filter((p) => p >= 50 && p < 70).length, color: "hsl(38, 90%, 50%)" },
        { label: "أقل من 50%", count: pcts.filter((p) => p < 50).length, color: "hsl(0, 72%, 55%)" },
      ];
      setScoreRanges(ranges);

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
    fetchData();
  }, [examId, authUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  const highPct = totalQuestions > 0 ? Math.round((highScore / totalQuestions) * 100) : 0;
  const lowPct = totalQuestions > 0 ? Math.round((lowScore / totalQuestions) * 100) : 0;
  const gapPct = highPct - lowPct;

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

      {/* Report Header - matching site header style */}
      <div
        className="report-header rounded-lg p-4 mb-6"
        style={{
          background: "linear-gradient(to left, hsl(145,55%,42%), hsl(199,70%,45%), hsl(35,85%,55%))",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        <div className="flex items-center justify-between">
          <img src={schoolLogo} alt="شعار المدرسة" className="w-16 h-16 rounded-full bg-white p-1 object-contain" />
          <div className="flex-1 text-center text-white">
            <h1 className="text-xl font-bold">منصة تدريب نافس</h1>
            <p className="text-sm opacity-90">المتوسطة الخامسة والستون</p>
          </div>
          <img src={nafisLogo} alt="شعار نافس" className="w-16 h-16 object-contain" />
        </div>
      </div>

      {/* Exam & Teacher Info */}
      <div className="border-2 border-gray-300 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">اسم الاختبار:</span>
            <p className="font-bold">{examName}</p>
          </div>
          <div>
            <span className="text-gray-500">المادة:</span>
            <p className="font-bold">{subject}</p>
          </div>
          <div>
            <span className="text-gray-500">المعلمة:</span>
            <p className="font-bold">{teacherName || "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">الفصول:</span>
            <p className="font-bold">
              {targetClasses.length > 0 ? targetClasses.map((c) => `فصل ${c}`).join("، ") : "—"}
            </p>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-400 text-left">
          التاريخ: {new Date().toLocaleDateString("ar-SA")}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b-2 border-gray-300 pb-2">ملخص الأداء العام</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center text-sm">
          <div className="border rounded-lg p-3">
            <p className="text-gray-500 text-xs">عدد الطالبات</p>
            <p className="font-bold text-xl">{totalStudents}</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-gray-500 text-xs">عدد الأسئلة</p>
            <p className="font-bold text-xl">{totalQuestions}</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-gray-500 text-xs">المتوسط</p>
            <p className="font-bold text-xl">{avgScore} <span className="text-xs text-gray-400">({avgPct}%)</span></p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-gray-500 text-xs">أعلى درجة</p>
            <p className="font-bold text-xl" style={{ color: "hsl(152, 60%, 40%)" }}>{highScore} <span className="text-xs">({highPct}%)</span></p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-gray-500 text-xs">أدنى درجة</p>
            <p className="font-bold text-xl" style={{ color: "hsl(0, 72%, 55%)" }}>{lowScore} <span className="text-xs">({lowPct}%)</span></p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-gray-500 text-xs">نسبة النجاح</p>
            <p className="font-bold text-xl">{successRate}%</p>
          </div>
        </div>
      </div>

      {/* Score Distribution - Table + Chart side by side */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b-2 border-gray-300 pb-2">توزيع الدرجات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Table */}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-right">الشريحة</th>
                <th className="border p-2 text-right">عدد الطالبات</th>
                <th className="border p-2 text-right">النسبة</th>
              </tr>
            </thead>
            <tbody>
              {scoreRanges.map((r) => (
                <tr key={r.label}>
                  <td className="border p-2 font-medium">
                    <span className="inline-block w-3 h-3 rounded-full ml-2" style={{ backgroundColor: r.color }} />
                    {r.label}
                  </td>
                  <td className="border p-2 text-center">{r.count}</td>
                  <td className="border p-2 text-center">{totalStudents > 0 ? Math.round((r.count / totalStudents) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Chart */}
          <div className="flex items-center justify-center" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreRanges} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`${value} طالبة`, "العدد"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {scoreRanges.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance Gap Indicator */}
      {gapPct > 40 && (
        <div
          className="mb-6 p-3 rounded-lg border-2 text-sm font-semibold text-center"
          style={{
            borderColor: "hsl(38, 90%, 50%)",
            backgroundColor: "hsl(38, 90%, 95%)",
            color: "hsl(38, 70%, 30%)",
            WebkitPrintColorAdjust: "exact",
            printColorAdjust: "exact",
          }}
        >
          ⚠ يوجد تفاوت واضح في مستوى الطالبات (فجوة {gapPct}% بين أعلى وأدنى درجة)
        </div>
      )}

      {/* Class Statistics */}
      {classStats.length > 1 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3 border-b-2 border-gray-300 pb-2">إحصاءات الفصول</h2>
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
                  <td className="border p-2 text-center">{c.count}</td>
                  <td className="border p-2 text-center">{c.avg}</td>
                  <td className="border p-2 text-center">{c.high}</td>
                  <td className="border p-2 text-center">{c.low}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Scores Table */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b-2 border-gray-300 pb-2">درجات الطالبات</h2>
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
                <td className="border p-2 text-center">{s.classNumber}</td>
                <td className="border p-2 text-center">{s.score} / {s.total}</td>
                <td className="border p-2 text-center font-semibold">{s.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t-2 border-gray-300">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>إعداد وتصميم / أ. شريفة عسيري</span>
          <span>تم إنشاء هذا التقرير من منصة نافس - {new Date().toLocaleDateString("ar-SA")}</span>
          <span>مديرة المدرسة / عفاف الحربي</span>
        </div>
      </div>
    </div>
  );
};

export default ExamReport;
