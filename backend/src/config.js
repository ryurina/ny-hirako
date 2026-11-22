// Configuration lue depuis les variables d'environnement (fichier .env)
for (const nom of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[nom]) {
    throw new Error(`Variable d'environnement manquante : ${nom} (voir server/.env.example)`);
  }
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim()),
};
