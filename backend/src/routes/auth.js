import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login  { email, password }  ->  { token, user }
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new HttpError(400, 'Email et mot de passe obligatoires');
    }

    const { rows } = await query(
      `SELECT id_utilisateur, email, mot_de_passe_hash, role_utilisateur
       FROM utilisateur WHERE lower(email) = lower($1)`,
      [email],
    );
    const utilisateur = rows[0];

    // Même message que l'email soit inconnu ou le mot de passe faux : on ne révèle pas lequel
    const valide = utilisateur && (await bcrypt.compare(password, utilisateur.mot_de_passe_hash));
    if (!valide) {
      throw new HttpError(401, 'Identifiants incorrects');
    }

    const token = jwt.sign(
      { email: utilisateur.email, role: utilisateur.role_utilisateur },
      config.jwtSecret,
      { subject: String(utilisateur.id_utilisateur), expiresIn: config.jwtExpiresIn },
    );

    res.json({
      token,
      user: {
        id: utilisateur.id_utilisateur,
        email: utilisateur.email,
        role: utilisateur.role_utilisateur,
      },
    });
  }),
);

// GET /api/auth/me  ->  utilisateur connecté
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
