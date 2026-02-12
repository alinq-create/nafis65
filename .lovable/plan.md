

# Fix: منع التطابق المرن من الكتابة فوق الحقول المطابقة مسبقا

## السبب الجذري

من الصورة المرفوعة نرى ان ملف Excel يحتوي على 3 اعمدة متشابهة:
- `question_number` (العمود F) - يحتوي ارقام صحيحة: 1, 2, 3...
- `question_id` (العمود G) - يحتوي رموز: Q1, Q2...
- `question_number_in_book` (العمود H) - يحتوي رموز: 1-1-1م...

المشكلة في دالة `buildHeaderMapping` (سطر 104-106): التطابق المرن (`includes`) يجعل عمود `question_number_in_book` يطابق مفتاح `"question number"` لان `"question number in book".includes("question number")` يعطي `true`. وبما ان هذا العمود يأتي بعد `question_number` في الحلقة، فانه يكتب فوق القيمة الصحيحة.

## الحل (ملف واحد: `src/pages/system/ImportTextQuestions.tsx`)

### تعديل دالة `buildHeaderMapping` (سطر 90-115)

اضافة `Set` لتتبع الحقول التي تم تعيينها بتطابق تام، ومنع التطابق المرن من الكتابة فوقها:

```typescript
function buildHeaderMapping(headers: string[]) {
  const mapping: Record<string, keyof ParsedTextQuestion> = {};
  const mapKeys = Object.keys(COLUMN_MAP);
  const assignedFields = new Set<string>();

  for (const header of headers) {
    const normalised = normalizeColumnName(header);

    // 1. Exact match - always wins
    if (COLUMN_MAP[normalised]) {
      mapping[header] = COLUMN_MAP[normalised];
      assignedFields.add(COLUMN_MAP[normalised]);
      continue;
    }

    // 2. Flexible match - only if field not already assigned
    let found = mapKeys.find((k) => normalised.startsWith(k) || k.startsWith(normalised));
    if (!found) {
      found = mapKeys.find((k) => normalised.includes(k) || k.includes(normalised));
    }
    if (found) {
      const fieldName = COLUMN_MAP[found];
      if (!assignedFields.has(fieldName)) {
        mapping[header] = fieldName;
      }
    }
  }

  console.log("Header mapping result:", mapping);
  return mapping;
}
```

## النتيجة
- عمود `question_number` يطابق تماما مع `"question number"` ويسجل الحقل في `assignedFields`
- عمود `question_number_in_book` يحاول التطابق المرن لكن يجد ان `question_number` مسجل مسبقا فيتم تجاهله
- ارقام الاسئلة تظهر صحيحة (1, 2, 3...) في المعاينة
- لا تغيير على قاعدة البيانات

