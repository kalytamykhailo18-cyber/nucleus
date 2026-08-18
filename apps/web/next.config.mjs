/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Some clients (Chrome address-bar autocomplete, DNS resolvers,
    // older proxies) normalize the request URL with a trailing FQDN
    // dot — origin becomes `app.sensu.com.mx.` while x-forwarded-host
    // stays `app.sensu.com.mx`. Next.js's Server Actions guard rejects
    // the mismatch, surfacing as the cryptic "Application error,
    // Digest: ..." page on /signup. Explicitly allow both spellings.
    serverActions: {
      allowedOrigins: [
        'app.sensu.com.mx',
        'app.sensu.com.mx.',
      ],
    },
  },
  async rewrites() {
    return [
      {
        // Digital Asset Links for the Android TWA. Chrome verifies
        // this URL when launching the app to prove the app-package
        // signing key is authorized for this origin. Backed by the
        // API route so the fingerprint list is env-driven.
        source: '/.well-known/assetlinks.json',
        destination: '/api/well-known/assetlinks',
      },
      {
        // Apple App Site Association — iOS Universal Links + App
        // Clip verification. Fetched by iOS on first launch. Must
        // NOT carry a `.json` extension in the URL path (Apple's
        // fetcher rejects it), so the source path is exactly what
        // Apple asks for and the destination is the extensionless
        // API route.
        source: '/.well-known/apple-app-site-association',
        destination: '/api/well-known/apple-app-site-association',
      },
    ];
  },
};

export default nextConfig;
