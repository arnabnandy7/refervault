import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_INITIALIZATION_SCRIPT } from "@/lib/theme";
import "./globals.css";

const bodyFont = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const headingFont = Manrope({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "ReferVault — Your referrals, thoughtfully organized",
  description:
    "Your personal workspace for candidate profiles and referral history.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INITIALIZATION_SCRIPT }}
        />
      </head>
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
