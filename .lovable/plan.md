

# معالجة تطابق أشكال حرف الألف فقط

## المشكلة
النظام يعتبر "أ" (ألف بهمزة) و"ا" (ألف بدون همزة) حرفين مختلفين عند تصحيح الإجابات.

## الحل
اضافة دالة تطبيع تحول أشكال الألف فقط إلى شكل واحد قبل المقارنة، بدون تغيير أي حروف أخرى.

## التغييرات

### تعديل `supabase/functions/submit-exam/index.ts`
- اضافة دالة `normalizeArabic` تستبدل فقط أشكال الألف (أ، إ، آ، ٱ) بألف عادية (ا)
- استخدامها في سطر المقارنة

```typescript
function normalizeArabic(text: string): string {
  if (!text) return "";
  return text.replace(/[أإآٱ]/g, "ا");
}
```

تعديل سطر المقارنة:
```
normalizeArabic(a.answer?.trim().toLowerCase()) === normalizeArabic(correct.correct_answer?.trim().toLowerCase())
```

