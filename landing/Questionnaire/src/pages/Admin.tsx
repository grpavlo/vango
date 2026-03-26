import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LogOut, RefreshCcw } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-vango.png";
import SeoHead from "@/components/SeoHead";
import {
  ApiError,
  adminLogout,
  getAdminDashboard,
  type AdminDashboardResponse,
  type AdminSurveyResponse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

const BAR_COLORS = [
  "hsl(48, 100%, 50%)",
  "hsl(200, 80%, 50%)",
  "hsl(140, 70%, 45%)",
  "hsl(280, 60%, 55%)",
  "hsl(20, 90%, 55%)",
  "hsl(340, 70%, 50%)",
  "hsl(60, 80%, 45%)",
  "hsl(170, 60%, 45%)",
];

const chartConfig = {
  value: { label: "Кількість" },
};

const ADMIN_SEO_BASE = {
  description: "Службова сторінка адміністратора VanGo.",
  canonicalPath: "/admin",
  robots: "noindex, nofollow, noarchive, nosnippet",
  keywords: ["van go", "vango", "ванго", "ван го", "vango admin"],
} as const;

const statCards = (data: AdminDashboardResponse | null) =>
  data?.roleDistribution ?? [];

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("uk-UA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Admin = () => {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminSurveyResponse | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAdminDashboard();
      setDashboard(response);
    } catch (dashboardError) {
      if (dashboardError instanceof ApiError) {
        if (dashboardError.status === 401) {
          window.location.href = "/admin";
          return;
        }
        setError(dashboardError.message);
      } else {
        setError("Не вдалося завантажити дані адмінки.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const totalResponses = dashboard?.responses.length ?? 0;
  const roleData = useMemo(() => dashboard?.roleDistribution ?? [], [dashboard]);
  const deviceData = useMemo(() => dashboard?.deviceDistribution ?? [], [dashboard]);
  const cityData = useMemo(() => dashboard?.cityDistribution ?? [], [dashboard]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await adminLogout();
      window.location.href = "/admin";
    } catch {
      setLoggingOut(false);
      setError("Не вдалося вийти з сесії. Спробуйте ще раз.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <SeoHead title="VanGo Admin - вхід" {...ADMIN_SEO_BASE} />
        <p className="text-sm text-muted-foreground">Завантаження адмінки...</p>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <SeoHead title="VanGo Admin - помилка доступу" {...ADMIN_SEO_BASE} />
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button className="mt-4" onClick={loadDashboard}>
            Спробувати ще раз
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <SeoHead title="VanGo Admin - дашборд" {...ADMIN_SEO_BASE} />
      <div className="mx-auto mb-8 flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <img src={logo} alt="VanGo" className="h-10" />
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Дашборд</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDashboard}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Оновити
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={loggingOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {loggingOut ? "Вихід..." : "Вийти"}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{totalResponses} відповідей</span>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {statCards(dashboard).map((item) => (
            <Card key={item.name}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Ким себе бачать</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <PieChart>
                  <Pie
                    data={roleData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {roleData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill || BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Пристрої</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <PieChart>
                  <Pie
                    data={deviceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {deviceData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill || BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Міста</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={cityData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 4%, 16%)" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {cityData.map((_, index) => (
                      <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Відповіді користувачів</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Ім'я</TableHead>
                  <TableHead>Контакт</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Пристрій</TableHead>
                  <TableHead>Місто</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard?.responses.map((response) => (
                  <TableRow
                    key={response.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(response)}
                  >
                    <TableCell className="text-muted-foreground">{response.id}</TableCell>
                    <TableCell className="font-medium">{response.name}</TableCell>
                    <TableCell>{response.contact}</TableCell>
                    <TableCell>{response.role}</TableCell>
                    <TableCell>{response.device}</TableCell>
                    <TableCell>{response.city}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(response.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Dialog open onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{selected.name} — історія відповідей</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              {selected.answers.map((answer, index) => (
                <div key={index} className="border-b border-border pb-3 last:border-0">
                  <p className="text-sm text-muted-foreground">{answer.question}</p>
                  <p className="mt-1 font-medium text-foreground">{answer.answer}</p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Admin;
