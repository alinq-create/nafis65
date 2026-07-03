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
    <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
      {/* Header */}
      {!hideHeader &&
      <header className="relative -mt-px overflow-hidden bg-gradient-to-l from-[hsl(145,50%,52%)] via-[hsl(194,64%,55%)] to-[hsl(38,82%,62%)] px-5 pt-4 pb-12 shadow-[0_10px_28px_rgba(15,23,42,0.12)]">
          <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-4">
            <div className="flex flex-1 items-center justify-end gap-3 sm:gap-4">
              <img
                src={schoolLogo}
                alt="شعار المدرسة المتوسطة 65"
                className="h-14 w-14 rounded-full bg-white/95 p-1.5 object-contain shadow-sm ring-1 ring-white/70 sm:h-16 sm:w-16" />
              <div className="text-right text-white drop-shadow-sm">
                <h1 className="text-lg font-extrabold leading-tight text-primary-foreground sm:text-xl">منصة تدريب نافس</h1>
                <p className="mt-0.5 text-xs font-bold opacity-95 sm:text-sm">المتوسطة الخامسة والستون</p>
              </div>
            </div>
            {headerExtra && <div className="flex shrink-0 items-center">{headerExtra}</div>}
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
