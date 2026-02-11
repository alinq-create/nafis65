import * as XLSX from "xlsx";

interface ExamSummaryRow {
  "اسم الاختبار": string;
  "المادة": string;
  "عدد الطالبات": number;
  "متوسط الدرجات": number;
  "أعلى درجة": number;
  "أدنى درجة": number;
  "نسبة النجاح": string;
}

interface StudentPerformanceRow {
  "الطالبة": string;
  "الفصل": number;
  "الاختبار": string;
  "المادة": string;
  "الدرجة": number;
  "من": number;
  "النسبة": string;
}

interface QuestionStatsRow {
  "الاختبار": string;
  "رقم السؤال": number;
  "نوع السؤال": string;
  "نسبة الصواب": string;
  "نسبة الخطأ": string;
  "التصنيف": string;
}

interface ExportData {
  examSummary: ExamSummaryRow[];
  studentPerformance: StudentPerformanceRow[];
  questionStats: QuestionStatsRow[];
}

export function exportExcelReport(data: ExportData, fileName?: string) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Exam Summary
  const ws1 = XLSX.utils.json_to_sheet(data.examSummary);
  ws1["!cols"] = [
    { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "ملخص الاختبارات");

  // Sheet 2: Student Performance
  const ws2 = XLSX.utils.json_to_sheet(data.studentPerformance);
  ws2["!cols"] = [
    { wch: 25 }, { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "أداء الطالبات");

  // Sheet 3: Question Stats
  const ws3 = XLSX.utils.json_to_sheet(data.questionStats);
  ws3["!cols"] = [
    { wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, "إحصاءات الأسئلة");

  const name = fileName || `تقرير_نافس_${new Date().toLocaleDateString("ar-SA").replace(/\//g, "-")}`;
  XLSX.writeFile(wb, `${name}.xlsx`);
}
