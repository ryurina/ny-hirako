import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from './errors.js';

// Vérifie le jeton « Authorization: Bearer <jeton> » et place l'utilisateur dans req.user
export function requireAuth(req, res, next) {
  const [schema, jeton] = (req.headers.authorization ?? '').split(' ');
  if (schema !== 'Bearer' || !jeton) {
    return next(new HttpError(401, 'Authentification requise'));
  }
  try {
    const charge = jwt.verify(jeton, config.jwtSecret);
    req.user = { id: Number(charge.sub), email: charge.email, role: charge.role };
    return next();
  } catch {
    return next(new HttpError(401, 'Jeton invalide ou expiré'));
  }
}

// Restreint une route à certains rôles : requireRole('ADMIN') ou requireRole('ADMIN', 'MODERATEUR')
export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'Accès interdit'));
