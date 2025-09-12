  const allowedOrigins = [
    ...Array.from({ length: 10 }, (_, i) => `http://localhost:300${i}`),
    ...Array.from({ length: 10 }, (_, i) => `https://localhost:300${i}`),
    'http://localhost:3080',
    'https://localhost:3080',
    'https://scalewize-website.vercel.app',
    'https://henly-website.vercel.app',
    'https://henly.ai',
    'https://www.henly.ai',
    'https://scalewize-production-chatbot-production.up.railway.app',
    'https://henly-chatbot-production.up.railway.app',
  ];
