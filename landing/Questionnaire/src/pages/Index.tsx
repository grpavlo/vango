import SurveyCard from "@/components/survey/SurveyCard";
import SeoHead from "@/components/SeoHead";

const Index = () => (
  <>
    <SeoHead
      title="VanGo (Van Go, Ванго, Ван го) - платформа перевезень по Україні"
      description="VanGo (vango, van go, ванго, ван го) - платформа для пошуку перевізників і замовлення доставки вантажів по Україні."
      canonicalPath="/"
      keywords={[
        "van go",
        "vango",
        "ванго",
        "ван го",
        "перевезення",
        "доставка вантажів",
        "вантажні перевезення україна",
      ]}
    />
    <main className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <h1 className="sr-only">
        VanGo, Van Go, Ванго, Ван го - платформа перевезень та доставки в Україні
      </h1>
      <p className="sr-only">
        Шукаєте VanGo, vango, van go, ванго або ван го? Тут можна залишити заявку та
        отримати ранній доступ до сервісу.
      </p>
      <SurveyCard />
    </main>
  </>
);

export default Index;
