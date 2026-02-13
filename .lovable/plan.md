

# إضافة وظائف الحذف للمديرة

## الملخص
إضافة أيقونات حذف في صفحتي "المحاولات المعتمدة" و"إدارة المعلمات" للمديرة، مع حذف البيانات المرتبطة (إجابات، محاولات، اختبارات، أسئلة) بحيث لا تبقى في التحليلات.

## التغييرات

### 1. صفحة المحاولات المعتمدة (`src/pages/admin/AdminAttempts.tsx`)

**إضافة زر حذف لكل محاولة معتمدة:**
- أيقونة سلة حذف (Trash2) في عمود جديد "إجراءات"
- عند النقر: نافذة تأكيد (AlertDialog) "هل تريدين حذف هذه المحاولة؟"
- عند التأكيد: حذف إجابات الطالبة من `student_answers` ثم حذف المحاولة من `student_attempts`
- تحديث القائمة تلقائياً بعد الحذف

### 2. صفحة إدارة المعلمات (`src/pages/admin/ManageTeachers.tsx`)

**إضافة زر حذف لكل معلمة:**
- أيقونة سلة حذف (Trash2) بجانب أزرار التعديل والتعطيل
- عند النقر: نافذة تأكيد توضح أن الحذف سيشمل جميع اختبارات ومحاولات ونتائج المعلمة
- عند التأكيد: استدعاء Edge Function لحذف المعلمة وبياناتها بالكامل

### 3. تطوير Edge Function (`supabase/functions/manage-teacher/index.ts`)

**إضافة action "delete" للدالة الموجودة:**
- يستقبل `userId` للمعلمة المراد حذفها
- ترتيب الحذف (من الأعمق للأعلى لتجنب مشاكل المراجع):
  1. جلب اختبارات المعلمة من `exams`
  2. جلب محاولات الطالبات على تلك الاختبارات من `student_attempts`
  3. حذف `student_answers` المرتبطة بتلك المحاولات
  4. حذف `student_attempts` المرتبطة بالاختبارات
  5. حذف `exam_questions` المرتبطة بالاختبارات
  6. حذف `exams` الخاصة بالمعلمة
  7. حذف `question_bank` الخاصة بالمعلمة
  8. حذف `class_permissions` الخاصة بالمعلمة
  9. حذف `user_roles` الخاصة بالمعلمة
  10. حذف `profiles` الخاصة بالمعلمة
  11. حذف المستخدم من auth باستخدام `admin.deleteUser`
- يستخدم `adminClient` (service role) لتجاوز RLS

### التأثير على التحليلات
- حذف المحاولة يزيل بياناتها من `student_attempts` و `student_answers`، فلن تظهر في أي تحليلات لاحقة (ExamAnalytics, AdminAnalytics, StudentProfile)
- حذف المعلمة يزيل كل اختباراتها ومحاولاتها، فتختفي تلقائياً من جميع لوحات التحكم والتحليلات
- لا حاجة لتعديل صفحات التحليلات لأنها تقرأ البيانات مباشرة من قاعدة البيانات

### التفاصيل التقنية

**AdminAttempts.tsx:**
- استيراد `Trash2` من lucide-react و `AlertDialog` من radix
- إضافة state لـ `deletingId`
- دالة `handleDeleteAttempt`: حذف من `student_answers` حيث `attempt_id` ثم من `student_attempts` حيث `id`
- عمود إجراءات جديد في الجدول

**ManageTeachers.tsx:**
- استيراد `Trash2` من lucide-react و `AlertDialog` من radix
- إضافة state لـ `deletingTeacher`
- دالة `handleDeleteTeacher`: استدعاء `manage-teacher` مع `action: "delete"`
- زر حذف أحمر بجانب الأزرار الموجودة

**manage-teacher/index.ts:**
- إضافة block جديد `if (action === "delete")` يتعامل مع الحذف المتسلسل

