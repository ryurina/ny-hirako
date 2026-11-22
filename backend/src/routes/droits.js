import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Validateur, idDepuisParams, pagination, motifLike } from '../utils/validation.js';

// ---------------------------------------------------------------------
// Droits perçus par ayant droit : /api/gestion/droits (administrateurs)
// ---------------------------------------------------------------------
export const droitsRoutes = Router();
droitsRoutes.use(requireAuth, requireRole('ADMIN'));

// GET /api/gestion/droits/personnes?q=&page=&limit=  : classement par total de droits
droitsRoutes.get(
  '/personnes',
  asyncHandler(async (req, res) => {
    const v = new Validateur();
    const q = v.texte(req.query.q, 'q', { max: 100 });
    v.lever();

    const params = [];
    let filtre = '';
    if (q) {
      params.push(motifLike(q));
      filtre = `AND v.nom_affiche ILIKE $1`;
    }

    const { page, limit } = pagination(req.query);
    const base = `FROM vue_droits_par_personne v
                  JOIN personne p ON p.id_personne = v.id_personne
                  WHERE p.statut = 'VALIDE' ${filtre}`;

    const { rows: comptage } = await query(`SELECT COUNT(*)::int AS n ${base}`, params);
    const { rows } = await query(
      `SELECT v.id_personne, v.nom_affiche, v.nb_oeuvres, v.total_droits
       ${base}
       ORDER BY v.total_droits DESC, v.nom_affiche
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    res.json({ data: rows, total: comptage[0].n, page, limit });
  }),
);

// GET /api/gestion/droits/personnes/:id : détail des droits, diffusion par diffusion
droitsRoutes.get(
  '/personnes/:id',
  asyncHandler(async (req, res) => {
    const id = idDepuisParams(req.params.id);

    const { rows: resume } = await query(
      'SELECT id_personne, nom_affiche, nb_oeuvres, total_droits FROM vue_droits_par_personne WHERE id_personne = $1',
      [id],
    );
    if (!resume[0]) throw new HttpError(404, 'Personne introuvable');

    const { rows: lignes } = await query(
      `SELECT d.id_diffusion, d.date_diffusion, o.titre AS titre_oeuvre,
              dif.nom AS nom_diffuseur, r.libelle AS role, c.part_pct, rep.montant
       FROM contribution c
       JOIN repartition rep ON rep.id_contribution = c.id_contribution
       JOIN diffusion d     ON d.id_diffusion = rep.id_diffusion
       JOIN oeuvre o        ON o.id_oeuvre = d.id_oeuvre
       JOIN diffuseur dif   ON dif.id_diffuseur = d.id_diffuseur
       JOIN role r          ON r.id_role = c.id_role
       WHERE c.id_personne = $1
       ORDER BY d.date_diffusion DESC, d.id_diffusion DESC`,
      [id],
    );

    res.json({ ...resume[0], lignes });
  }),
);

// ---------------------------------------------------------------------
// Statistiques du tableau de bord : /api/gestion/statistiques (modérateurs et administrateurs)
// Les chiffres liés à l'argent et aux diffusions sont réservés aux administrateurs.
// ---------------------------------------------------------------------
export const statistiquesRoutes = Router();
statistiquesRoutes.use(requireAuth, requireRole('ADMIN', 'MODERATEUR'));

statistiquesRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM oeuvre   WHERE statut = 'VALIDE')     AS oeuvres_validees,
        (SELECT COUNT(*)::int FROM oeuvre   WHERE statut = 'EN_ATTENTE') AS oeuvres_en_attente,
        (SELECT COUNT(*)::int FROM personne WHERE statut = 'VALIDE')     AS personnes_validees,
        (SELECT COUNT(*)::int FROM personne WHERE statut = 'EN_ATTENTE') AS personnes_en_attente,
        (SELECT COUNT(*)::int FROM diffuseur)                            AS diffuseurs,
        (SELECT COUNT(*)::int FROM diffusion)                            AS diffusions,
        (SELECT COALESCE(SUM(montant_total), 0) FROM diffusion)          AS montant_total_diffusions`);

    const stats = rows[0];
    if (req.user.role !== 'ADMIN') {
      stats.diffuseurs = null;
      stats.diffusions = null;
      stats.montant_total_diffusions = null;
    }
    res.json(stats);
  }),
);
