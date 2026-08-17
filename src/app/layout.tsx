import type { Metadata } from 'next';
import './globals.css';
import PolarisAppProvider from '@/components/providers/PolarisAppProvider';

export const metadata: Metadata = {
  title: 'AI Search & Answer Engine Optimizer (GEO/AEO/AIO)',
  description: 'Production-ready Shopify App to audit product catalogs, compute GEO/AEO/AIO scores, and generate automated JSON-LD and content fixes using Gemini AI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="shopify-api-key" content={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || process.env.SHOPIFY_API_KEY || ''} />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" async></script>
      </head>
      <body>
        <PolarisAppProvider>
          {children}
        </PolarisAppProvider>
      </body>
    </html>
  );
}
