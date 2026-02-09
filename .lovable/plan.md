

# إصلاح أزرار التحكم في إظهار الأسئلة (Switch)

## المشكلة
- أزرار التبديل (Switch) للأسئلة النصية معطّلة ولا يمكن تحريكها
- السبب: جدول `text_question_bank` لا يحتوي على عمود `visible_to_students`، والقيمة مثبتة على `true` في الـ VIEW

## الحل

### 1. إضافة عمود `visible_to_students` لجدول الأسئلة النصية
- إضافة عمود `visible_to_students` من نوع `boolean` بقيمة افتراضية `true` إلى جدول `text_question_bank`

### 2. تحديث الـ VIEW
- تعديل `teacher_question_bank_view` لقراءة القيمة الفعلية من العمود الجديد بدلاً من القيمة الثابتة `true`

### 3. تحديث صفحة بنك الأسئلة
- إزالة `disabled={q.source === 'text'}` من زر التبديل
- السماح بتبديل إظهار/إخفاء جميع الأسئلة (صورية ونصية)
- إزالة رسالة "الأسئلة النصية مرئية دائماً" والسماح بالتبديل الفعلي

## التفاصيل التقنية

**Migration SQL:**
```text
ALTER TABLE public.text_question_bank 
  ADD COLUMN visible_to_students boolean DEFAULT true NOT NULL;

-- إعادة إنشاء الـ VIEW لاستخدام العمود الجديد
CREATE OR REPLACE VIEW public.teacher_question_bank_view AS ...
  (تحديث السطر الخاص بالأسئلة النصية من true إلى visible_to_students)
```

**تعديل QuestionBank.tsx:**
- إزالة شرط `q.source === 'text'` من `disabled`
- تعديل `handleToggleVisibility` للسماح بتحديث كلا الجدولين
