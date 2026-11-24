<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../../api/client.js';
import { changerStatutOeuvre } from '../../api/gestion.js';
import { useStats } from '../../composables/useStats.js';
import PaginationBar from '../../components/PaginationBar.vue';
import StatutBadge from '../../components/StatutBadge.vue';
import { formaterDate } from '../../utils/format.js';

const route = useRoute();
const router = useRouter();
const { stats, rafraichir } = useStats();

const ONGLETS = [
  { valeur: 'EN_ATTENTE', libelle: 'En attente' },
  { valeur: 'VALIDE', libelle: 'Validées' },
  { valeur: 'REJETE', libelle: 'Rejetées' },
  { valeur: 'TOUTES', libelle: 'Toutes' },
];
// L'onglet actif est dans l'adresse (?statut=…) : les liens du tableau de bord fonctionnent
const statut = computed(() => (ONGLETS.some((o) => o.valeur === route.query.statut) ? route.query.statut : 'EN_ATTENTE'));

const q = ref('');
const page = ref(1);
const limit = 10;

const lignes = ref([]);
const total = ref(0);
const chargement = ref(true);
const erreur = ref('');
const info = ref('');
const enAction = ref(null);

let minuteur = null;
let numeroRequete = 0;

async function charger() {
  const numero = ++numeroRequete;
  chargement.value = true;
  try {
    const donnees = await api('/gestion/oeuvres', {
      params: { statut: statut.value === 'TOUTES' ? '' : statut.value, q: q.value.trim(), page: page.value, limit },
    });
    if (numero !== numeroRequete) return;
    lignes.value = donnees.data;
    total.value = donnees.total;
    erreur.value = '';
  } catch (e) {
    if (numero !== numeroRequete) return;
    erreur.value = e.message;
    lignes.value = [];
    total.value = 0;
  } finally {
    if (numero === numeroRequete) chargement.value = false;
  }
}

function choisirOnglet(valeur) {
  router.replace({ query: { ...route.query, statut: valeur } });
}

async function traiter(oeuvre, nouveauStatut) {
  enAction.value = oeuvre.id_oeuvre;
  erreur.value = '';
  info.value = '';
  try {
    await changerStatutOeuvre(oeuvre.id_oeuvre, nouveauStatut);
    info.value = `« ${oeuvre.titre} » : ${nouveauStatut === 'VALIDE' ? 'œuvre validée' : 'œuvre rejetée'}.`;
    await Promise.all([charger(), rafraichir()]);
  } catch (e) {
    erreur.value = `« ${oeuvre.titre} » : ${e.message}`;
  } finally {
    enAction.value = null;
  }
}

const nbAValider = (o) => o.contributions.filter((c) => c.statut_personne !== 'VALIDE').length;

function resumeAyantsDroit(o) {
  const noms = [...new Set(o.contributions.map((c) => c.nom_affiche))];
  return noms.length > 2 ? `${noms.slice(0, 2).join(', ')} +${noms.length - 2}` : noms.join(', ');
}

watch(statut, () => {
  page.value = 1;
  info.value = '';
  charger();
});
watch(q, () => {
  page.value = 1;
  clearTimeout(minuteur);
  minuteur = setTimeout(charger, 300);
});
watch(page, charger);

onMounted(charger);
onBeforeUnmount(() => clearTimeout(minuteur));
</script>

<template>
  <div class="onglets" role="tablist" aria-label="Filtrer par statut">
    <button
      v-for="o in ONGLETS"
      :key="o.valeur"
      type="button"
      role="tab"
      :aria-selected="statut === o.valeur"
      :class="{ actif: statut === o.valeur }"
      @click="choisirOnglet(o.valeur)"
    >
      {{ o.libelle }}
      <span v-if="o.valeur === 'EN_ATTENTE' && stats?.oeuvres_en_attente" class="compteur-onglet">{{ stats.oeuvres_en_attente }}</span>
    </button>
  </div>

  <div class="barre-outils">
    <input v-model="q" type="search" placeholder="Rechercher un titre ou un ayant droit…" aria-label="Rechercher" />
  </div>

  <p v-if="info" class="alerte alerte-succes" role="status">{{ info }}</p>
  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

  <section class="carte carte-table">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Œuvre</th>
            <th>Ayants droit</th>
            <th>Soumission</th>
            <th>Statut</th>
            <th class="droite">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="chargement && lignes.length === 0">
            <td colspan="5" class="discret">Chargement…</td>
          </tr>
          <tr v-else-if="lignes.length === 0">
            <td colspan="5" class="discret">Aucune œuvre dans cette catégorie.</td>
          </tr>
          <tr v-for="o in lignes" :key="o.id_oeuvre">
            <td>
              <RouterLink class="lien-titre" :to="{ name: 'gestion-oeuvre', params: { id: o.id_oeuvre } }">{{ o.titre }}</RouterLink>
              <div class="discret petit">{{ [o.genre, o.annee_creation].filter(Boolean).join(' · ') }}</div>
            </td>
            <td>
              <div>{{ resumeAyantsDroit(o) }}</div>
              <div v-if="o.statut !== 'VALIDE' && nbAValider(o) > 0" class="petit texte-attention">
                {{ nbAValider(o) }} ayant{{ nbAValider(o) > 1 ? 's' : '' }} droit à valider
              </div>
            </td>
            <td>
              <div>{{ formaterDate(o.date_soumission) }}</div>
              <div class="discret petit">{{ o.soumetteur_email ?? 'Saisie interne' }}</div>
            </td>
            <td><StatutBadge :statut="o.statut" /></td>
            <td>
              <div class="actions-table">
                <button
                  v-if="o.statut !== 'VALIDE'"
                  type="button"
                  class="btn btn-petit btn-succes"
                  :disabled="enAction === o.id_oeuvre"
                  @click="traiter(o, 'VALIDE')"
                >
                  Valider
                </button>
                <button
                  v-if="o.statut === 'EN_ATTENTE'"
                  type="button"
                  class="btn btn-petit"
                  :disabled="enAction === o.id_oeuvre"
                  @click="traiter(o, 'REJETE')"
                >
                  Rejeter
                </button>
                <RouterLink class="btn btn-petit" :to="{ name: 'gestion-oeuvre', params: { id: o.id_oeuvre } }">Voir</RouterLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <PaginationBar v-model:page="page" :limit="limit" :total="total" />
</template>
