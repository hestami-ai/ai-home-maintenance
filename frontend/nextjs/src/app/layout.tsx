import { Inter } from "next/font/google";
import "./globals.css";
//import "@photo-sphere-viewer/gallery-plugin/index.css";
import { ThemeScript } from "./theme-script";
import { auth } from "@/app/auth";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from '@/context/ThemeContext';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AI Home Maintenance Concierge",
  description: "Your intelligent partner in home maintenance",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const nonce = headers().get('x-nonce') || '';
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <meta name="csp-nonce" content={nonce} />
      </head>
      <body className={inter.className}>
        <SessionProvider session={session}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
