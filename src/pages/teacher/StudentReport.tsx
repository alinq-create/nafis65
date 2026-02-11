import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, ArrowRight } from "lucide-react";
import schoolLogo from "@/assets/school-logo.png";

interface AttemptData {
  id: string;
  exam_id: string;
  approved_score: number | null;
  submission_time: string;
  exam_name: string;
}

interface AnswerData {
  question_id: string;
  student_answer: string | null;
  auto_correct: boolean | null;
  question_type: string;
}

const StudentReport = () => {
  const { name, class: classNumber } = useParams<{ name: string; class: string }>();
  const { authUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptData[]>([]);
  const [answers, setAnswers] = useState<AnswerData[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});

  const studentName = decodeURIComponent(name || "");
  const classNum = Number(classNumber);

  useEffect(() => {
    const fetchData = async () => {
      if (!authUser?.user || !studentName || !classNum) return;
      setLoading(true);

      const { data: exams } = await supabase
        .from("exams")
        .select("id, exam_name")
        .eq("teacher_id", authUser.user.id);

      if (!exams?.length) { setLoading(false); return; }

      const examIds = exams.map((e) => e.id);
      const examNameMap: Record<string, string> = {};
      exams.forEach((e) => { examNameMap[e.id] = e.exam_name; });

      const { data: attemptsData } = await supabase
        .from("student_attempts")
        .select("id, exam_id, approved_score, submission_time")
        .in("exam_id", examIds)
        .eq("student_name", studentName)
        .eq("class_number", classNum)
        .eq("status", "معتمد")
        .order("submission_time", { ascending: true });

      if (!attemptsData?.length) { setAttempts([]); setLoading(false); return; }

      setAttempts(attemptsData.map((a) => ({ ...a, exam_name: examNameMap[a.exam_id] || "اختبار" })));

      const { data: eqData } = await supabase
        .from("exam_questions")
        .select("exam_id, question_id, source_type")
        .in("exam_id", examIds);

      const qCountMap: Record<string, number> = {};
      eqData?.forEach((eq) => { qCountMap[eq.exam_id] = (qCountMap[eq.exam_id] || 0) + 1; });
      setQuestionCounts(qCountMap);

      const imageQIds = eqData?.filter((eq) => eq.source_type === "image").map((eq) => eq.question_id) || [];
      const textQIds = eqData?.filter((eq) => eq.source_type === "text").map((eq) => eq.question_id) || [];
      const typeMap: Record<string, string> = {};

      if (imageQIds.length > 0) {
        const { data: imgQ } = await supabase.from("question_bank").select("id, question_type").in("id", imageQIds);
        imgQ?.forEach((q) => { typeMap[q.id] = q.question_type; });
      }
      if (textQIds.length > 0) {
        const { data: txtQ } = await supabase.from("text_question_bank").select("id, question_type").in("id", textQIds);
        txtQ?.forEach((q) => { typeMap[q.id] = q.question_type; });
      }

      const attemptIds = attemptsData.map((a) => a.id);
      const { data: answersData } = await supabase
        .from("student_answers")
        .select("question_id, student_answer, auto_correct")
        .in("attempt_id", attemptIds);

      setAnswers((answersData || []).map((a) => ({
        ...a,
        question_type: typeMap[a.question_id] || "اختيار متعدد",
      })));
      setLoading(false);
    };
    fetchData();
  }, [authUser, studentName, classNum]);

  const totalExams = attempts.length;

  const avgScore = useMemo(() => {
    if (!attempts.length) return 0;
    const scores = attempts.map((a) => {
      const total = questionCounts[a.exam_id] || 1;
      return ((a.approved_score || 0) / total) * 100;
    });
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [attempts, questionCounts]);

  const correctPct = useMemo(() => {
    if (!answers.length) return 0;
    return Math.round((answers.filter((a) => a.auto_correct === true).length / answers.length) * 100);
  }, [answers]);

  const unansweredPct = useMemo(() => {
    if (!answers.length) return 0;
    return Math.round((answers.filter((a) => !a.student_answer || a.student_answer.trim() === "").length / answers.length) * 100);
  }, [answers]);

  const level = avgScore >= 80 ? "ممتاز" : avgScore >= 60 ? "جيد" : "يحتاج دعم";

  const trend = useMemo(() => {
    if (attempts.length < 2) return "مستقر";
    const scores = attempts.map((a) => ((a.approved_score || 0) / (questionCounts[a.exam_id] || 1)) * 100);
    const half = Math.ceil(scores.length / 2);
    const avgFirst = scores.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const avgLast = scores.slice(-half).reduce((a, b) => a + b, 0) / half;
    if (avgLast - avgFirst > 5) return "تحسن";
    if (avgFirst - avgLast > 5) return "تراجع";
    return "مستقر";
  }, [attempts, questionCounts]);

  const typeAnalysis = useMemo(() => {
    const map = new Map<string, { correct: number; total: number; unanswered: number }>();
    answers.forEach((a) => {
      if (!map.has(a.question_type)) map.set(a.question_type, { correct: 0, total: 0, unanswered: 0 });
      const entry = map.get(a.question_type)!;
      entry.total++;
      if (a.auto_correct === true) entry.correct++;
      if (!a.student_answer || a.student_answer.trim() === "") entry.unanswered++;
    });
    const strengths: { type: string; pct: number }[] = [];
    const weaknesses: { type: string; pct: number }[] = [];
    map.forEach((val, type) => {
      const pct = Math.round((val.correct / val.total) * 100);
      if (pct >= 70) strengths.push({ type, pct });
      if (pct < 50) weaknesses.push({ type, pct });
    });
    return { strengths, weaknesses };
  }, [answers]);

  const recommendations = useMemo(() => {
    const recs: string[] = [];
    if (unansweredPct > 30) recs.push("تحتاج الطالبة لتشجيع على محاولة جميع الأسئلة");
    typeAnalysis.weaknesses.forEach((w) => recs.push(`تحتاج دعم في أسئلة ${w.type}`));
    if (trend === "تحسن") recs.push("تظهر الطالبة تحسناً ملحوظاً في الاختبارات الأخيرة");
    if (level === "ممتاز") recs.push("أداء متميز - يمكن تكليفها بمهام إثرائية");
    if (trend === "تراجع") recs.push("يُلاحظ تراجع في الأداء الأخير - قد تحتاج متابعة");
    if (recs.length === 0) recs.push("أداء مستقر - يُنصح بمتابعة مستمرة");
    return recs;
  }, [unansweredPct, typeAnalysis, trend, level]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-8" dir="rtl" style={{ fontFamily: "'Noto Sans Arabic', sans-serif" }}>
      {/* Action buttons */}
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

      {/* Header with Logo */}
      <div className="report-header flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-6">
        <img src={schoolLogo} alt="شعار المدرسة" className="w-20 h-20 object-contain" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold">منصة نافس - تقرير الطالبة</h1>
          <p className="text-lg font-semibold mt-1">{studentName} - فصل {classNum}</p>
          <p className="text-sm text-gray-600 mt-1">التاريخ: {new Date().toLocaleDateString("ar-SA")}</p>
        </div>
        <div className="w-20" />
      </div>

      {/* Student Summary */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b pb-2">ملخص الأداء</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">عدد الاختبارات</p>
            <p className="font-bold text-lg">{totalExams}</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">المتوسط العام</p>
            <p className="font-bold text-lg">{avgScore}%</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">الإجابات الصحيحة</p>
            <p className="font-bold text-lg">{correctPct}%</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">المستوى</p>
            <p className="font-bold text-lg">{level}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center mt-3">
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">الاتجاه</p>
            <p className="font-bold">{trend}</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">غير مجابة</p>
            <p className="font-bold">{unansweredPct}%</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-sm text-gray-600">الإجابات الخاطئة</p>
            <p className="font-bold">{100 - correctPct - unansweredPct}%</p>
          </div>
        </div>
      </div>

      {/* Exam History */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b pb-2">سجل الاختبارات</h2>
        {attempts.length === 0 ? (
          <p className="text-gray-500 text-center py-4">لا توجد اختبارات معتمدة</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-right">الاختبار</th>
                <th className="border p-2 text-right">التاريخ</th>
                <th className="border p-2 text-right">الدرجة</th>
                <th className="border p-2 text-right">النسبة</th>
              </tr>
            </thead>
            <tbody>
              {[...attempts].reverse().map((a, i) => {
                const total = questionCounts[a.exam_id] || 1;
                const pct = Math.round(((a.approved_score || 0) / total) * 100);
                return (
                  <tr key={a.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border p-2 font-medium">{a.exam_name}</td>
                    <td className="border p-2">{new Date(a.submission_time).toLocaleDateString("ar-SA")}</td>
                    <td className="border p-2">{a.approved_score || 0} / {total}</td>
                    <td className="border p-2 font-semibold">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold mb-3 border-b pb-2">نقاط القوة</h2>
          {typeAnalysis.strengths.length === 0 ? (
            <p className="text-gray-500 text-sm">لا توجد بيانات كافية</p>
          ) : (
            <ul className="space-y-2">
              {typeAnalysis.strengths.map((s) => (
                <li key={s.type} className="border rounded p-2 bg-green-50 flex justify-between">
                  <span>{s.type}</span>
                  <span className="font-bold text-green-700">{s.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-lg font-bold mb-3 border-b pb-2">نقاط الضعف</h2>
          {typeAnalysis.weaknesses.length === 0 ? (
            <p className="text-gray-500 text-sm">لا توجد نقاط ضعف واضحة</p>
          ) : (
            <ul className="space-y-2">
              {typeAnalysis.weaknesses.map((w) => (
                <li key={w.type} className="border rounded p-2 bg-red-50 flex justify-between">
                  <span>{w.type}</span>
                  <span className="font-bold text-red-700">{w.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-3 border-b pb-2">التوصيات</h2>
        <ul className="space-y-2">
          {recommendations.map((rec, i) => (
            <li key={i} className="border rounded p-3 bg-blue-50 text-sm">• {rec}</li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
        <p>تم إنشاء هذا التقرير من منصة نافس - {new Date().toLocaleDateString("ar-SA")}</p>
      </div>
    </div>
  );
};

export default StudentReport;
