

# تحسين التمييز البصري للخيارات في شاشة المراجعة

## الملف المعدل: `src/pages/teacher/ReviewAttempts.tsx`

## التغييرات المطلوبة

### 1. إضافة نص "الإجابة الصحيحة" عند الخيار الصحيح (حتى لو لم تختره الطالبة)
حاليا (سطر 283-285): عندما يكون الخيار هو الإجابة الصحيحة ولكن الطالبة لم تختره، تظهر أيقونة CheckCircle فقط بدون نص. المطلوب إضافة نص "الإجابة الصحيحة" بجانب الأيقونة.

### 2. تخفيف حدة الألوان
- تغيير `border-green-500` الى `border-green-400` و `bg-green-50` تبقى كما هي (فاتحة بالفعل)
- تغيير `border-red-500` الى `border-red-400` و `bg-red-50` تبقى كما هي
- تغيير ألوان النصوص من `text-green-600` الى `text-green-600` (تبقى) و `text-red-600` الى `text-red-500`

### 3. لا تغييرات أخرى
باقي العناصر (ملخص أسفل الخيارات، حقل الدرجة، التنقل، RTL) موجودة وتعمل بشكل صحيح.

### التفاصيل التقنية

**سطر 182-193** - تعديل `getOptionStyle`:
```typescript
if (isCorrect) return "border-green-400 bg-green-50 dark:bg-green-950/30";
if (isStudentChoice && !isCorrect) return "border-red-400 bg-red-50 dark:bg-red-950/30";
return "border-gray-200 dark:border-gray-700";
```

**سطر 283-285** - إضافة نص للخيار الصحيح غير المختار:
```typescript
{isCorrect && !isStudentChoice && (
  <span className="flex items-center gap-1 text-xs text-green-600 shrink-0">
    <CheckCircle className="h-5 w-5" />
    الإجابة الصحيحة
  </span>
)}
```

