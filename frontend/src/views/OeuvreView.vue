<script setup>
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api/client.js';
import { formaterDuree } from '../utils/format.js';

const props = defineProps({ id: { type: String, required: true } });

const oeuvre = ref(null);
const chargement = ref(true);
const erreur = ref('');

async function charger() {
  chargement.value = true;
  erreur.value = '';
  oeuvre.value = null;
  try {
    oeuvre.value = await api(`/oeuvres/${props.id}`);
  } catch (e) {
    erreur.value = e.status === 404 ? 'Cette œuvre est introuvable ou n’est pas encore validée.' : e.message;
  } finally {
    chargement.value = false;
  }
}

watch(() => props.id, charger, { immediate: true });
</script>

<template>
  <div class="container page">
    <p class="fil"><RouterLink :to="{ name: 'accueil' }">← Retour au répertoire</RouterLink></p>

    <div v-if="chargement" class="carte squelette" aria-busy="true" aria-label="Chargement">
      <span class="s-ligne s-titre"></span>
      <span class="s-ligne"></span>
      <span class="s-ligne s-court"></span>
    </div>

    <p v-else-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

    <template v-else-if="oeuvre">
      <header class="carte fiche-tete">
        <p class="surtitre">{{ oeuvre.genre ?? 'Œuvre musicale' }}</p>
        <h1>{{ oeuvre.titre }}</h1>
        <ul class="infos">
          <li>Année · <strong>{{ oeuvre.annee_creation ?? 'inconnue' }}</strong></li>
          <li>Durée · <strong>{{ formaterDuree(oeuvre.duree_sec) }}</strong></li>
        </ul>
      </header>

      <section class="carte">
        <h2>Répartition des droits</h2>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rôle</th>
                <th>Ayant droit</th>
                <th>Part</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in oeuvre.contributions" :key="c.id_contribution">
                <td>{{ c.role }}</td>
                <td>{{ c.nom_affiche }}</td>
                <td>
                  <div class="part-cellule">
                    <strong>{{ c.part_pct }} %</strong>
                    <div class="barre" aria-hidden="true"><span :style="{ width: c.part_pct + '%' }"></span></div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
