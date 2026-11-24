<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../../api/client.js';
import { changerStatutPersonne } from '../../api/gestion.js';
import { useStats } from '../../composables/useStats.js';
import PaginationBar from '../../components/PaginationBar.vue';
import StatutBadge from '../../components/StatutBadge.vue';
import { nomPersonne, libelleType } from '../../utils/format.js';

const route = useRoute();
const router = useRouter();
const { stats, rafraichir } = useStats();

const ONGLETS = [
  { valeur: 'EN_ATTENTE', libelle: 'En attente' },
  { valeur: 'VALIDE', libelle: 'Validés' },
  { valeur: 'REJETE', libelle: 'Rejetés' },
  { valeur: 'TOUTES', libelle: 'Tous' },
];
const statut = computed(() => (ONGLETS.some((o) => o.valeur === route.query.statut) ? route.query.statut : 'EN_ATTENTE'));

const q = ref('');
const type = ref('');
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
    const donnees = await api('/gestion/personnes', {
      params: {
        statut: statut.value === 'TOUTES' ? '' : statut.value,
        q: q.value.trim(),
        type: type.value,
        page: page.value,
        limit,
      },
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

async function traiter(personne, nouveauStatut) {
  enAction.value = personne.id_personne;
  erreur.value = '';
  info.value = '';
  try {
    await changerStatutPersonne(personne.id_personne, nouveauStatut);
    info.value = `${nomPersonne(personne)} : ${nouveauStatut === 'VALIDE' ? 'ayant droit validé' : 'ayant droit rejeté'}.`;
    await Promise.all([charger(), rafraichir()]);
  } catch (e) {
    erreur.value = `${nomPersonne(personne)} : ${e.message}`;
  } finally {
    enAction.value = null;
  }
}

watch(statut, () => {
  page.value = 1;
  info.value = '';
  charger();
});
watch([q, type], () => {
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
      <span v-if="o.valeur === 'EN_ATTENTE' && stats?.personnes_en_attente" class="compteur-onglet">{{ stats.personnes_en_attente }}</span>
    </button>
  </div>

  <div class="barre-outils">
    <input v-model="q" type="search" placeholder="Rechercher un nom ou un nom d’artiste…" aria-label="Rechercher" />
    <select v-model="type" aria-label="Type de personne" class="select-court">
      <option value="">Tous les types</option>
      <option value="PHYSIQUE">Personnes physiques</option>
      <option value="MORALE">Personnes morales</option>
    </select>
  </div>

  <p v-if="info" class="alerte alerte-succes" role="status">{{ info }}</p>
  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

  <section class="carte carte-table">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Ayant droit</th>
            <th>Type</th>
            <th>Œuvres</th>
            <th>Statut</th>
            <th class="droite">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="chargement && lignes.length === 0">
            <td colspan="5" class="discret">Chargement…</td>
          </tr>
          <tr v-else-if="lignes.length === 0">
            <td colspan="5" class="discret">Aucun ayant droit dans cette catégorie.</td>
          </tr>
          <tr v-for="p in lignes" :key="p.id_personne">
            <td>
              <RouterLink class="lien-titre" :to="{ name: 'gestion-personne', params: { id: p.id_personne } }">{{ nomPersonne(p) }}</RouterLink>
              <div class="discret petit">
                {{ p.nom_artiste ? [p.prenom, p.nom].filter(Boolean).join(' ') : '' }}{{ p.nom_artiste && p.ville ? ' · ' : '' }}{{ p.ville }}
              </div>
            </td>
            <td>{{ libelleType(p.type) }}</td>
            <td>{{ p.nb_oeuvres }}</td>
            <td><StatutBadge :statut="p.statut" /></td>
            <td>
              <div class="actions-table">
                <button
                  v-if="p.statut !== 'VALIDE'"
                  type="button"
                  class="btn btn-petit btn-succes"
                  :disabled="enAction === p.id_personne"
                  @click="traiter(p, 'VALIDE')"
                >
                  Valider
                </button>
                <button
                  v-if="p.statut === 'EN_ATTENTE'"
                  type="button"
                  class="btn btn-petit"
                  :disabled="enAction === p.id_personne"
                  @click="traiter(p, 'REJETE')"
                >
                  Rejeter
                </button>
                <RouterLink class="btn btn-petit" :to="{ name: 'gestion-personne', params: { id: p.id_personne } }">Voir</RouterLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <PaginationBar v-model:page="page" :limit="limit" :total="total" />
</template>
