import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, ImageIcon, Play, CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import * as XLSX from "xlsx";

/* ─── Types ─── */

interface ParsedQuestion {
  page_number: number;
  question_number: number;
  question_type: string;
  page_image_name: string;
  frame_top: number;
  frame_left: number;
  frame_width: number;
  frame_height: number;
  correct_answer: string;
  visible_to_students: boolean;
  notes: string | null;
  subject: string;
  image_missing?: boolean;
}

interface ImportReport {
  importedCount: number;
  skippedCount: number;
  uploadedImages: number;
  missingImages: string[];
}

/* ─── Column normalisation helpers ─── */

/** Normalise Arabic column name: strip diacritics, unify hamza, replace _ with space, remove ?, trim */
function normalizeColumnName(raw: string): string {
  let s = raw.trim();
  // Replace underscores with spaces
  s = s.replace(/_/g, " ");
  // Remove Arabic diacritics (tashkeel)
  s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g, "");
  // Unify hamza forms to bare alef / ya / waw
  s = s.replace(/[أإآٱ]/g, "ا");
  s = s.replace(/[ؤ]/g, "و");
  s = s.replace(/[ئ]/g, "ي");
  // Remove question marks (Arabic & Latin)
  s = s.replace(/[؟?]/g, "");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Known column mapping: normalised Arabic name → internal field */
const COLUMN_MAP: Record<string, keyof ParsedQuestion> = {
  "رقم الصفحة": "page_number",
  "رقم السوال": "question_number",
  "نوع السوال": "question_type",
  "اسم صورة الصفحة الكاملة": "page_image_name",
  "اعلى الاطار": "frame_top",
  "يسار الاطار": "frame_left",
  "عرض الاطار": "frame_width",
  "ارتفاع الاطار": "frame_height",
  "الاجابة الصحيحة": "correct_answer",
  "يظهر للطالبات": "visible_to_students",
  "ملاحظات": "notes",
  "المادة": "subject",
};

/** Build a dynamic mapping from actual Excel header names to internal field names */
function buildHeaderMapping(headers: string[]): Record<string, keyof ParsedQuestion> {
  const mapping: Record<string, keyof ParsedQuestion> = {};
  for (const header of headers) {
    const normalised = normalizeColumnName(header);
    if (COLUMN_MAP[normalised]) {
      mapping[header] = COLUMN_MAP[normalised];
    }
  }
  return mapping;
}

/** Convert question type: "اختيار من متعدد" → "اختيار متعدد", anything else → "إدخال" */
function convertQuestionType(raw: string | undefined): string {
  if (!raw) return "اختيار متعدد";
  const normalised = normalizeColumnName(raw);
  if (normalised.includes("اختيار") && normalised.includes("متعدد")) {
    return "اختيار متعدد";
  }
  return "إدخال";
}

/** Convert visible to students: نعم/true/1 → true, anything else → false. Default true. */
function convertVisibility(raw: any): boolean {
  if (raw === undefined || raw === null || raw === "") return true;
  const s = String(raw).trim().toLowerCase();
  if (["نعم", "true", "1"].includes(s)) return true;
  if (["لا", "false", "0"].includes(s)) return false;
  return true;
}

/* ─── Component ─── */

