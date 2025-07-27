console.log('=== Environment Variables Debug ===');
console.log('MONGO_URI:', process.env.MONGO_URI ? 'SET' : 'NOT SET');
console.log('MONGO_USER:', process.env.MONGO_USER ? 'SET' : 'NOT SET');
console.log('MONGO_PASSWORD:', process.env.MONGO_PASSWORD ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('MEILI_MASTER_KEY:', process.env.MEILI_MASTER_KEY ? 'SET' : 'NOT SET');
console.log('All env vars:', Object.keys(process.env).filter(key => key.includes('MONGO') || key.includes('JWT') || key.includes('MEILI')));
console.log('=== End Debug ==='); 