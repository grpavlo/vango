import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";
import logo from "@/assets/logo-vango.png";
import { adminLogin, adminSession, ApiError } from "@/lib/api";
import SeoHead from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminAuthGateProps {
  children: ReactNode;
}

const AdminAuthGate = ({ children }: AdminAuthGateProps) => {
  const [authed, setAuthed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await adminSession();
        setAuthed(session.authenticated);
      } catch {
        setAuthed(false);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim()) {
      setError("Введіть пароль");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await adminLogin(password);
      setAuthed(true);
      setPassword("");
    } catch (loginError) {
      if (loginError instanceof ApiError) {
        setError(loginError.message);
      } else {
        setError("Помилка входу. Спробуйте ще раз.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <SeoHead
          title="VanGo Admin - перевірка доступу"
          description="Службова сторінка адміністратора VanGo."
          canonicalPath="/admin"
          robots="noindex, nofollow, noarchive, nosnippet"
          keywords={["van go", "vango", "ванго", "ван го", "vango admin"]}
        />
        <p className="text-sm text-muted-foreground">Перевірка доступу...</p>
      </div>
    );
  }

  if (authed) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SeoHead
        title="VanGo Admin - вхід"
        description="Службова сторінка адміністратора VanGo."
        canonicalPath="/admin"
        robots="noindex, nofollow, noarchive, nosnippet"
        keywords={["van go", "vango", "ванго", "ван го", "vango admin"]}
      />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <img src={logo} alt="VanGo" className="h-14" />
        </div>

        <div className="rounded-3xl border border-border bg-card p-8">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>

          <h2 className="mb-2 text-center text-xl font-bold text-foreground">Адмін-панель</h2>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Введіть пароль для доступу
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              className="rounded-xl"
              autoFocus
              disabled={submitting}
            />

            {error && <p className="text-center text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full rounded-xl" disabled={submitting || !password}>
              {submitting ? "Вхід..." : "Увійти"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminAuthGate;
