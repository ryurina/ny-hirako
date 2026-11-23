// Client HTTP de l'API : ajoute le jeton JWT et transforme les erreurs en ApiError
const BASE = '/api';
const CLE_JETON = 'nyhirako_jeton';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Fonctions appelées par le reste de l'application (par exemple : jeton expiré)
export const hooks = { onUnauthorized: null };

export function getToken() {
  try {
    return localStorage.getItem(CLE_JETON);
  } catch {
    return null;
  }
}

export function setToken(jeton) {
  try {
    if (jeton) localStorage.setItem(CLE_JETON, jeton);
    else localStorage.removeItem(CLE_JETON);
  } catch {
    /* stockage indisponible : on continue sans mémoriser */
  }
}

function composerMessage(donnees, status) {
  if (!donnees?.error) return `Erreur ${status}`;
  if (Array.isArray(donnees.details) && donnees.details.length > 0) {
    const detail = donnees.details.map((d) => `${d.champ} : ${d.message}`).join(' ; ');
    return `${donnees.error} (${detail})`;
  }
  return donnees.error;
}

export async function api(chemin, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + chemin, window.location.origin);
  for (const [cle, valeur] of Object.entries(params ?? {})) {
    if (valeur !== '' && valeur !== null && valeur !== undefined) url.searchParams.set(cle, valeur);
  }

  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const jeton = getToken();
  if (jeton) headers.Authorization = `Bearer ${jeton}`;

  let reponse;
  try {
    reponse = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Impossible de joindre l'API : le serveur est-il démarré ?");
  }

  if (reponse.status === 204) return null;
  const donnees = await reponse.json().catch(() => null);

  if (!reponse.ok) {
    // Jeton expiré ou invalide : on déconnecte (sauf pendant la connexion elle-même)
    if (reponse.status === 401 && jeton) {
      setToken(null);
      hooks.onUnauthorized?.();
    }
    throw new ApiError(reponse.status, composerMessage(donnees, reponse.status), donnees?.details);
  }
  return donnees;
}