const ImportQuestionBank = () => {
  const { authUser } = useAuth();
  const { toast } = useToast();

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [importPhase, setImportPhase] = useState<"idle" | "uploading" | "saving">("idle");

  const excelInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  /** Set of uploaded image file names for quick lookup */
  const uploadedImageNames = useMemo(
    () => new Set(imageFiles.map((f) => f.name)),
    [imageFiles]
  );

  /** Count of questions with missing images */
  const missingImageCount = useMemo(
    () => parsedQuestions.filter((q) => q.image_missing).length,
    [parsedQuestions]
  );

  /** Re-check image_missing flags whenever imageFiles or parsedQuestions change */
  const questionsWithImageCheck = useMemo(() => {
    if (parsedQuestions.length === 0) return parsedQuestions;
    return parsedQuestions.map((q) => ({
      ...q,
      image_missing: q.page_image_name ? !uploadedImageNames.has(q.page_image_name) : true,
    }));
  }, [parsedQuestions, uploadedImageNames]);

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

      if (rows.length === 0) {
        toast({ title: "الملف فارغ", description: "لا توجد بيانات في الملف", variant: "destructive" });
        return;
      }

      // Build dynamic header mapping from actual Excel headers
      const excelHeaders = Object.keys(rows[0]);
      const headerMap = buildHeaderMapping(excelHeaders);

      const questions: ParsedQuestion[] = rows.map((row) => {
        // Build a mapped row using the dynamic header mapping
        const mapped: Record<string, any> = {};
        for (const [excelCol, fieldName] of Object.entries(headerMap)) {
          mapped[fieldName] = row[excelCol];
        }

        return {
          page_number: Number(mapped.page_number) || 0,
          question_number: Number(mapped.question_number) || 0,
          question_type: convertQuestionType(mapped.question_type as string),
          page_image_name: String(mapped.page_image_name || "").trim(),
          frame_top: Number(mapped.frame_top) || 0,
          frame_left: Number(mapped.frame_left) || 0,
          frame_width: Number(mapped.frame_width) || 0,
          frame_height: Number(mapped.frame_height) || 0,
          correct_answer: String(mapped.correct_answer ?? ""),
          visible_to_students: convertVisibility(mapped.visible_to_students),
          notes: mapped.notes ? String(mapped.notes) : null,
          subject: mapped.subject ? String(mapped.subject).trim() : "رياضيات",
          image_missing: false, // will be recalculated via useMemo
        };
      });

      setParsedQuestions(questions);
      setReport(null);
      setPreviewMode(false);

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

  /* ─── Image selection ─── */

  const handleImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImageFiles(files);
    toast({
      title: "تم اختيار الصور",
      description: `${files.length} صورة`,
    });
  };

  /* ─── Import ─── */

  const handleImport = async () => {
    if (!authUser || questionsWithImageCheck.length === 0) return;

    setImporting(true);
    setImportPhase("uploading");
    setUploadProgress(null);

    try {
      // 1. Upload images using Promise.allSettled
      const imageFileMap = new Map(imageFiles.map((f) => [f.name, f]));
      const uniqueImageNames = [...new Set(questionsWithImageCheck.map((q) => q.page_image_name).filter(Boolean))];

      const missingImages: string[] = [];
      let uploadedImages = 0;

      // Separate missing (no file selected) vs files to upload
      const filesToUpload: { name: string; file: File }[] = [];
      for (const imageName of uniqueImageNames) {
        const imageFile = imageFileMap.get(imageName);
        if (!imageFile) {
          missingImages.push(imageName);
        } else {
          filesToUpload.push({ name: imageName, file: imageFile });
        }
      }

      if (filesToUpload.length > 0) {
        setUploadProgress({ current: 0, total: filesToUpload.length });

        const uploadPromises = filesToUpload.map(async ({ name, file }) => {
          const { error } = await supabase.storage
            .from("question-images")
            .upload(`shared/${name}`, file, { upsert: true });
          if (error) throw new Error(name);
          return name;
        });

        const results = await Promise.allSettled(uploadPromises);
        const failedUploads: string[] = [];
        let completed = 0;

        for (const result of results) {
          completed++;
          setUploadProgress({ current: completed, total: filesToUpload.length });
          if (result.status === "fulfilled") {
            uploadedImages++;
          } else {
            const failedName = result.reason?.message || "غير معروف";
            failedUploads.push(failedName);
          }
        }

        if (failedUploads.length > 0) {
          toast({
            title: "تحذير: فشل رفع بعض الصور",
            description: `فشل رفع الصور التالية: ${failedUploads.join("، ")}`,
            variant: "destructive",
          });
        }
      }

      // 2. Import questions via edge function with 60s timeout
      setImportPhase("saving");
      setUploadProgress(null);

      const questionsPayload = questionsWithImageCheck.map(
        ({ image_missing, ...rest }) => rest
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let data: any;
      try {
        const response = await supabase.functions.invoke("import-question-bank", {
          body: { questions: questionsPayload },
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

      // 3. Build report
      const importReport: ImportReport = {
        importedCount: data?.importedCount || 0,
        skippedCount: data?.skippedCount || 0,
        uploadedImages,
        missingImages,
      };

      setReport(importReport);

      // 4. Build preview image URLs
      const urls: Record<string, string> = {};
      for (const imageName of uniqueImageNames) {
        if (!missingImages.includes(imageName)) {
          const { data: urlData } = supabase.storage
            .from("question-images")
            .getPublicUrl(`shared/${imageName}`);
          urls[imageName] = urlData.publicUrl;
        }
      }
      setImageUrls(urls);
      setPreviewMode(true);

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
      setUploadProgress(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">استيراد بنك الأسئلة (رياضيات)</h2>
          <p className="text-muted-foreground mt-1">
            رفع ملف إكسل وصور الصفحات لإضافة الأسئلة للنظام
          </p>
        </div>

        {/* Upload Section */}
        {!report && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Excel Upload */}
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

            {/* Images Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  صور الصفحات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  ref={imagesInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  className="hidden"
                  onChange={handleImagesSelect}
                />
                <Button
                  variant="outline"
                  className="w-full h-24 border-dashed"
                  onClick={() => imagesInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6" />
                    <span>
                      {imageFiles.length > 0
                        ? `${imageFiles.length} صورة مختارة`
                        : "اختر صور الصفحات (PNG)"}
                    </span>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Preview parsed data before import */}
        {questionsWithImageCheck.length > 0 && !report && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle>معاينة البيانات المقروءة ({questionsWithImageCheck.length} سؤال)</CardTitle>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent ml-2" />
                    {importPhase === "uploading" && uploadProgress
                      ? `جاري رفع الصور... (تم رفع ${uploadProgress.current} من ${uploadProgress.total})`
                      : importPhase === "saving"
                        ? "جاري حفظ الأسئلة..."
                        : "جاري الاستيراد..."}
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
              {/* Missing images warning */}
              {missingImageCount > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
                  <span className="text-sm font-medium">
                    {missingImageCount} صورة مفقودة من بين الصور المرفوعة — سيتم تمييزها بالتحذير أدناه
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الصفحة</TableHead>
                      <TableHead className="text-right">رقم السؤال</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">اسم الصورة</TableHead>
                      <TableHead className="text-right">الإطار (أعلى، يسار، عرض، ارتفاع)</TableHead>
                      <TableHead className="text-right">الإجابة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questionsWithImageCheck.slice(0, 30).map((q, i) => (
                      <TableRow key={i}>
                        <TableCell>{q.page_number}</TableCell>
                        <TableCell>{q.question_number}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{q.question_type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          <div className="flex items-center gap-1">
                            {q.image_missing && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                            )}
                            <span>{q.page_image_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono" dir="ltr">
                          {q.frame_top.toFixed(3)}, {q.frame_left.toFixed(3)},{" "}
                          {q.frame_width.toFixed(3)}, {q.frame_height.toFixed(3)}
                        </TableCell>
                        <TableCell className="font-medium">{q.correct_answer}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {questionsWithImageCheck.length > 30 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    ... و {questionsWithImageCheck.length - 30} سؤال آخر
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Report */}
        {report && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  تقرير الاستيراد
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                    <p className="text-sm text-muted-foreground">الأسئلة المستوردة</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {report.importedCount}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-muted-foreground">الصور المرفوعة</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                      {report.uploadedImages}
                    </p>
                  </div>
                  {report.skippedCount > 0 && (
                    <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Ban className="h-4 w-4" />
                        أسئلة مكررة (تم تخطيها)
                      </p>
                      <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                        {report.skippedCount}
                      </p>
                    </div>
                  )}
                  {report.missingImages.length > 0 && (
                    <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                      <p className="text-sm text-muted-foreground">صور مفقودة</p>
                      <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                        {report.missingImages.length}
                      </p>
                    </div>
                  )}
                </div>

                {report.missingImages.length > 0 && (
                  <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                    <p className="font-medium flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      صور لم يُعثر عليها:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {report.missingImages.map((name, i) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Question Preview with cropped images */}
            {previewMode && (
              <Card>
                <CardHeader>
                  <CardTitle>معاينة الأسئلة المستوردة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {questionsWithImageCheck.slice(0, 30).map((q, i) => {
                      const imgUrl = imageUrls[q.page_image_name];
                      return (
                        <div
                          key={i}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              ص{q.page_number} - س{q.question_number}
                            </span>
                            <Badge variant="secondary">{q.question_type}</Badge>
                          </div>
                          {imgUrl ? (
                            <div
                              className="w-full h-32 bg-muted rounded overflow-hidden"
                              style={{
                                backgroundImage: `url(${imgUrl})`,
                                backgroundSize: `${100 / q.frame_width}% ${100 / q.frame_height}%`,
                                backgroundPosition: `${(q.frame_left / (1 - q.frame_width)) * 100}% ${(q.frame_top / (1 - q.frame_height)) * 100}%`,
                                backgroundRepeat: "no-repeat",
                              }}
                            />
                          ) : (
                            <div className="w-full h-32 bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
                              صورة مفقودة
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            الإجابة: <span className="font-bold">{q.correct_answer}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ImportQuestionBank;
