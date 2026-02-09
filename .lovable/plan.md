

# إضافة رابط "إدارة المعلمات" في القائمة الجانبية

## الوضع الحالي
الرابط موجود بالفعل في `src/components/layout/DashboardLayout.tsx` ضمن `adminLinks`:

```
{ path: "/admin/teachers", label: "إدارة المعلمات", icon: Users }
```

لا حاجة لأي تعديل -- الرابط مضاف ويظهر للمديرة فقط، ويقود إلى `/admin/teachers`.

## التفاصيل التقنية
- ملف `DashboardLayout.tsx` يعرض `adminLinks` فقط عندما يكون الدور `admin`
- الرابط الثاني في القائمة هو بالضبط "إدارة المعلمات" مع أيقونة `Users` والمسار `/admin/teachers`
- المسار محمي في `App.tsx` بـ `ProtectedRoute requiredRole="admin"`

لا يوجد أي تعديل مطلوب.
