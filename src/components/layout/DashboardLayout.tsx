import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, LayoutDashboard, Users, BookOpen, FileText, ClipboardCheck, BarChart3, Upload, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import schoolLogo from "@/assets/school-logo-65.png";
import HorizonDivider from "@/components/layout/HorizonDivider";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { authUser, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { path: "/teacher/students", label: "الطالبات", icon: Users },
    { path: "/teacher/analytics", label: "التحليلات", icon: BarChart3 },
  ];

  const systemAdminLinks = [
    { path: "/system", label: "الرئيسية", icon: LayoutDashboard },
    { path: "/system/import", label: "استيراد بنك الأسئلة", icon: Upload },
  ];

  const links = role === "system_admin" ? systemAdminLinks : role === "admin" ? adminLinks : teacherLinks;

  const handleNavigate = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const NavLinks = ({ onNavigate }: { onNavigate: (path: string) => void }) => (
    <>
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = location.pathname === link.path;
        return (
          <button
            key={link.path}
            onClick={() => onNavigate(link.path)}
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
    </>
  );

  const UserInfo = ({ onSignOut }: { onSignOut: () => void }) => (
    <div className="p-4 border-t border-sidebar-border">
      <div className="mb-3 px-2">
        <p className="text-sm font-medium">{authUser?.profile?.name}</p>
        <p className="text-xs opacity-70">{authUser?.profile?.subject || "مديرة"}</p>
      </div>
      <Button
        variant="ghost"
        className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        onClick={onSignOut}
      >
        <LogOut className="h-4 w-4 ml-2" />
        تسجيل الخروج
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="relative -mt-px overflow-hidden bg-gradient-to-l from-[hsl(145,50%,52%)] via-[hsl(194,64%,55%)] to-[hsl(38,82%,62%)] px-5 pt-4 pb-12 shadow-[0_10px_28px_rgba(15,23,42,0.12)]">
        <div className="relative z-10 flex items-center gap-4">
          {/* Hamburger button - mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-white p-1 rounded-md hover:bg-white/20 transition-colors"
            aria-label="فتح القائمة"
          >
            <Menu className="h-6 w-6" />
          </button>

          <img
            src={schoolLogo}
            alt="شعار المدرسة المتوسطة 65"
            className="h-12 w-12 rounded-full bg-white/95 p-1.5 object-contain shadow-sm ring-1 ring-white/70"
          />
          <div className="text-right text-white drop-shadow-sm">
            <h1 className="text-lg font-extrabold leading-tight">منصة تدريب نافس</h1>
            <p className="mt-0.5 text-sm font-bold opacity-95">المتوسطة الخامسة والستون</p>
          </div>
        </div>
        <HorizonDivider />
      </header>

      <div className="flex flex-1 pb-12">
        {/* Mobile Sidebar Sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="right" className="w-72 bg-sidebar text-sidebar-foreground p-0">
            <SheetHeader className="p-6 border-b border-sidebar-border">
              <SheetTitle className="text-sidebar-foreground text-right">
                {role === "system_admin" ? "لوحة مدير النظام" : role === "admin" ? "لوحة المديرة" : "لوحة المعلمة"}
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 p-4 space-y-1">
              <NavLinks onNavigate={handleNavigate} />
            </nav>
            <UserInfo onSignOut={handleSignOut} />
          </SheetContent>
        </Sheet>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 bg-sidebar text-sidebar-foreground flex-col shrink-0">
          <div className="p-6 border-b border-sidebar-border">
            <p className="text-sm opacity-80">
              {role === "system_admin" ? "لوحة مدير النظام" : role === "admin" ? "لوحة المديرة" : "لوحة المعلمة"}
            </p>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <NavLinks onNavigate={(path) => navigate(path)} />
          </nav>
          <UserInfo onSignOut={handleSignOut} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">{children}</div>
        </main>
      </div>

      {/* Fixed Footer */}
      <footer className="fixed bottom-0 w-full z-50 bg-[hsl(215,25%,15%)] text-white/90 px-6 py-3">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span>اعداد وتصميم / أ. شريفة عسيري</span>
          <span>مديرة المدرسة / عفاف الحربي</span>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout;
