import { Router } from 'express';
import { query, transaction } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Validateur, idDepuisParams, pagination } from '../utils/validation.js';

const router = Router();
// Réservé aux administrateurs : argent et répartition des droits
router.use(requireAuth, requireRole('ADMIN'));

const selectDiffusions = (where = '') => `
  SELECT d.id_diffusion, d.date_diffusion, d.montant_total,
         o.id_oeuvre, o.titre AS titre_oeuvre,
         dif.id_diffuseur, dif.nom AS nom_diffuseur, dif.type AS type_diffuseur, dif.ville AS ville_diffuseur,
         COALESCE((SELECT SUM(r.montant) FROM repartition r WHERE r.id_diffusion = d.id_diffusion), 0) AS total_reparti
  FROM diffusion d
  JOIN oeuvre    o   ON o.id_oeuvre = d.id_oeuvre
  JOIN diffuseur dif ON dif.id_diffuseur = d.id_diffuseur
  ${where}`;

// Diffusion avec le détail de sa répartition (une ligne par contribution)
async function detailDiffusion(id) {
  const { rows } = await query(selectDiffusions('WHERE d.id_diffusion = $1'), [id]);
  if (!rows[0]) throw new HttpError(404, 'Diffusion introuvable');

  const { rows: repartition } = await query(
    `SELECT p.id_personne,
            COALESCE(p.nom_artiste, TRIM(COALESCE(p.prenom, '') || ' ' || p.nom)) AS nom_affiche,
            r.libelle AS role,
            c.part_pct,
            rep.montant
     FROM repartition rep
     JOIN contribution c ON c.id_contribution = rep.id_contribution
     JOIN personne p     ON p.id_personne = c.id_personne
     JOIN role r         ON r.id_role = c.id_role
     WHERE rep.id_diffusion = $1
     ORDER BY r.id_role, c.id_contribution`,
    [id],
  );
  return { ...rows[0], repartition };
}

function validerDiffusion(corps, { creation }) {
  const v = new Validateur();
  const c = corps ?? {};
  const donnees = {
    id_diffuseur: v.entier(c.id_diffuseur, 'id_diffuseur', { requis: true, min: 1 }),
    date_diffusion: v.date(c.date_diffusion, 'date_diffusion', { requis: true }),
    montant_total: v.montant(c.montant_total, 'montant_total', { requis: true }),
  };
  if (creation) {
    donnees.id_oeuvre = v.uuid(c.id_oeuvre, 'id_oeuvre', { requis: true });
  } else {
    donnees.id_oeuvre = v.uuid(c.id_oeuvre, 'id_oeuvre'); // facultatif, non modifiable
  }
  v.lever();
  return donnees;
}

// GET /api/gestion/diffusions?id_oeuvre=&id_diffuseur=&date_debut=&date_fin=&page=&limit=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const v = new Validateur();
    const filtres = {
      id_oeuvre: v.uuid(req.query.id_oeuvre, 'id_oeuvre'),
      id_diffuseur: v.entier(req.query.id_diffuseur, 'id_diffuseur', { min: 1 }),
      date_debut: v.date(req.query.date_debut, 'date_debut'),
      date_fin: v.date(req.query.date_fin, 'date_fin'),
    };
    v.lever();

    const conditions = [];
    const params = [];
    const ajouter = (valeur) => {
      params.push(valeur);
      return `$${params.length}`;
    };
    if (filtres.id_oeuvre) conditions.push(`d.id_oeuvre = ${ajouter(filtres.id_oeuvre)}`);
    if (filtres.id_diffuseur) conditions.push(`d.id_diffuseur = ${ajouter(filtres.id_diffuseur)}`);
    if (filtres.date_debut) conditions.push(`d.date_diffusion >= ${ajouter(filtres.date_debut)}`);
    if (filtres.date_fin) conditions.push(`d.date_diffusion <= ${ajouter(filtres.date_fin)}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { page, limit } = pagination(req.query);
    const { rows: comptage } = await query(`SELECT COUNT(*)::int AS n FROM diffusion d ${where}`, params);
    const { rows } = await query(
      `${selectDiffusions(where)}
       ORDER BY d.date_diffusion DESC, d.id_diffusion DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    res.json({ data: rows, total: comptage[0].n, page, limit });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await detailDiffusion(idDepuisParams(req.params.id)));
  }),
);

// POST /api/gestion/diffusions : enregistre la diffusion ET calcule la répartition des droits.
// Tout se passe dans une transaction : si l'œuvre n'est pas validée, rien n'est créé (422).
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const d = validerDiffusion(req.body, { creation: true });

    const id = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO diffusion (id_oeuvre, id_diffuseur, date_diffusion, montant_total)
         VALUES ($1, $2, $3, $4)
         RETURNING id_diffusion`,
        [d.id_oeuvre, d.id_diffuseur, d.date_diffusion, d.montant_total],
      );
      await client.query('SELECT calculer_repartition($1)', [rows[0].id_diffusion]);
      return rows[0].id_diffusion;
    });

    res.status(201).json(await detailDiffusion(id));
  }),
);

// PUT /api/gestion/diffusions/:id : modifie diffuseur, date ou montant, puis recalcule la répartition.
// L'œuvre n'est pas modifiable (la répartition en dépend) : supprimer et recréer la diffusion.
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idDepuisParams(req.params.id);
    const d = validerDiffusion(req.body, { creation: false });

    await transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT id_oeuvre FROM diffusion WHERE id_diffusion = $1 FOR UPDATE',
        [id],
      );
      if (!rows[0]) throw new HttpError(404, 'Diffusion introuvable');
      if (d.id_oeuvre !== null && d.id_oeuvre !== rows[0].id_oeuvre) {
        throw new HttpError(
          400,
          "L'œuvre d'une diffusion n'est pas modifiable : supprimez la diffusion puis recréez-la",
        );
      }

      await client.query(
        `UPDATE diffusion
         SET id_diffuseur = $1, date_diffusion = $2, montant_total = $3
         WHERE id_diffusion = $4`,
        [d.id_diffuseur, d.date_diffusion, d.montant_total, id],
      );
      await client.query('SELECT calculer_repartition($1)', [id]);
    });

    res.json(await detailDiffusion(id));
  }),
);

// POST /api/gestion/diffusions/:id/repartition : recalcule la répartition
router.post(
  '/:id/repartition',
  asyncHandler(async (req, res) => {
    const id = idDepuisParams(req.params.id);
    await detailDiffusion(id); // 404 si la diffusion n'existe pas
    await query('SELECT calculer_repartition($1)', [id]);
    res.json(await detailDiffusion(id));
  }),
);

// DELETE /api/gestion/diffusions/:id : supprime aussi sa répartition (ON DELETE CASCADE)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query('DELETE FROM diffusion WHERE id_diffusion = $1', [
      idDepuisParams(req.params.id),
    ]);
    if (rowCount === 0) throw new HttpError(404, 'Diffusion introuvable');
    res.status(204).end();
  }),
);

export default router;
