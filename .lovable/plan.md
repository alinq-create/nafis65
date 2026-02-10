

# مشاركة القص بين المعلمات

## الوضع الحالي
- بيانات القص (frame_top, frame_height...) محفوظة في جدول `question_bank` المشترك
- **القراءة** تعمل: كل معلمة من نفس المادة ترى نفس بيانات القص
- **التعديل لا يعمل**: سياسة الامان (RLS) تشترط `teacher_id = auth.uid()` للتحديث، فالمعلمة لا تستطيع تعديل قص سؤال رفعته معلمة اخرى

## الحل
تعديل سياسة التحديث في جدول `question_bank` للسماح لاي معلمة من نفس المادة بتعديل السؤال (وليس فقط من رفعته).

### 1. تعديل RLS Policy (migration)
تحديث سياسة `update_questions` لتصبح:
```sql
DROP POLICY "update_questions" ON public.question_bank;
CREATE POLICY "update_questions" ON public.question_bank
  FOR UPDATE USING (
    is_admin() OR is_system_admin() 
    OR (is_teacher() AND teacher_id = auth.uid())
    OR (is_teacher() AND subject = (
      SELECT p.subject FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1
    ))
  );
```
هذا يسمح لاي معلمة من نفس المادة بتعديل بيانات القص.

### 2. لا تغيير في الكود
الكود الحالي في `QuestionBank.tsx` يحدّث `question_bank` مباشرة بالـ `id`، وكل المعلمات يقرأن من نفس الجدول. بمجرد فتح سياسة التحديث، سيعمل كل شيء تلقائيا:
- معلمة تقص السؤال -> يُحفظ في `question_bank`
- معلمة اخرى تفتح نفس السؤال -> ترى آخر قص محفوظ
- يمكنها تعديله ايضا

## الملفات المعدلة
- **Migration فقط**: تحديث سياسة `update_questions` على جدول `question_bank`

## ملاحظة
لا حاجة لتعديل اي كود في الواجهة. البنية الحالية تدعم المشاركة بالفعل، المطلوب فقط رفع قيد الصلاحية.

