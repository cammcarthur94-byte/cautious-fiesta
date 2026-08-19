'use client';

import React, { Suspense, useMemo } from 'react';
import { AppProvider } from '@shopify/polaris';
import enTranslations from '@shopify/polaris/locales/en.json';
import { useSearchParams } from 'next/navigation';

function PolarisAppProviderInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();

  // In Shopify embedded apps, host is passed as a query param
  const host = searchParams.get('host') || '';
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  // App Bridge config — only active when we have a valid host (embedded context)
  const appBridgeConfig = useMemo(() => {
    if (isDemo || !host) return undefined;
    return {
      apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || process.env.SHOPIFY_API_KEY || '',
      host,
      forceRedirect: true,
    };
  }, [host, isDemo]);

  return (
    <AppProvider i18n={enTranslations} {...(appBridgeConfig ? { app: appBridgeConfig } : {})}>
      {children}
    </AppProvider>
  );
}

export default function PolarisAppProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <AppProvider i18n={enTranslations}>
        {children}
      </AppProvider>
    }>
      <PolarisAppProviderInner>{children}</PolarisAppProviderInner>
    </Suspense>
  );
}
