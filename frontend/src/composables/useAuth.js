import { ref, computed } from 'vue';
import { api, getToken, setToken, hooks } from '../api/client.js';

const CLE_UTILISATEUR = 'nyhirako_utilisateur';

function lireUtilisateur() {
  try {
    return JSON.parse(localStorage.getItem(CLE_UTILISATEUR) ?? 'null');
  } catch {
    return null;
  }
}

// État partagé par toute l'application
const utilisateur = ref(getToken() ? lireUtilisateur() : null);

function memoriser(valeur) {
  utilisateur.value = valeur;
  try {
    if (valeur) localStorage.setItem(CLE_UTILISATEUR, JSON.stringify(valeur));
    else localStorage.removeItem(CLE_UTILISATEUR);
  } catch {
    /* stockage indisponible */
  }
}

hooks.onUnauthorized = () => memoriser(null);

export function useAuth() {
  async function connecter(email, motDePasse) {
    const donnees = await api('/auth/login', { method: 'POST', body: { email, password: motDePasse } });
    setToken(donnees.token);
    memoriser(donnees.user);
  }

  function deconnecter() {
    setToken(null);
    memoriser(null);
  }

  return {
    utilisateur,
    estConnecte: computed(() => utilisateur.value !== null),
    estAdmin: computed(() => utilisateur.value?.role === 'ADMIN'),
    connecter,
    deconnecter,
  };
}
