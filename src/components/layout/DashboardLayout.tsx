import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, LayoutDashboard, Users, BookOpen, FileText, ClipboardCheck, BarChart3, Upload, Settings } from "lucide-react";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { authUser, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const role = authUser?.role;

  const adminLinks = [
    { path: "/admin", label: "الرئيسية", icon: LayoutDashboard },
    { path: "/admin/teachers", label: "إدارة المعلمات", icon: Users },
    { path: "/admin/attempts", label: "المحاولات المعتمدة", icon: ClipboardCheck },
    { path: "/admin/analytics", label: "التحليلات", icon: BarChart3 },
  ];

  const teacherLinks = [
    { path: "/teacher", label: "الرئيسية", icon: LayoutDashboard },
    { path: "/teacher/questions", label: "بنك الأسئلة", icon: BookOpen },
    { path: "/teacher/exams", label: "الاختبارات", icon: FileText },
    { path: "/teacher/attempts", label: "المحاولات", icon: ClipboardCheck },
    { path: "/teacher/analytics", label: "التحليلات", icon: BarChart3 },
  ];

  const systemAdminLinks = [
    { path: "/system", label: "الرئيسية", icon: LayoutDashboard },
    { path: "/system/import", label: "استيراد بنك الأسئلة", icon: Upload },
  ];

  const links = role === "system_admin" ? systemAdminLinks : role === "admin" ? adminLinks : teacherLinks;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold">منصة نافس</h1>
          <p className="text-sm opacity-80 mt-1">
            {role === "system_admin" ? "لوحة مدير النظام" : role === "admin" ? "لوحة المديرة" : "لوحة المعلمة"}
          </p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3 px-2">
            <p className="text-sm font-medium">{authUser?.profile?.name}</p>
            <p className="text-xs opacity-70">{authUser?.profile?.subject || "مديرة"}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 ml-2" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
