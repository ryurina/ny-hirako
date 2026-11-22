import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// GET /api/roles : liste des rôles (utile pour le formulaire de soumission)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT id_role, libelle FROM role ORDER BY id_role');
    res.json({ data: rows });
  }),
);

export default router;
