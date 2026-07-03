import schoolLogo from "@/assets/school-logo-65.png";
import HorizonDivider from "@/components/layout/HorizonDivider";

interface AppShellProps {
  children: React.ReactNode;
  hideHeader?: boolean;
  hideFooter?: boolean;
  headerExtra?: React.ReactNode;
}

const AppShell = ({ children, hideHeader = false, hideFooter = false, headerExtra }: AppShellProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      {!hideHeader &&
      <header className="relative overflow-hidden bg-gradient-to-l from-[hsl(145,55%,42%)] via-[hsl(199,70%,45%)] to-[hsl(35,85%,55%)] px-4 pt-3 pb-8 shadow-md">
          <div className="relative z-10 flex items-center w-full">
            <div className="max-w-7xl mx-auto flex-1 flex items-center gap-4">
              <img
                src={schoolLogo}
                alt="شعار المدرسة المتوسطة 65"
                className="h-14 w-14 rounded-full bg-white p-1 object-contain" />
              <div className="text-white">
                <h1 className="text-lg font-bold leading-tight text-primary-foreground">منصة تدريب نافس</h1>
                <p className="text-sm opacity-90">المتوسطة الخامسة والستون</p>
              </div>
            </div>
            {headerExtra && <div>{headerExtra}</div>}
          </div>
          <HorizonDivider />
        </header>
      }

      {/* Content */}
      <div className={`flex-1 ${!hideFooter ? "pb-14" : ""}`}>
        {children}
      </div>

      {/* Fixed Footer */}
      {!hideFooter &&
      <footer className="fixed bottom-0 w-full z-50 bg-[hsl(215,25%,15%)] text-white/90 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs sm:text-sm">
            <span>اعداد وتصميم / أ. شريفة عسيري</span>
            <span>مديرة المدرسة / عفاف الحربي</span>
          </div>
        </footer>
      }
    </div>);

};

export default AppShell;
