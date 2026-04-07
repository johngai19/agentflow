const isDev = process.env.NODE_ENV === 'development';

module.exports = {
  async rewrites() {
    return isDev
      ? [
          {
            // all /api/* calls in dev get forwarded to your backend’s /api/v1/*
            source: '/api/:path*',
            destination: 'http://localhost:8080/api/v1/:path*',
          },
        ]
      : [];
  },
};