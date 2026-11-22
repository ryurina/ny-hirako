import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import { oeuvresPubliques, oeuvresGestion } from './routes/oeuvres.js';
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

app.use(notFound);
app.use(errorHandler);

export default app;
