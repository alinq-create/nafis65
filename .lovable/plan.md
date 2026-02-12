

# تعديلات على بنك الأسئلة ولوحة مدير النظام

## التغييرات المطلوبة

### 1. ازالة عمود "يظهر للطالبات" من بنك الأسئلة للمعلمة
**ملف:** `src/pages/teacher/QuestionBank.tsx`
- حذف عمود `<TableHead>` الخاص بـ "يظهر للطالبات" (سطر 153)
- حذف خلية `<TableCell>` التي تحتوي على `Switch` (سطر 193-198)
- حذف دالة `handleToggleVisibility` بالكامل (سطر 63-83)
- حذف استيراد `Switch` (سطر 8)

### 2. اضافة ايقونة حذف لكل سؤال في بنك الأسئلة
**ملف:** `src/pages/teacher/QuestionBank.tsx`
- اضافة عمود جديد "حذف" في رأس الجدول
- اضافة خلية تحتوي على زر حذف (ايقونة سلة) لكل سؤال
- اضافة دالة `handleDeleteQuestion` تحذف السؤال من الجدول المناسب (`question_bank` او `text_question_bank`) حسب `q.source`
- اضافة `AlertDialog` للتأكيد قبل الحذف
- استيراد `Trash2` من `lucide-react` و `Button` و `AlertDialog` ومكوناته

### 3. ازالة زر "حذف جميع أسئلة لغتي" من لوحة مدير النظام
**ملف:** `src/pages/system/SystemDashboard.tsx`
- حذف الزر الاحمر "حذف جميع أسئلة لغتي" (سطر 85-92)
- حذف `AlertDialog` الخاص بالتأكيد (سطر 94-109)
- حذف دالة `handleDeleteLughati` (سطر 17-27)
- حذف المتغيرات `showDeleteDialog` و `deleting` (سطر 14-15)
- حذف الاستيرادات غير المستخدمة: `AlertDialog` ومكوناته، `Trash2`، `useState` للحوار

## ملاحظات تقنية
- حذف السؤال من بنك الأسئلة يتم حسب نوع المصدر: اذا كان `source === 'image'` يحذف من `question_bank`، واذا كان `source === 'text'` يحذف من `text_question_bank`
- سياسات RLS الحالية تسمح للمعلمة بحذف اسئلتها من `question_bank` (شرط `teacher_id = auth.uid()`)، لكن `text_question_bank` تسمح بالحذف فقط لـ `system_admin`. سيتم اضافة سياسة RLS جديدة تسمح للمعلمة بحذف الاسئلة النصية ايضا
- سيتم اضافة migration لسياسة RLS: `CREATE POLICY "teachers_delete_text_questions" ON text_question_bank FOR DELETE USING (is_teacher())`
