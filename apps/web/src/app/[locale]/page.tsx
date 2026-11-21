import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FaqSection } from '@/features/marketing/faq-section';
import { FeaturesSection } from '@/features/marketing/features-section';
import { Hero } from '@/features/marketing/hero';
import { LabsSection } from '@/features/marketing/labs-section';
import { PricingSection } from '@/features/marketing/pricing-section';
import { SiteFooter } from '@/features/marketing/site-footer';
import { SiteHeader } from '@/features/marketing/site-header';
import { SubjectsSection } from '@/features/marketing/subjects-section';
import { routing } from '@/i18n/routing';

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader landing />
      <main id="main">
        <Hero />
        <SubjectsSection />
        <LabsSection />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
      </main>
      <SiteFooter />
    </>
  );
}
