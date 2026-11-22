export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Route introuvable' });
}

// Traduit les erreurs PostgreSQL (contraintes d'intégrité, triggers) en réponses HTTP claires
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corps de la requête : JSON invalide' });
  }

  switch (err.code) {
    case '23505': // unique_violation
      return res.status(409).json({ error: 'Cette valeur existe déjà', contrainte: err.constraint });
    case '23503': // foreign_key_violation
    case '23001': // restrict_violation (ON DELETE RESTRICT)
      return res.status(409).json({
        error: "Opération refusée : cet élément est lié à d'autres données",
        contrainte: err.constraint,
      });
    case '23514': // check_violation : CHECK de table ou exception levée par un trigger
      return res.status(422).json({
        error: err.constraint ? `Contrainte non respectée : ${err.constraint}` : err.message,
        contrainte: err.constraint,
      });
    case '23502': // not_null_violation
      return res.status(400).json({ error: `Champ obligatoire manquant : ${err.column}` });
    case '22P02': // texte invalide (par exemple valeur d'énumération inconnue)
    case '22007':
    case '22003':
    case '22001':
      return res.status(400).json({ error: 'Valeur invalide' });
    default:
      console.error(err);
      return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
