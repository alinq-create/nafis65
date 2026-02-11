

# اصلاح مطابقة رقم السؤال في صفحة استيراد الاسئلة النصية

## المشكلة
في السطر 211، يتم تحويل رقم السؤال بـ `Number(mapped.question_number) || 0` مما يعطي 0 دائما اذا لم يتم العثور على العمود. والسبب ان COLUMN_MAP لا يحتوي على جميع الاسماء المحتملة لعمود رقم السؤال في ملفات Excel العربية.

## التغييرات (ملف واحد فقط)

### `src/pages/system/ImportTextQuestions.tsx`

**1. اضافة اسماء اعمدة جديدة في COLUMN_MAP (حوالي سطر 56-76):**

اضافة هذه المفاتيح الجديدة:
- `"question number"` - موجود بالفعل
- `"question id"` - جديد
- `"رقم"` - جديد
- `"question number in book"` - جديد

ملاحظة: `"رقم السوال"` موجود بالفعل في السطر 56 (بعد ازالة التشكيل تصبح "رقم السوال" وهي تطابق "رقم السؤال").

**2. تعديل منطق التحويل في سطر 211:**

تغيير من:
```
question_number: Number(mapped.question_number) || 0,
```

الى:
```typescript
question_number: (() => {
  const raw = mapped.question_number;
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const parsed = parseInt(String(raw), 10);
  return isNaN(parsed) ? null : parsed;
})(),
```

**3. تحديث نوع ParsedTextQuestion (سطر 20):**

تغيير `question_number: number` الى `question_number: number | null` للسماح بقيمة null عند فشل التحويل.

**4. تحديث عرض المعاينة (سطر 397):**

تغيير من:
```
<TableCell>{q.question_number}</TableCell>
```
الى:
```
<TableCell>{q.question_number !== null ? q.question_number : <span className="text-red-500">خطأ</span>}</TableCell>
```

## النتيجة
- المعاينة تعرض ارقام الاسئلة الحقيقية (1, 2, 3, ...) بدل 0
- اذا فشل التحويل يظهر "خطأ" بالاحمر بدل 0
- لا تغيير على قاعدة البيانات او منطق التكرار
