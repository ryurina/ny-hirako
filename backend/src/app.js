import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import { oeuvresPubliques, oeuvresGestion } from './routes/oeuvres.js';
import { personnesPubliques, personnesGestion } from './routes/personnes.js';
import rolesRoutes from './routes/roles.js';
import diffuseursRoutes from './routes/diffuseurs.js';
import diffusionsRoutes from './routes/diffusions.js';
import { droitsRoutes, statistiquesRoutes } from './routes/droits.js';
import { notFound, errorHandler } from './middleware/errors.js';
import { asyncHandler } from './utils/asyncHandler.js';

const app = express();

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

// Vérifie que l'API et la base répondent
app.get(
  '/api/health',
  asyncHandler(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok' });
  }),
);

app.use('/api/auth', authRoutes);
app.use('/api/oeuvres', oeuvresPubliques);
app.use('/api/gestion/oeuvres', oeuvresGestion);
app.use('/api/personnes', personnesPubliques);
app.use('/api/gestion/personnes', personnesGestion);
app.use('/api/roles', rolesRoutes);
app.use('/api/gestion/diffuseurs', diffuseursRoutes);
app.use('/api/gestion/diffusions', diffusionsRoutes);
app.use('/api/gestion/droits', droitsRoutes);
app.use('/api/gestion/statistiques', statistiquesRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
