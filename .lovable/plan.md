

# اصلاح مطابقة اعمدة Excel في ImportTextQuestions

## المشكلة
دالة `buildHeaderMapping` تطابق اسماء الاعمدة فقط مع اسماء عربية محددة في `COLUMN_MAP`. اذا كان ملف Excel يحتوي على اعمدة بأسماء انجليزية (مثل `question_number`, `option_a`) فلن يتم التعرف عليها وتبقى القيم `undefined`.

## الحل
تعديل ملف واحد: `src/pages/system/ImportTextQuestions.tsx`

### التغييرات:

**1. اضافة console.log لطباعة اسماء الاعمدة الفعلية (سطر 157-158)**
```typescript
console.log("Excel headers (raw):", excelHeaders);
console.log("Excel headers (normalized):", excelHeaders.map(normalizeColumnName));
```

**2. توسيع `COLUMN_MAP` لدعم الاسماء الانجليزية (اسطر 51-70)**
اضافة مفاتيح انجليزية بجانب العربية:
- `"subject"` -> `subject`
- `"grade"` -> `grade`
- `"term"`, `"semester"` -> `semester`
- `"question number"`, `"question_number"` -> `question_number`
- `"question text"`, `"question_text"` -> `question_text`
- `"option a"`, `"option_a"` -> `option_a` (وكذلك b, c, d)
- `"correct answer"`, `"correct_answer"` -> `correct_answer`
- `"passage id"`, `"passage_id"` -> (يتم تجاهلها حاليا حسب الطلب)
- `"passage text"`, `"passage_text"` -> (يتم تجاهلها حاليا)
- `"question type"`, `"question_type"` -> `question_type`
- `"notes"` -> `notes`
- `"correct answer text"`, `"correct_answer_text"` -> `correct_answer_text`

**3. تحسين `normalizeColumnName` لتشمل lowercase**
اضافة `.toLowerCase()` للتعامل مع اختلاف حالة الاحرف الانجليزية.

**4. تحسين `buildHeaderMapping` بمطابقة مرنة**
اذا لم يتم العثور على تطابق تام، يتم تجربة:
- تطابق "يبدا بـ" (startsWith)
- تطابق "يحتوي على" (includes)

مع طباعة النتيجة النهائية في console.

### النتيجة المتوقعة
عند تحميل ملف Excel بأعمدة انجليزية او عربية، ستظهر القيم الصحيحة في المعاينة: رقم السؤال الحقيقي، نص السؤال، الخيارات، والاجابة الصحيحة.

