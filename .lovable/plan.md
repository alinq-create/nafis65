
# اصلاح معاينة محرر القص

## المشكلة
منطقة المعاينة (يسار) تعرض جزء مختلف عن اطار القص (يمين). السبب ان حساب `backgroundPosition` و `backgroundSize` بالنسب المئوية في CSS لا يعمل كما هو متوقع لان CSS تحسب background-position بطريقة خاصة نسبة للفرق بين حجم الحاوية وحجم الخلفية.

## الحل
استبدال طريقة المعاينة من `background-image` الى عنصر `img` حقيقي داخل حاوية مقصوصة باستخدام `clipPath: inset(...)` مع تعويض المسافة بـ `marginTop` سالب:

### تعديل `src/components/teacher/ImageCropEditor.tsx` - قسم المعاينة (سطر 154-165)

بدلا من:
```text
<div style={{ backgroundImage, backgroundSize, backgroundPosition, paddingBottom }} />
```

نستخدم:
```text
<div style={{ overflow: 'hidden' }}>
  <img 
    src={imageUrl}
    style={{
      width: '100%',
      display: 'block',
      clipPath: `inset(${cropTop * 100}% 0 ${(1 - cropBottom) * 100}% 0)`,
      marginTop: `-${cropTop * 100}%`,
      marginBottom: `-${(1 - cropBottom) * 100}%`,
    }}
  />
</div>
```

هذا يقص الصورة بالضبط من الحد العلوي والسفلي ويزيل المسافات الفارغة، فتتطابق المعاينة مع اطار القص.

### الملفات المعدلة
- `src/components/teacher/ImageCropEditor.tsx` فقط - قسم المعاينة
