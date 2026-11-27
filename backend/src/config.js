// Configuration lue depuis les variables d'environnement (fichier .env)
for (const nom of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[nom]) {
    throw new Error(`Variable d'environnement manquante : ${nom} (voir backend/.env.example)`);
  }
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  // Certificat CA d'une base hébergée (contenu du fichier .pem ; « \n » accepté pour les sauts de ligne)
  databaseCa: process.env.DATABASE_CA ? process.env.DATABASE_CA.replace(/\\n/g, '\n') : undefined,
  // Nombre maximal de connexions du pool (à réduire sur un hébergement serverless)
  poolMax: Number(process.env.DATABASE_POOL_MAX) || 10,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim()),
};
