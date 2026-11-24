import { ref } from 'vue';
import { api } from '../api/client.js';

// Chiffres du tableau de bord, partagés entre la barre latérale (pastilles) et les pages
const stats = ref(null);

export function useStats() {
  async function rafraichir() {
    try {
      stats.value = await api('/gestion/statistiques');
    } catch {
      /* les pages affichent leurs propres erreurs */
    }
  }
  return { stats, rafraichir };
}
