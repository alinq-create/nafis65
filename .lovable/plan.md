

# فصل استيراد الأسئلة النصية حسب المادة

## الفكرة
بدلا من أيقونة واحدة لاستيراد الأسئلة النصية، ستكون هناك أيقونتان منفصلتان (علوم / لغتي) في لوحة مديرة النظام. كل أيقونة تمرر المادة كمعامل ثابت، ولا يُعتمد على محتوى ملف Excel نهائيا في تحديد المادة.

## التعديلات

### 1. تعديل `src/pages/system/SystemDashboard.tsx`
- استبدال أيقونة "استيراد الأسئلة النصية" الحالية بأيقونتين:
  - "استيراد أسئلة العلوم" -> المسار `/system/import-text?subject=علوم`
  - "استيراد أسئلة لغتي" -> المسار `/system/import-text?subject=لغتي`

### 2. تعديل `src/pages/system/ImportTextQuestions.tsx`
- قراءة المادة من `useSearchParams` (query parameter `subject`)
- اذا لم يوجد subject في الرابط، عرض رسالة خطأ وعدم السماح بالاستيراد
- عرض اسم المادة في عنوان الصفحة (مثلا "استيراد أسئلة العلوم")
- عند تحويل صفوف Excel الى كائنات `ParsedTextQuestion`:
  - تجاهل عمود `subject` من الملف تماما
  - فرض قيمة `subject` من query parameter
- ارسال المادة مع الأسئلة الى Edge Function

### 3. تعديل `supabase/functions/import-text-questions/index.ts`
- لا تغيير جوهري، الدالة تحفظ `q.subject` كما هو
- المادة ستأتي مفروضة من الواجهة الأمامية

## الملفات المعدلة
- `src/pages/system/SystemDashboard.tsx` - أيقونتان بدل واحدة
- `src/pages/system/ImportTextQuestions.tsx` - قراءة subject من URL وتجاهل الملف

## ملاحظات
- لا جداول جديدة
- لا كود مكرر (نفس الصفحة ونفس Edge Function)
- الفرق فقط في query parameter
- جلب الأسئلة للمعلمات يعمل بالفعل بفلترة المادة عبر RLS وView الموحد

