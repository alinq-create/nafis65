import { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Play, CheckCircle2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

/* ─── Types ─── */

interface ParsedTextQuestion {
  subject: string;
  grade: string;
  semester: string;
  question_number: number;
  question_type: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  correct_answer_text: string;
  notes: string | null;
}

interface ImportReport {
  importedCount: number;
  skippedCount: number;
}

/* ─── Column normalisation (same pattern as ImportQuestionBank) ─── */

function normalizeColumnName(raw: any): string {
  let s = (raw ?? "").toString().trim().toLowerCase();
  s = s.replace(/_/g, " ");
  s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "");
  s = s.replace(/[أإآٱ]/g, "ا");
  s = s.replace(/[ؤ]/g, "و");
  s = s.replace(/[ئ]/g, "ي");
  s = s.replace(/[؟?]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

const COLUMN_MAP: Record<string, keyof ParsedTextQuestion> = {
  // Arabic
  "المادة": "subject",
  "الصف": "grade",
  "الفصل الدراسي": "semester",
  "رقم السوال": "question_number",
  "نوع السوال": "question_type",
  "نص السوال": "question_text",
  "خيار ا": "option_a",
  "خيار ب": "option_b",
  "خيار ج": "option_c",
  "خيار د": "option_d",
  "الخيار ا": "option_a",
  "الخيار ب": "option_b",
  "الخيار ج": "option_c",
  "الخيار د": "option_d",
  "الاجابة الصحيحة": "correct_answer",
  "نص الاجابة الصحيحة": "correct_answer_text",
  "ملاحظات": "notes",
  "تحذير": "notes",
  // English
  "subject": "subject",
  "grade": "grade",
  "term": "semester",
  "semester": "semester",
  "question number": "question_number",
  "question text": "question_text",
  "option a": "option_a",
  "option b": "option_b",
  "option c": "option_c",
  "option d": "option_d",
  "correct answer": "correct_answer",
  "correct answer text": "correct_answer_text",
  "question type": "question_type",
  "notes": "notes",
  "passage id": "notes",   // ignored for now, mapped to notes as placeholder
  "passage text": "notes", // ignored for now
};

function buildHeaderMapping(headers: string[]): Record<string, keyof ParsedTextQuestion> {
  const mapping: Record<string, keyof ParsedTextQuestion> = {};
  const mapKeys = Object.keys(COLUMN_MAP);

  for (const header of headers) {
    const normalised = normalizeColumnName(header);

    // 1. Exact match
    if (COLUMN_MAP[normalised]) {
      mapping[header] = COLUMN_MAP[normalised];
      continue;
    }

    // 2. Flexible: startsWith or includes
    let found = mapKeys.find((k) => normalised.startsWith(k) || k.startsWith(normalised));
    if (!found) {
      found = mapKeys.find((k) => normalised.includes(k) || k.includes(normalised));
    }
    if (found) {
      mapping[header] = COLUMN_MAP[found];
    }
  }

  console.log("Header mapping result:", mapping);
  return mapping;
}

/* ─── Value normalisation ─── */

/** Convert Arabic numerals to Latin */
function arabicToLatin(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Normalise grade: remove "الصف", "ال", convert Arabic numerals */
function normalizeGrade(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\bالصف\b/g, "").trim();
  s = arabicToLatin(s);
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Normalise semester: remove "الفصل", "الدراسي", convert Arabic numerals */
function normalizeSemester(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\bالفصل\b/g, "").trim();
  s = s.replace(/\bالدراسي\b/g, "").trim();
  s = arabicToLatin(s);
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Normalise answer: unify hamzas, trim, lowercase Latin */
function normalizeAnswer(raw: string): string {
  let s = raw.trim();
  s = s.replace(/[أإآٱ]/g, "ا");
  s = s.replace(/[ؤ]/g, "و");
  s = s.replace(/[ئ]/g, "ي");
  s = s.replace(/[A-Z]/g, (c) => c.toLowerCase());
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/* ─── Component ─── */

const VALID_SUBJECTS = ["علوم", "لغتي"];

const ImportTextQuestions = () => {
  const { authUser } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const fixedSubject = searchParams.get("subject");
  const isValidSubject = fixedSubject && VALID_SUBJECTS.includes(fixedSubject);

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedTextQuestion[]>([]);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importPhase, setImportPhase] = useState<"idle" | "saving">("idle");

  const excelInputRef = useRef<HTMLInputElement>(null);

  /* ─── Excel parsing ─── */

  const handleExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
      console.log("PARSED ROW SAMPLE:", rows[0]);

      if (rows.length === 0) {
        toast({ title: "الملف فارغ", description: "لا توجد بيانات في الملف", variant: "destructive" });
        return;
      }

      const excelHeaders = Object.keys(rows[0]);
      console.log("Excel headers (raw):", excelHeaders);
      console.log("Excel headers (normalized):", excelHeaders.map(normalizeColumnName));
      const headerMap = buildHeaderMapping(excelHeaders);

      const questions: ParsedTextQuestion[] = rows.map((row) => {
        const mapped: Record<string, any> = {};
        for (const [excelCol, fieldName] of Object.entries(headerMap)) {
          mapped[fieldName] = row[excelCol];
        }

        const rawGrade = mapped.grade ? String(mapped.grade).trim() : "";
        const rawSemester = mapped.semester ? String(mapped.semester).trim() : "";
        const rawAnswer = mapped.correct_answer ? String(mapped.correct_answer).trim() : "";

        return {
          subject: fixedSubject!,
          grade: normalizeGrade(rawGrade),
          semester: rawSemester ? normalizeSemester(rawSemester) : "غير محدد",
          question_number: Number(mapped.question_number) || 0,
          question_type: "اختيار متعدد",
          question_text: String(mapped.question_text || ""),
          option_a: String(mapped.option_a || ""),
          option_b: String(mapped.option_b || ""),
          option_c: String(mapped.option_c || ""),
          option_d: String(mapped.option_d || ""),
          correct_answer: normalizeAnswer(rawAnswer),
          correct_answer_text: String(mapped.correct_answer_text || ""),
          notes: mapped.notes ? String(mapped.notes) : null,
        };
      });

      setParsedQuestions(questions);
      setReport(null);

      toast({
        title: "تم قراءة الملف بنجاح",
        description: `تم العثور على ${questions.length} سؤال`,
      });
    } catch {
      toast({
        title: "خطأ في قراءة ملف الإكسل",
        description: "تأكد من صحة تنسيق الملف",
        variant: "destructive",
      });
    }
  };

  /* ─── Import ─── */

  const handleImport = async () => {
    if (!authUser || parsedQuestions.length === 0) return;

    setImporting(true);
    setImportPhase("saving");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let data: any;
      try {
        const response = await supabase.functions.invoke("import-text-questions", {
          body: { questions: parsedQuestions },
        });

        clearTimeout(timeoutId);

        if (response.error) {
          throw new Error(response.error.message || "حدث خطأ أثناء حفظ الأسئلة في قاعدة البيانات");
        }
        data = response.data;
      } catch (invokeErr: any) {
        clearTimeout(timeoutId);
        if (invokeErr?.name === "AbortError" || controller.signal.aborted) {
          throw new Error("تعذر الاستيراد، حاول مرة أخرى");
        }
        throw new Error(invokeErr?.message || "حدث خطأ أثناء حفظ الأسئلة في قاعدة البيانات");
      }

      const importReport: ImportReport = {
        importedCount: data?.importedCount || 0,
        skippedCount: data?.skippedCount || 0,
      };

      setReport(importReport);

      toast({
        title: "تم الاستيراد بنجاح",
        description: `${importReport.importedCount} سؤال جديد${importReport.skippedCount > 0 ? `، ${importReport.skippedCount} مكرر تم تخطيه` : ""}`,
      });
    } catch (err: any) {
      const message = err?.message || "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى";
      toast({
        title: "خطأ في الاستيراد",
        description: message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setImportPhase("idle");
    }
  };

  /* ─── Reset ─── */

  const handleReset = () => {
    setExcelFile(null);
    setParsedQuestions([]);
    setReport(null);
    setImportPhase("idle");
    if (excelInputRef.current) excelInputRef.current.value = "";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">
            {isValidSubject ? `استيراد أسئلة ${fixedSubject}` : "استيراد الأسئلة النصية"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isValidSubject
              ? `رفع ملف إكسل لاستيراد أسئلة اختيار من متعدد لمادة ${fixedSubject}`
              : "يرجى الوصول من لوحة مديرة النظام"}
          </p>
        </div>

        {!isValidSubject && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              لم يتم تحديد المادة. يرجى العودة إلى لوحة مديرة النظام واختيار المادة المطلوبة.
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Section */}
        {isValidSubject && !report && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                ملف الإكسل
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleExcelSelect}
              />
              <Button
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => excelInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6" />
                  <span>{excelFile ? excelFile.name : "اختر ملف الإكسل"}</span>
                </div>
              </Button>
              {parsedQuestions.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  تم قراءة {parsedQuestions.length} سؤال
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {parsedQuestions.length > 0 && !report && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle>معاينة الأسئلة ({parsedQuestions.length} سؤال)</CardTitle>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent ml-2" />
                    {importPhase === "saving" ? "جاري حفظ الأسئلة..." : "جاري الاستيراد..."}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 ml-2" />
                    بدء الاستيراد
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم السؤال</TableHead>
                      <TableHead className="text-right">نص السؤال</TableHead>
                      <TableHead className="text-right">الإجابة الصحيحة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedQuestions.map((q, i) => (
                      <TableRow key={i}>
                        <TableCell>{q.question_number}</TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {q.question_text.length > 50
                            ? q.question_text.substring(0, 50) + "..."
                            : q.question_text}
                        </TableCell>
                        <TableCell>{q.correct_answer}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                تقرير الاستيراد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{report.importedCount}</p>
                  <p className="text-sm text-green-600 dark:text-green-500">سؤال تم استيراده</p>
                </div>
                <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 text-center">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{report.skippedCount}</p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">سؤال مكرر (تم تخطيه)</p>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4" onClick={handleReset}>
                استيراد ملف آخر
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ImportTextQuestions;
