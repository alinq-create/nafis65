import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppShell from "@/components/layout/AppShell";
import nafisLogo from "@/assets/nafis-logo.png";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, authUser, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (authUser) {
      const path = authUser.role === "admin" ? "/admin" : authUser.role === "system_admin" ? "/system" : "/teacher";
      navigate(path, { replace: true });
    }
  }, [authUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setIsLoading(true);
    const { error } = await signIn(username.trim(), password);
    if (error) {
      setIsLoading(false);
      toast({
        title: "خطأ في تسجيل الدخول",
        description: error,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground">جاري التحميل...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src={nafisLogo} alt="شعار نافس" className="h-24 mx-auto mb-4 object-contain" />
            <h1 className="text-3xl font-bold text-foreground">منصة تدريب نافس</h1>
            <p className="text-muted-foreground mt-2">تدريب طالبات ثالث متوسط على اختبار نافس</p>
          </div>

          <Card className="shadow-lg border-0">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl">تسجيل الدخول</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="أدخلي اسم المستخدم"
                    className="text-right"
                    autoComplete="username"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="أدخلي كلمة المرور"
                      className="text-right pl-10"
                      autoComplete="current-password"
                      dir="rtl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
                </Button>
              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </AppShell>
  );
};

export default Login;
