

# إزالة قيد Foreign Key من exam_questions

## المشكلة
جدول `exam_questions` يحتوي على قيد `exam_questions_question_id_fkey` مربوط بجدول `question_bank` فقط. عند إدراج سؤال نصي من `text_question_bank`، يفشل الإدراج بسبب عدم وجود الـ ID في `question_bank`.

## الحل
تعديل واحد فقط في قاعدة البيانات:

### Migration SQL
```text
ALTER TABLE public.exam_questions
DROP CONSTRAINT exam_questions_question_id_fkey;
```

هذا يزيل القيد مع الإبقاء على:
- عمود `question_id` كما هو
- عمود `source_type` للتمييز بين المصادر
- قيد `exam_questions_exam_id_fkey` (الربط بجدول exams) بدون تغيير

### التحقق في الكود
الكود الحالي في `CreateNewExam.tsx` يحدد `source_type` تلقائيا من حقل `source` في البيانات المجلوبة من `get_teacher_questions`، فلا حاجة لتعديل أي ملف.

### ملاحظة
لا يوجد تعديل على أي ملف كود - فقط تعديل على بنية قاعدة البيانات.

