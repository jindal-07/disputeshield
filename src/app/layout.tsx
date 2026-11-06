import type { Metadata, Viewport } from "next";
import { Exo_2 } from "next/font/google";
import { Nav, Providers, THEME_SCRIPT } from "@/components/ui";
import "./globals.css";

const exo = Exo_2({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-exo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DisputeShield",
  description: "AI agents that prevent, fight and settle PayPal disputes for small sellers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ebeae5" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1d1f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={exo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <Nav />
          <main className="shell">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
