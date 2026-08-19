/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shopify/polaris'],
  env: {
    SHOPIFY_APP_URL: 'https://magenta-piroshki-22a056.netlify.app',
    SCOPES: 'write_metaobject_definitions,write_metaobjects,write_products',
    SHOPIFY_API_KEY: '015d247c50edff1cc10be4e8a63e43b8',
    NEXT_PUBLIC_SHOPIFY_API_KEY: '015d247c50edff1cc10be4e8a63e43b8',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors https://*.myshopify.com https://admin.shopify.com 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
