// Actions de modération et de suppression (réservées aux modérateurs et administrateurs)
import { api } from './client.js';

export const changerStatutOeuvre = (id, statut) =>
  api(`/gestion/oeuvres/${id}/statut`, { method: 'PATCH', body: { statut } });

export const changerStatutPersonne = (id, statut) =>
  api(`/gestion/personnes/${id}/statut`, { method: 'PATCH', body: { statut } });

export const supprimerOeuvre = (id) => api(`/gestion/oeuvres/${id}`, { method: 'DELETE' });

export const supprimerPersonne = (id) => api(`/gestion/personnes/${id}`, { method: 'DELETE' });
