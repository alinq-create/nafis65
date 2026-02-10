

# إكمال ربط صفحة تحليلات الاختبار

## الوضع الحالي
- ملف `ExamAnalytics.tsx` موجود ومكتمل
- لكنه غير مربوط بالتطبيق (لا يمكن الوصول إليه)

## التعديلات المطلوبة

### 1. تعديل `src/App.tsx`
- إضافة import لـ `ExamAnalytics`
- إضافة Route جديد: `/teacher/exam-analytics/:examId` محمي بصلاحية `teacher`

### 2. تعديل `src/pages/teacher/TeacherAnalytics.tsx`
- إضافة زر "تفاصيل" بجانب كل اختبار في القائمة
- الزر يوجه المعلمة الى `/teacher/exam-analytics/{examId}`
- يتطلب تعديل بنية البيانات لتخزين `examId` مع كل اختبار

