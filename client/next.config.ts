import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@repo/shared'],
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    }];
  },
};

export default createNextIntlPlugin()(config);
