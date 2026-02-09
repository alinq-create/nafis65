
# توحيد بنك الأسئلة للمعلمات (صورية + نصية)

## المشكلة
المعلمة ترى فقط 16 سؤال صوري من جدول `question_bank`، بينما يوجد 95 سؤال نصي في `text_question_bank` لا تظهر لها.

## الحل

### 1. إنشاء VIEW في قاعدة البيانات
إنشاء view باسم `teacher_question_bank_view` يدمج البيانات من الجدولين بأعمدة موحدة:

```
question_bank (16 سؤال)
        +
text_question_bank (95 سؤال)
        =
teacher_question_bank_view (111 سؤال موحد)
```

الأعمدة الموحدة:
- `id`, `source` (لتمييز المصدر داخلياً)
- `subject`, `grade`, `semester`, `question_number`
- `question_type`, `question_text`, `correct_answer`
- `option_a/b/c/d` (للأسئلة النصية)
- `page_image_name`, `teacher_id`, `frame_top/left/width/height` (للأسئلة الصورية)
- `visible_to_students`, `notes`, `created_at`

للأسئلة الصورية: `question_text = NULL`، بيانات الصورة والإطار موجودة
للأسئلة النصية: بيانات الصورة = `NULL`، `question_text` موجود

### 2. تحديث صفحة بنك الأسئلة للمعلمة
تعديل `src/pages/teacher/QuestionBank.tsx`:
- الاستعلام من الـ VIEW بدلاً من `question_bank` مباشرة (باستخدام `supabase.rpc` أو استعلام مباشر)
- عرض نص السؤال (`question_text`) عندما لا توجد صورة
- عرض معاينة الصورة عندما تكون موجودة
- إبقاء التصميم الحالي كما هو بدون تبويبات أو تصنيفات جديدة

### 3. ملاحظات
- لن يتم تعديل صفحات الاستيراد
- لن يتم إعادة استيراد بيانات
- الحل يعمل تلقائياً لجميع المواد

## التفاصيل التقنية

**Migration SQL:**
- إنشاء VIEW باسم `teacher_question_bank_view` باستخدام `UNION ALL`
- لأن Supabase JS client لا يدعم الاستعلام من views مباشرة إلا إذا كانت مسجلة، سيتم إنشاء دالة RPC `get_teacher_questions(p_subject text)` تستعلم من الـ VIEW وتعيد النتائج مرتبة

**تعديل QuestionBank.tsx:**
- تعريف نوع `UnifiedQuestion` محلي بدلاً من `Tables<"question_bank">`
- استدعاء `supabase.rpc('get_teacher_questions', { p_subject: teacherSubject })`
- في عمود المعاينة: إذا `page_image_name` موجود يعرض الصورة المقصوصة، وإلا يعرض `question_text`
- تبديل الإظهار/الإخفاء يستخدم `source` لمعرفة أي جدول يُحدَّث
