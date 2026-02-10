

# اصلاح عرض الاسئلة المصورة - مسار الصور خاطئ

## سبب المشكلة
الصور مخزنة في مجلد `shared/` داخل مخزن الملفات:
- المخزن فيه: `shared/math_p012.png`
- الكود يطلب: `math_p012.png` (بدون `shared/`)

لذلك الرابط المتولد لا يشير لملف موجود فعلا، والصورة تظهر فارغة.

## الحل
تعديل دالة `getImageUrl` في ملف `src/pages/student/TakeExam.tsx` لاضافة `shared/` قبل اسم الملف:

```text
// من:
.getPublicUrl(imageName)

// الى:
.getPublicUrl(`shared/${imageName}`)
```

## الملفات المعدلة
- `src/pages/student/TakeExam.tsx` - سطر 54 فقط: تعديل مسار الصورة

## ملاحظة
هذا تعديل بسيط في سطر واحد فقط. البيانات القادمة من الـ API صحيحة (تحتوي على `page_image_name` و `frame_*` و `source_type`) والمشكلة فقط في مسار التخزين.
