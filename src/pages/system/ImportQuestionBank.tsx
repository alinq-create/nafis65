import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, ImageIcon, Play, CheckCircle2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

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
  notes: string | null;
}

interface ImportReport {
  importedCount: number;
  uploadedImages: number;
  missingImages: string[];
}

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

  const excelInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const handleExcelSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);

      const questions: ParsedQuestion[] = rows.map((row: any) => ({
        page_number: Number(row["رقم_الصفحة"]) || 0,
        question_number: Number(row["رقم_السؤال"]) || 0,
        question_type: row["نوع_السؤال"] || "اختيار متعدد",
        page_image_name: String(row["اسم_صورة_الصفحة"] || "").trim(),
        frame_top: Number(row["إطار_أعلى"]) || 0,
        frame_left: Number(row["إطار_يسار"]) || 0,
        frame_width: Number(row["عرض_الإطار"]) || 1,
        frame_height: Number(row["ارتفاع_الإطار"]) || 1,
        correct_answer: String(row["الإجابة_الصحيحة"] || ""),
        notes: row["ملاحظات"] ? String(row["ملاحظات"]) : null,
      }));

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

  const handleImagesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImageFiles(files);
    toast({
      title: "تم اختيار الصور",
      description: `${files.length} صورة`,
    });
  };

  const handleImport = async () => {
    if (!authUser || parsedQuestions.length === 0) return;

    setImporting(true);
    const missingImages: string[] = [];
    let uploadedImages = 0;

    try {
      // 1. Upload images to storage
      const imageFileMap = new Map(imageFiles.map((f) => [f.name, f]));
      const uniqueImageNames = [...new Set(parsedQuestions.map((q) => q.page_image_name))];

      for (const imageName of uniqueImageNames) {
        const imageFile = imageFileMap.get(imageName);
        if (!imageFile) {
          missingImages.push(imageName);
          continue;
        }

        const { error } = await supabase.storage
          .from("question-images")
          .upload(`shared/${imageName}`, imageFile, { upsert: true });

        if (error) {
          console.error(`فشل رفع ${imageName}:`, error.message);
          missingImages.push(imageName);
        } else {
          uploadedImages++;
        }
      }

      // 2. Import questions via edge function
      const { data, error } = await supabase.functions.invoke("import-question-bank", {
        body: {
          questions: parsedQuestions,
          subject: "رياضيات",
        },
      });

      if (error) throw error;

      const importReport: ImportReport = {
        importedCount: data?.importedCount || 0,
        uploadedImages,
        missingImages,
      };

      setReport(importReport);

      // 3. Build preview image URLs
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
        description: `${importReport.importedCount} سؤال، ${uploadedImages} صورة`,
      });
    } catch (err: any) {
      toast({
        title: "خطأ في الاستيراد",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
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
        {parsedQuestions.length > 0 && !report && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>معاينة البيانات المقروءة ({parsedQuestions.length} سؤال)</CardTitle>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent ml-2" />
                    جاري الاستيراد...
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الصفحة</TableHead>
                      <TableHead className="text-right">رقم السؤال</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">اسم الصورة</TableHead>
                      <TableHead className="text-right">الإجابة</TableHead>
                      <TableHead className="text-right">إطار (أعلى، يسار، عرض، ارتفاع)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedQuestions.slice(0, 20).map((q, i) => (
                      <TableRow key={i}>
                        <TableCell>{q.page_number}</TableCell>
                        <TableCell>{q.question_number}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{q.question_type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {q.page_image_name}
                        </TableCell>
                        <TableCell className="font-medium">{q.correct_answer}</TableCell>
                        <TableCell className="text-xs">
                          {q.frame_top.toFixed(2)}, {q.frame_left.toFixed(2)},{" "}
                          {q.frame_width.toFixed(2)}, {q.frame_height.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedQuestions.length > 20 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    ... و {parsedQuestions.length - 20} سؤال آخر
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    {parsedQuestions.map((q, i) => {
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
