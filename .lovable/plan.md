

# إنشاء صفحة "استيراد الأسئلة النصية" - خطة محدّثة

## ملخص التعديلات عن الخطة السابقة
- تغيير `teacher_id` الى `imported_by` في الجدول الجديد
- قراءة `subject` من الاكسل مع استخدام الافتراضي فقط عند الفراغ
- توسيع صلاحية SELECT للمديرة + مدير النظام + المعلمات (بدون شرط مادة)
- تطبيع قيم grade و semester و correct_answer لتوحيدها

---

## المرحلة 1: قاعدة البيانات - جدول `text_question_bank`

| العمود | النوع | ملاحظات |
|--------|-------|---------|
| id | uuid | مفتاح رئيسي تلقائي |
| imported_by | uuid | معرف مدير النظام الذي استورد (NOT NULL) |
| subject | text | المادة - تُقرأ من الاكسل، افتراضي "رياضيات" عند الفراغ فقط |
| grade | text | الصف (مطبّع) |
| semester | text | الفصل الدراسي (مطبّع) |
| question_number | integer | رقم السؤال |
| question_type | text | افتراضي "اختيار متعدد" |
| question_text | text | نص السؤال |
| option_a | text | خيار ا |
| option_b | text | خيار ب |
| option_c | text | خيار ج |
| option_d | text | خيار د |
| correct_answer | text | الاجابة الصحيحة (مطبّعة) |
| correct_answer_text | text, nullable | نص الاجابة الصحيحة |
| notes | text, nullable | ملاحظات |
| created_at | timestamptz | تلقائي |

### القيد الفريد
UNIQUE على (`subject`, `grade`, `semester`, `question_number`) لمنع التكرار

### سياسات RLS

| العملية | الصلاحية |
|---------|----------|
| SELECT | `is_admin()` OR `is_system_admin()` OR `is_teacher()` |
| INSERT | `is_system_admin()` فقط |
| UPDATE | `is_system_admin()` فقط |
| DELETE | `is_system_admin()` فقط |

ملاحظة: SELECT بدون شرط مادة - جميع المعلمات يرون كل الاسئلة النصية.

---

## المرحلة 2: تطبيع القيم

### دالة `normalizeGrade` - تطبيع الصف
- ازالة كلمات زائدة مثل "الصف" و"ال"
- توحيد الارقام العربية (١٢٣) الى لاتينية (123)
- امثلة: "الصف الرابع" -> "الرابع"، "٤" -> "4"

### دالة `normalizeSemester` - تطبيع الفصل الدراسي
- ازالة كلمات زائدة مثل "الفصل" و"الدراسي"
- توحيد الارقام العربية
- امثلة: "الفصل الدراسي الاول" -> "الاول"، "١" -> "1"

### دالة `normalizeAnswer` - تطبيع الاجابة الصحيحة
- توحيد الهمزات
- ازالة المسافات الزائدة
- trim
- امثلة: "  أ  " -> "ا"، "A" -> "a"

هذه الدوال تُطبّق في الفرونت عند قراءة الاكسل، قبل الارسال للدالة الخلفية.

---

## المرحلة 3: الدالة الخلفية `import-text-questions`

- التحقق من صلاحية `system_admin`
- استقبال مصفوفة اسئلة
- منع التكرار بناء على (`subject` + `grade` + `semester` + `question_number`)
- الادراج في `text_question_bank` باستخدام `imported_by` بدل `teacher_id`
- ارجاع `importedCount` و `skippedCount`

### اعداد في config.toml
```text
[functions.import-text-questions]
verify_jwt = false
```

---

## المرحلة 4: صفحة `ImportTextQuestions.tsx`

### الوظائف
1. رفع ملف Excel واحد فقط (بدون صور)
2. مطابقة مرنة للاعمدة باستخدام `normalizeColumnName` (نفس النمط الموجود)
3. خريطة الاعمدة:

```text
"المادة"              -> subject
"الصف"               -> grade
"الفصل الدراسي"      -> semester
"رقم السوال"          -> question_number
"نوع السوال"          -> question_type (يُتجاهل، الكل "اختيار متعدد")
"نص السوال"           -> question_text
"خيار ا"             -> option_a
"خيار ب"             -> option_b
"خيار ج"             -> option_c
"خيار د"             -> option_d
"الاجابة الصحيحة"    -> correct_answer
"نص الاجابة الصحيحة" -> correct_answer_text
"ملاحظات"            -> notes
```

4. تطبيع `grade` و `semester` و `correct_answer` عند القراءة
5. `subject` يُقرأ من الاكسل، الافتراضي "رياضيات" فقط اذا فارغ
6. جدول معاينة: رقم السؤال، نص السؤال (مختصر ~50 حرف)، الاجابة الصحيحة
7. زر استيراد مع try/catch/finally ومؤقت 60 ثانية
8. تقرير: عدد المستورد + عدد المتخطى

---

## المرحلة 5: الربط بالتطبيق

### تعديل `App.tsx`
اضافة مسار: `/system/import-text` -> `ImportTextQuestions` (محمي بـ `system_admin`)

### تعديل `SystemDashboard.tsx`
اضافة بطاقة:
- العنوان: "استيراد الاسئلة النصية"
- الوصف: "رفع ملف اكسل لاستيراد اسئلة اختيار من متعدد نصية"
- المسار: `/system/import-text`

---

## الملفات المتأثرة

| الملف | العملية |
|-------|---------|
| هجرة قاعدة البيانات | انشاء جدول `text_question_bank` مع RLS |
| `src/pages/system/ImportTextQuestions.tsx` | انشاء جديد |
| `supabase/functions/import-text-questions/index.ts` | انشاء جديد |
| `supabase/config.toml` | اضافة اعدادات الدالة |
| `src/App.tsx` | اضافة مسار |
| `src/pages/system/SystemDashboard.tsx` | اضافة بطاقة |

