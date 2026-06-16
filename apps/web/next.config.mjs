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
};

export default nextConfig;
