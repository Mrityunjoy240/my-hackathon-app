import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, Link } from '@/i18n/routing';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI College Assistant",
  description: "A scalable AI assistant for college students.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <NextIntlClientProvider messages={messages}>
          <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                <div className="flex items-center gap-8">
                  <Link href="/" className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                    AI College Assistant
                  </Link>
                  <nav className="hidden md:flex items-center gap-6">
                    <Link href="/" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
                      Home
                    </Link>
                    <Link href="/chat" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
                      Chat
                    </Link>
                    <Link href="/upload" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
                      Upload
                    </Link>
                    <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">
                      Dashboard
                    </Link>
                  </nav>
                </div>
                <div className="flex items-center gap-4">
                  {/* Locale Switcher placeholder */}
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{locale}</span>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
