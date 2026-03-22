import { getTranslations } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';

export default function IndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return <HomePage params={params} />;
}

async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  
  const t = await getTranslations('Index');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">{t('title')}</h1>
      <p className="mt-4 text-xl">{t('welcome')}</p>
    </main>
  );
}
