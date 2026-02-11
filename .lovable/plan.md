

# اضافة سطر تصحيح مؤقت في ImportTextQuestions.tsx

## الهدف
اضافة `console.log("PARSED ROW SAMPLE:", rows[0])` مباشرة بعد قراءة صفوف Excel من XLSX لمعرفة اسماء الاعمدة الفعلية في الملف العربي.

## التغيير
في ملف `src/pages/system/ImportTextQuestions.tsx`، بعد السطر الذي يقرأ الصفوف من ورقة Excel (عادة `XLSX.utils.sheet_to_json(...)`)، اضافة سطر واحد فقط:

```typescript
console.log("PARSED ROW SAMPLE:", rows[0]);
```

## ملاحظات
- لن يتم تعديل اي منطق اخر (لا كشف التكرار ولا مطابقة الاعمدة)
- هذا سطر تصحيح مؤقت فقط لفحص بنية البيانات المقروءة من الملف
