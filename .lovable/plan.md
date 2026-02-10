

# تحسين شاشة مراجعة المحاولات مع Edge Function مخصصة

## الوضع الحالي
الكود الحالي في `ReviewAttempts.tsx` يجلب البيانات من الجهة الأمامية (Frontend) عبر استعلامات متعددة، لكنه لا يعرض خيارات الأسئلة أو صور الأسئلة المصورة بشكل كامل.

## التعديلات المطلوبة

### 1. انشاء Edge Function جديدة: `get-attempt-review`
ملف: `supabase/functions/get-attempt-review/index.ts`

المنطق:
- تستقبل `attempt_id`
- تجلب بيانات المحاولة من `student_attempts`
- تجلب أسئلة الاختبار من `exam_questions` مع `source_type` و `question_order`
- تقسم الأسئلة حسب المصدر:
  - `image` من `question_bank` (مع `page_image_name`, `frame_top`, `frame_left`, `frame_width`, `frame_height`, `correct_answer`)
  - `text` من `text_question_bank` (مع `question_text`, `option_a..d`, `correct_answer`)
- تجلب إجابات الطالبة من `student_answers`
- تدمج كل شيء في كائن واحد لكل سؤال مرتب حسب `question_order`
- ترجع البيانات كاملة

اضافة للملف `supabase/config.toml`:
```toml
[functions.get-attempt-review]
verify_jwt = false
```

### 2. تعديل `src/pages/teacher/ReviewAttempts.tsx`
- استبدال استعلامات `handleViewAttempt` المتعددة باستدعاء واحد للـ Edge Function
- تحديث واجهة العرض لتشمل:
  - للأسئلة النصية: نص السؤال + الخيارات الأربعة مع تمييز إجابة الطالبة والإجابة الصحيحة بالألوان
  - للأسئلة المصورة: عرض صورة السؤال المقصوصة من الـ Storage
  - الدرجة التلقائية لكل سؤال
  - ملخص الدرجات في الأسفل مع حقل التعديل وزر الاعتماد

## الملفات المتأثرة
- `supabase/functions/get-attempt-review/index.ts` (جديد)
- `supabase/config.toml` (اضافة تكوين الدالة)
- `src/pages/teacher/ReviewAttempts.tsx` (تعديل جلب البيانات وعرضها)

## التفاصيل التقنية

### بنية الاستجابة من Edge Function
```text
{
  attempt: { id, student_name, class_number, auto_score, status, ... },
  questions: [
    {
      question_id, source_type, question_order, question_type,
      question_text (نصي), page_image_name (صوري),
      frame_top, frame_left, frame_width, frame_height,
      options: { a, b, c, d },
      correct_answer,
      student_answer,
      auto_correct
    }
  ],
  total_questions: number
}
```

### عرض السؤال في الواجهة
- كل سؤال يعرض في بطاقة (Card) منفصلة بدل صفوف الجدول
- الأسئلة النصية: نص السؤال + 4 خيارات (أخضر للصحيحة، أحمر لإجابة الطالبة الخاطئة)
- الأسئلة المصورة: صورة مقصوصة من Storage bucket `question-images`
- شريط ملخص في الأسفل: الدرجة الآلية / العدد الكلي + حقل تعديل + زر اعتماد

