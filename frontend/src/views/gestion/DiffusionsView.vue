<script setup>
import { ref, watch, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../../api/client.js';
import PaginationBar from '../../components/PaginationBar.vue';
import { formaterAriary, formaterDate, libelleTypeDiffuseur } from '../../utils/format.js';
import { centimesMontant } from '../../utils/droits.js';

const diffuseurs = ref([]);
const idDiffuseur = ref('');
const dateDebut = ref('');
const dateFin = ref('');
const page = ref(1);
const limit = 10;

const lignes = ref([]);
const total = ref(0);
const chargement = ref(true);
const erreur = ref('');

let numeroRequete = 0;

async function charger() {
  const numero = ++numeroRequete;
  chargement.value = true;
  try {
    const donnees = await api('/gestion/diffusions', {
      params: {
        id_diffuseur: idDiffuseur.value,
        date_debut: dateDebut.value,
        date_fin: dateFin.value,
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

const repartitionComplete = (d) => centimesMontant(d.montant_total) === centimesMontant(d.total_reparti);

function reinitialiser() {
  idDiffuseur.value = '';
  dateDebut.value = '';
  dateFin.value = '';
}

watch([idDiffuseur, dateDebut, dateFin], () => {
  page.value = 1;
  charger();
});
watch(page, charger);

onMounted(async () => {
  charger();
  try {
    diffuseurs.value = (await api('/gestion/diffuseurs', { params: { limit: 100 } })).data;
  } catch {
    /* le filtre par diffuseur sera simplement vide */
  }
});
</script>

<template>
  <div class="barre-outils">
    <select v-model="idDiffuseur" aria-label="Filtrer par diffuseur" class="select-court">
      <option value="">Tous les diffuseurs</option>
      <option v-for="d in diffuseurs" :key="d.id_diffuseur" :value="d.id_diffuseur">{{ d.nom }} ({{ d.ville }})</option>
    </select>
    <label class="filtre-date">
      <span>Du</span>
      <input v-model="dateDebut" type="date" />
    </label>
    <label class="filtre-date">
      <span>au</span>
      <input v-model="dateFin" type="date" />
    </label>
    <button v-if="idDiffuseur || dateDebut || dateFin" type="button" class="btn" @click="reinitialiser">Réinitialiser</button>
    <RouterLink class="btn btn-primaire pousser" :to="{ name: 'gestion-diffusion-nouvelle' }">+ Nouvelle diffusion</RouterLink>
  </div>

  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

  <section class="carte carte-table">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Œuvre</th>
            <th>Diffuseur</th>
            <th class="droite">Montant</th>
            <th>Répartition</th>
            <th class="droite">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="chargement && lignes.length === 0">
            <td colspan="6" class="discret">Chargement…</td>
          </tr>
          <tr v-else-if="lignes.length === 0">
            <td colspan="6" class="discret">Aucune diffusion ne correspond à ces critères.</td>
          </tr>
          <tr v-for="d in lignes" :key="d.id_diffusion">
            <td>{{ formaterDate(d.date_diffusion) }}</td>
            <td>
              <RouterLink class="lien-titre" :to="{ name: 'gestion-oeuvre', params: { id: d.id_oeuvre } }">{{ d.titre_oeuvre }}</RouterLink>
            </td>
            <td>
              <div>{{ d.nom_diffuseur }}</div>
              <div class="discret petit">{{ libelleTypeDiffuseur(d.type_diffuseur) }} · {{ d.ville_diffuseur }}</div>
            </td>
            <td class="droite montant">{{ formaterAriary(d.montant_total) }}</td>
            <td>
              <span class="badge" :class="repartitionComplete(d) ? 'badge-succes' : 'badge-attente'">
                {{ repartitionComplete(d) ? 'Complète' : 'Écart d’arrondi' }}
              </span>
            </td>
            <td>
              <div class="actions-table">
                <RouterLink class="btn btn-petit" :to="{ name: 'gestion-diffusion', params: { id: d.id_diffusion } }">Détail</RouterLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <PaginationBar v-model:page="page" :limit="limit" :total="total" />
</template>
