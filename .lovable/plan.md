

# إنشاء نظام الاختبارات للمعلمات

## الوضع الحالي
- صفحة `CreateExam.tsx` موجودة بالفعل في `/teacher/exams` وتعمل كصفحة شاملة (إنشاء + قائمة) لكنها تعتمد فقط على `question_bank` (الأسئلة الصورية)
- جدول `exam_questions` لا يحتوي على عمود `source_type` لتمييز مصدر السؤال
- بنك الأسئلة الموحد متاح عبر دالة `get_teacher_questions` التي تدمج النوعين

## التغييرات المطلوبة

### 1. تعديل قاعدة البيانات (Migration)
إضافة عمود `source_type` لجدول `exam_questions`:
```text
ALTER TABLE public.exam_questions 
ADD COLUMN source_type text NOT NULL DEFAULT 'image';
```

### 2. إعادة كتابة صفحة CreateExam.tsx بالكامل
تقسيم التجربة إلى خطوتين داخل نفس الصفحة (بدون Dialog):

**الخطوة 1 - بيانات الاختبار:**
- حقل اسم الاختبار
- المادة (معروضة تلقائياً ومقفلة)
- اختيار الفصول المستهدفة (Checkbox من صلاحيات المعلمة)
- زر "التالي" ينتقل للخطوة 2

**الخطوة 2 - اختيار الأسئلة:**
- جلب الأسئلة من `get_teacher_questions` (نفس بنك الأسئلة الموحد)
- عرض فقط الأسئلة التي `visible_to_students = true`
- جدول موحد بنفس تصميم بنك الأسئلة مع إضافة عمود Checkbox
- عداد أعلى الجدول: "عدد الأسئلة المختارة: X"
- زر "حفظ الاختبار" يحفظ كمسودة

**عند الحفظ:**
- إنشاء سجل في `exams` بحالة "مسودة"
- إنشاء سجلات في `exam_questions` مع `source_type` ('image' أو 'text')
- رسالة نجاح ثم العودة لقائمة الاختبارات

### 3. الإبقاء على قائمة الاختبارات
الجزء السفلي من الصفحة يبقى كما هو (جدول الاختبارات الموجودة مع أزرار النشر والإغلاق).

## التفاصيل التقنية

**الملفات المعدلة:**
- `src/pages/teacher/CreateExam.tsx` - إعادة كتابة لدعم الأسئلة الموحدة والخطوتين
- `src/integrations/supabase/types.ts` - يتحدث تلقائياً بعد Migration

**Migration SQL:**
```text
ALTER TABLE public.exam_questions 
ADD COLUMN source_type text NOT NULL DEFAULT 'image';
```

**منطق جلب الأسئلة:**
- استخدام `supabase.rpc('get_teacher_questions', { p_subject })` بدلاً من الاستعلام المباشر على `question_bank`
- فلترة `visible_to_students = true` في الواجهة

**منطق الحفظ:**
```text
1. إنشاء exam في جدول exams (status = 'مسودة')
2. لكل سؤال مختار: إنشاء سجل في exam_questions مع:
   - exam_id
   - question_id (id السؤال)
   - source_type ('image' أو 'text' من حقل source)
   - question_order (ترتيب الاختيار)
```

