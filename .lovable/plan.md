

# اصلاح دالة student-exam-access لدعم الاسئلة النصية

## المشكلة
دالة `student-exam-access` تجلب الاسئلة من جدول `question_bank` فقط. عندما يحتوي الاختبار على اسئلة نصية (من `text_question_bank`)، لا يتم العثور عليها فتظهر فارغة كما في الصورة.

## الحل
تعديل دالة `student-exam-access` لتقرا عمود `source_type` من `exam_questions` ثم تجلب الاسئلة من الجدول المناسب:

### تعديل `supabase/functions/student-exam-access/index.ts`

في الموضعين اللذين يتم فيهما جلب الاسئلة (سطر 58-80 وسطر 118-140):

1. اضافة `source_type` في select من `exam_questions`
2. تقسيم الاسئلة حسب `source_type`:
   - اسئلة `image` تجلب من `question_bank` (الحقول الحالية)
   - اسئلة `text` تجلب من `text_question_bank` (مع `question_text`, `option_a/b/c/d`, `question_type`)
3. دمج النتائج مع اضافة `source_type` لكل سؤال
4. اعادة ترتيبها حسب `question_order`

### التفاصيل التقنية

```text
-- بدلا من جلب question_id فقط:
SELECT question_id, question_order, source_type FROM exam_questions

-- ثم تقسيم:
imageIds = اسئلة source_type = 'image'
textIds = اسئلة source_type = 'text'

-- جلب من الجدولين:
question_bank: id, question_type, page_image_name, frame_*
text_question_bank: id, question_type, question_text, option_a/b/c/d

-- دمج مع اضافة source_type لكل سؤال
```

### الملفات المعدلة
- `supabase/functions/student-exam-access/index.ts` فقط

لا حاجة لتعديل `TakeExam.tsx` لانه يدعم النوعين بالفعل بعد التعديل السابق.

