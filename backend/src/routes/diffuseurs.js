import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Validateur, idDepuisParams, pagination, motifLike } from '../utils/validation.js';

const TYPES = ['RADIO', 'TV', 'SALLE', 'EVENEMENT'];

const router = Router();
// Réservé aux administrateurs : ces données alimentent le calcul des droits
router.use(requireAuth, requireRole('ADMIN'));

const selectDiffuseurs = (where = '') => `
  SELECT d.id_diffuseur, d.nom, d.type, d.ville,
         COUNT(di.id_diffusion)::int               AS nb_diffusions,
         COALESCE(SUM(di.montant_total), 0)        AS total_diffusions
  FROM diffuseur d
  LEFT JOIN diffusion di ON di.id_diffuseur = d.id_diffuseur
  ${where}
  GROUP BY d.id_diffuseur`;

async function detailDiffuseur(id) {
  const { rows } = await query(selectDiffuseurs('WHERE d.id_diffuseur = $1'), [id]);
  if (!rows[0]) throw new HttpError(404, 'Diffuseur introuvable');
  return rows[0];
}

function validerDiffuseur(corps) {
  const v = new Validateur();
  const c = corps ?? {};
  const donnees = {
    nom: v.texte(c.nom, 'nom', { requis: true, max: 150 }),
    type: v.enumeration(c.type, 'type', TYPES, { requis: true }),
    ville: v.texte(c.ville, 'ville', { requis: true, max: 100 }),
  };
  v.lever();
  return donnees;
}

// GET /api/gestion/diffuseurs?q=&type=&ville=&page=&limit=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const v = new Validateur();
    const q = v.texte(req.query.q, 'q', { max: 100 });
    const type = v.enumeration(req.query.type, 'type', TYPES);
    const ville = v.texte(req.query.ville, 'ville', { max: 100 });
    v.lever();

    const conditions = [];
    const params = [];
    const ajouter = (valeur) => {
      params.push(valeur);
      return `$${params.length}`;
    };
    if (q) conditions.push(`d.nom ILIKE ${ajouter(motifLike(q))}`);
    if (type) conditions.push(`d.type = ${ajouter(type)}`);
    if (ville) conditions.push(`d.ville ILIKE ${ajouter(motifLike(ville))}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { page, limit } = pagination(req.query);
    const { rows: comptage } = await query(`SELECT COUNT(*)::int AS n FROM diffuseur d ${where}`, params);
    const { rows } = await query(
      `${selectDiffuseurs(where)}
       ORDER BY lower(d.nom), d.id_diffuseur
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    res.json({ data: rows, total: comptage[0].n, page, limit });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await detailDiffuseur(idDepuisParams(req.params.id)));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const d = validerDiffuseur(req.body);
    const { rows } = await query(
      'INSERT INTO diffuseur (nom, type, ville) VALUES ($1, $2, $3) RETURNING id_diffuseur',
      [d.nom, d.type, d.ville],
    );
    res.status(201).json(await detailDiffuseur(rows[0].id_diffuseur));
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idDepuisParams(req.params.id);
    const d = validerDiffuseur(req.body);
    const { rowCount } = await query(
      'UPDATE diffuseur SET nom = $1, type = $2, ville = $3 WHERE id_diffuseur = $4',
      [d.nom, d.type, d.ville, id],
    );
    if (rowCount === 0) throw new HttpError(404, 'Diffuseur introuvable');
    res.json(await detailDiffuseur(id));
  }),
);

// Refusé (409) si le diffuseur a des diffusions
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM diffuseur WHERE id_diffuseur = $1', [
      idDepuisParams(req.params.id),
    ]);
    if (rowCount === 0) throw new HttpError(404, 'Diffuseur introuvable');
    res.status(204).end();
  }),
);

export default router;
