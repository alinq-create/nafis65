
# اصلاح منطق كشف التكرار في import-text-questions

## المشكلة
سجل فارغ (question_text خالي) موجود في قاعدة البيانات من محاولة استيراد سابقة فاشلة. هذا يتسبب في اعتبار 234 سؤال كتكرار لان الدالة تقارن فقط بناء على (subject, grade, semester, question_number) بدون التحقق من ان question_text غير فارغ.

## التغييرات المطلوبة

### 1. تعديل `supabase/functions/import-text-questions/index.ts`

**اضافة عداد للسجلات غير الصالحة + تحقق قبل كشف التكرار (سطر 66-69):**
```typescript
let importedCount = 0;
let skippedCount = 0;
let invalidCount = 0;

for (const q of questions) {
  // Skip rows with empty question_text
  if (!q.question_text || q.question_text.toString().trim() === '') {
    invalidCount++;
    continue;
  }
```

**تعديل فحص التكرار ليستثني السجلات الفارغة (سطر 71-78):**
اضافة شرط `.neq("question_text", "")` و `.not("question_text", "is", null)` لاستعلام كشف التكرار حتى لا يتم مقارنة الاسئلة الجديدة بسجلات فارغة موجودة.

**تعديل الاستجابة لتشمل invalidCount (سطر 113):**
```typescript
JSON.stringify({ importedCount, skippedCount, invalidCount })
```

### 2. تنظيف السجلات الفارغة من قاعدة البيانات
تنفيذ استعلام حذف مباشر:
```sql
DELETE FROM text_question_bank
WHERE question_text IS NULL OR question_text = '';
```

### النتيجة المتوقعة
- السجلات ذات question_text الفارغ لن تُعتبر تكرارات
- السجلات الفارغة الموجودة ستُحذف من قاعدة البيانات
- الاسئلة الـ 234 ستُستورد بنجاح
