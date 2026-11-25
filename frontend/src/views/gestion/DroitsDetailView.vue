<script setup>
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../../api/client.js';
import StatCard from '../../components/StatCard.vue';
import { formaterAriary, formaterDate } from '../../utils/format.js';
import { formaterPourcent } from '../../utils/soumission.js';

const props = defineProps({ id: { type: String, required: true } });

const donnees = ref(null);
const chargement = ref(true);
const erreur = ref('');

async function charger() {
  chargement.value = true;
  erreur.value = '';
  donnees.value = null;
  try {
    donnees.value = await api(`/gestion/droits/personnes/${props.id}`);
  } catch (e) {
    erreur.value = e.status === 404 ? 'Cet ayant droit est introuvable.' : e.message;
  } finally {
    chargement.value = false;
  }
}

watch(() => props.id, charger, { immediate: true });
</script>

<template>
  <p class="fil"><RouterLink :to="{ name: 'gestion-droits' }">← Retour au classement</RouterLink></p>

  <div v-if="chargement" class="carte squelette" aria-busy="true" aria-label="Chargement">
    <span class="s-ligne s-titre"></span>
    <span class="s-ligne"></span>
  </div>

  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

  <template v-if="donnees">
    <header class="entete-page">
      <p class="surtitre">Droits perçus</p>
      <h2 class="grand-titre">{{ donnees.nom_affiche }}</h2>
      <p class="fil" style="margin-top: 0.4rem">
        <RouterLink :to="{ name: 'gestion-personne', params: { id: donnees.id_personne } }">Voir la fiche de l’ayant droit</RouterLink>
      </p>
    </header>

    <section class="kpis" aria-label="Résumé">
      <StatCard libelle="Total des droits perçus" :valeur="formaterAriary(donnees.total_droits)" ton="or" />
      <StatCard libelle="Œuvres concernées" :valeur="donnees.nb_oeuvres" />
      <StatCard libelle="Lignes de répartition" :valeur="donnees.lignes.length" />
    </section>

    <section class="carte bloc">
      <h2>Détail par diffusion</h2>
      <p v-if="donnees.lignes.length === 0" class="discret">Aucun droit n’a encore été réparti pour cet ayant droit.</p>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Œuvre</th>
              <th>Diffuseur</th>
              <th>Rôle</th>
              <th class="droite">Part</th>
              <th class="droite">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in donnees.lignes" :key="`${l.id_diffusion}-${l.role}-${i}`">
              <td>{{ formaterDate(l.date_diffusion) }}</td>
              <td>
                <RouterLink :to="{ name: 'gestion-diffusion', params: { id: l.id_diffusion } }">{{ l.titre_oeuvre }}</RouterLink>
              </td>
              <td>{{ l.nom_diffuseur }}</td>
              <td>{{ l.role }}</td>
              <td class="droite">{{ formaterPourcent(Number(l.part_pct)) }} %</td>
              <td class="droite montant">{{ formaterAriary(l.montant) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
