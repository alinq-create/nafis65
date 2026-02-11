

# اضافة زر مؤقت لحذف جميع اسئلة لغتي في لوحة مدير النظام

## الوصف
اضافة زر "حذف جميع اسئلة لغتي" في صفحة SystemDashboard مع نافذة تاكيد قبل الحذف ورسالة نجاح بعده.

## التغييرات

### ملف واحد: `src/pages/system/SystemDashboard.tsx`

1. اضافة الاستيرادات اللازمة:
   - `AlertDialog` وعناصره من مكتبة UI
   - `Button` من مكتبة UI
   - `Trash2` من lucide-react
   - `supabase` من integrations
   - `toast` من sonner
   - `useState` من React

2. اضافة state للتحكم في نافذة التاكيد وحالة التحميل:
   - `showDeleteDialog` (boolean)
   - `deleting` (boolean)

3. اضافة دالة `handleDeleteLughati`:
   - تنفذ `DELETE FROM text_question_bank WHERE subject = 'لغتي'` عبر Supabase client
   - تعرض رسالة نجاح بعدد السجلات المحذوفة
   - تعرض رسالة خطا في حال الفشل

4. اضافة الزر ونافذة التاكيد (AlertDialog) اسفل شبكة البطاقات الموجودة:
   - زر احمر اللون بعنوان "حذف جميع اسئلة لغتي"
   - نافذة تاكيد تسال "هل انت متاكد من حذف جميع اسئلة لغتي؟" مع زر تاكيد وزر الغاء

## ملاحظات
- لا تغييرات على البطاقات الموجودة او اي منطق اخر
- الزر مؤقت يمكن ازالته لاحقا
- الحماية عبر RLS (مدير النظام فقط يملك صلاحية الحذف من text_question_bank)

