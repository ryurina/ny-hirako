import app from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const serveur = app.listen(config.port, () => {
  console.log(`API ny-hirako disponible sur http://localhost:${config.port}`);
});

// Arrêt propre (Ctrl+C) : on ferme le serveur puis les connexions à la base
process.on('SIGINT', () => {
  serveur.close(async () => {
    await pool.end();
    process.exit(0);
  });
});
