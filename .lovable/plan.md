
# اصلاح حفظ إجابات الطالبات للأسئلة النصية

## المشكلة الجذرية
جدول `student_answers` يحتوي على قيد مفتاح أجنبي (Foreign Key) على عمود `question_id` يشير حصريا الى جدول `question_bank` (الأسئلة المصورة). عند محاولة حفظ إجابة على سؤال نصي من `text_question_bank`، يفشل الإدراج بسبب عدم وجود المعرّف في `question_bank`. والخطأ لا يظهر لأن الكود لا يتحقق من نتيجة الإدراج.

## الحل

### 1. تعديل قاعدة البيانات (Migration)
- حذف قيد المفتاح الأجنبي `student_answers_question_id_fkey` الذي يربط `question_id` بـ `question_bank(id)` فقط
- هذا يسمح بتخزين معرّفات أسئلة من كلا الجدولين (`question_bank` و `text_question_bank`)

```sql
ALTER TABLE public.student_answers 
  DROP CONSTRAINT student_answers_question_id_fkey;
```

### 2. تعديل `supabase/functions/submit-exam/index.ts`
- اضافة التحقق من خطأ إدراج الإجابات (السطر 108 حاليا لا يتحقق من الخطأ)

```typescript
const { error: answersError } = await adminClient
  .from("student_answers")
  .insert(answersToInsert);

if (answersError) {
  throw answersError;
}
```

### الملفات المعدلة
- Migration جديد لحذف قيد المفتاح الأجنبي
- `supabase/functions/submit-exam/index.ts` - التحقق من خطأ الإدراج

### النتيجة
- الإجابات على الأسئلة النصية تُحفظ بنجاح
- المعلمة تستطيع مشاهدة إجابات الطالبات والإجابات الصحيحة
- التصحيح الآلي يعمل لكلا نوعي الأسئلة
