// Transmet les erreurs des routes asynchrones au gestionnaire d'erreurs d'Express
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
