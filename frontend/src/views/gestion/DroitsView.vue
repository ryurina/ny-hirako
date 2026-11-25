<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../../api/client.js';
import PaginationBar from '../../components/PaginationBar.vue';
import { formaterAriary } from '../../utils/format.js';

const q = ref('');
const page = ref(1);
const limit = 10;

const lignes = ref([]);
const total = ref(0);
const chargement = ref(true);
const erreur = ref('');

let minuteur = null;
let numeroRequete = 0;

// La barre de chaque ligne est proportionnelle au plus gros montant de la page
const maximum = computed(() => Math.max(1, ...lignes.value.map((l) => Number(l.total_droits))));
const largeur = (l) => Math.round((Number(l.total_droits) / maximum.value) * 100);

async function charger() {
  const numero = ++numeroRequete;
  chargement.value = true;
  try {
    const donnees = await api('/gestion/droits/personnes', { params: { q: q.value.trim(), page: page.value, limit } });
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
  <p class="discret intro">Classement des ayants droit validés par total de droits perçus, toutes diffusions confondues.</p>

  <div class="barre-outils">
    <input v-model="q" type="search" placeholder="Rechercher un ayant droit…" aria-label="Rechercher" />
  </div>

  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

  <section class="carte carte-table">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Rang</th>
            <th>Ayant droit</th>
            <th class="droite">Œuvres</th>
            <th>Droits perçus</th>
            <th class="droite"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="chargement && lignes.length === 0">
            <td colspan="5" class="discret">Chargement…</td>
          </tr>
          <tr v-else-if="lignes.length === 0">
            <td colspan="5" class="discret">Aucun ayant droit ne correspond à cette recherche.</td>
          </tr>
          <tr v-for="(l, i) in lignes" :key="l.id_personne">
            <td><span class="rang">{{ (page - 1) * limit + i + 1 }}</span></td>
            <td>
              <RouterLink class="lien-titre" :to="{ name: 'gestion-droit', params: { id: l.id_personne } }">{{ l.nom_affiche }}</RouterLink>
            </td>
            <td class="droite">{{ l.nb_oeuvres }}</td>
            <td>
              <div class="part-cellule">
                <strong class="montant-barre">{{ formaterAriary(l.total_droits) }}</strong>
                <div class="barre" aria-hidden="true"><span :style="{ width: largeur(l) + '%' }"></span></div>
              </div>
            </td>
            <td>
              <div class="actions-table">
                <RouterLink class="btn btn-petit" :to="{ name: 'gestion-droit', params: { id: l.id_personne } }">Détail</RouterLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <PaginationBar v-model:page="page" :limit="limit" :total="total" />
</template>
