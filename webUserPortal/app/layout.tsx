import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VanGo",
  description:
    "Кабінет VanGo з профілем, замовленнями та службовими даними для користувачів з правами доступу.",
  openGraph: {
    title: "VanGo",
    description: "Кабінет VanGo для замовників, водіїв, адміністраторів і аналітиків",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "VanGo",
    description: "Кабінет VanGo для замовників, водіїв, адміністраторів і аналітиків",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uk" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{var theme=localStorage.getItem("vango.webUserPortal.customerTheme");if(!theme&&matchMedia("(prefers-color-scheme: dark)").matches)theme="dark";if(theme==="dark"){document.documentElement.classList.add("customer-dark");document.documentElement.style.colorScheme="dark";}}catch(e){}` }} /></head><body>{children}</body></html>;
}
