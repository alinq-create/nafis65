import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Upload, Settings } from "lucide-react";

const SystemDashboard = () => {
  const navigate = useNavigate();

  const cards = [
    {
      title: "استيراد بنك الأسئلة (رياضيات)",
      description: "رفع ملف إكسل وصور الصفحات لاستيراد الأسئلة",
      icon: Upload,
      path: "/system/import",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">لوحة مدير النظام</h2>
          <p className="text-muted-foreground mt-1">إدارة النظام والبيانات</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.path}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(card.path)}
              >
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SystemDashboard;
