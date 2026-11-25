<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../../api/client.js';
import OeuvrePicker from '../../components/OeuvrePicker.vue';
import { centimesMontant, calculerRepartition, formaterCentimes } from '../../utils/droits.js';
import { formaterPourcent } from '../../utils/soumission.js';

const router = useRouter();

const oeuvre = ref(null);
const idDiffuseur = ref('');
const date = ref(new Date().toLocaleDateString('sv-SE')); // AAAA-MM-JJ, heure locale
const montant = ref('');

const diffuseurs = ref([]);
const erreur = ref('');
const envoi = ref(false);

const montantCentimes = computed(() => centimesMontant(montant.value));
const peutEnvoyer = computed(
  () => oeuvre.value !== null && idDiffuseur.value !== '' && date.value !== '' && montantCentimes.value !== null,
);

// Aperçu : mêmes règles de calcul que la base (arrondi au centime)
const apercu = computed(() => {
  if (!oeuvre.value || montantCentimes.value === null) return [];
  return calculerRepartition(montantCentimes.value, oeuvre.value.contributions);
});
const totalApercu = computed(() => apercu.value.reduce((somme, c) => somme + c.montantCentimes, 0));

onMounted(async () => {
  try {
    diffuseurs.value = (await api('/gestion/diffuseurs', { params: { limit: 100 } })).data;
  } catch (e) {
    erreur.value = `Impossible de charger les diffuseurs : ${e.message}`;
  }
});

async function enregistrer() {
  if (!peutEnvoyer.value) return;
  envoi.value = true;
  erreur.value = '';
  try {
    const creee = await api('/gestion/diffusions', {
      method: 'POST',
      body: {
        id_oeuvre: oeuvre.value.id_oeuvre,
        id_diffuseur: Number(idDiffuseur.value),
        date_diffusion: date.value,
        montant_total: montantCentimes.value / 100,
      },
    });
    router.push({ name: 'gestion-diffusion', params: { id: creee.id_diffusion } });
  } catch (e) {
    erreur.value = e.message;
  } finally {
    envoi.value = false;
  }
}
</script>

<template>
  <p class="fil"><RouterLink :to="{ name: 'gestion-diffusions' }">← Retour aux diffusions</RouterLink></p>

  <form novalidate @submit.prevent="enregistrer">
    <section class="carte bloc">
      <h2>Nouvelle diffusion</h2>
      <p class="discret">
        Enregistrez le passage d’une œuvre validée : la répartition des droits entre ses ayants droit est calculée
        automatiquement.
      </p>

      <div class="grille-champs">
        <div class="plein">
          <span class="etiquette">Œuvre diffusée <span class="requis">*</span></span>
          <OeuvrePicker v-model="oeuvre" id-prefixe="diffusion-oeuvre" />
        </div>
        <div>
          <label for="diffusion-diffuseur">Diffuseur <span class="requis">*</span></label>
          <select id="diffusion-diffuseur" v-model="idDiffuseur">
            <option value="">Choisir…</option>
            <option v-for="d in diffuseurs" :key="d.id_diffuseur" :value="d.id_diffuseur">{{ d.nom }} ({{ d.ville }})</option>
          </select>
        </div>
        <div>
          <label for="diffusion-date">Date de diffusion <span class="requis">*</span></label>
          <input id="diffusion-date" v-model="date" type="date" />
        </div>
        <div class="plein">
          <label for="diffusion-montant">Montant à répartir (Ariary) <span class="requis">*</span></label>
          <input
            id="diffusion-montant"
            v-model="montant"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            placeholder="Ex. : 200000"
          />
          <p v-if="montant !== '' && montantCentimes === null" class="aide texte-erreur">
            Saisissez un montant positif avec 2 décimales au maximum.
          </p>
        </div>
      </div>
    </section>

    <section v-if="apercu.length > 0" class="carte bloc">
      <h2>Aperçu de la répartition</h2>
      <p class="discret">Voici ce que percevra chaque ayant droit si vous enregistrez cette diffusion.</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rôle</th>
              <th>Ayant droit</th>
              <th class="droite">Part</th>
              <th class="droite">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in apercu" :key="c.id_contribution">
              <td>{{ c.role }}</td>
              <td>{{ c.nom_affiche }}</td>
              <td class="droite">{{ formaterPourcent(Number(c.part_pct)) }} %</td>
              <td class="droite montant">{{ formaterCentimes(c.montantCentimes) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3"><strong>Total réparti</strong></td>
              <td class="droite montant">{{ formaterCentimes(totalApercu) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p v-if="totalApercu !== montantCentimes" class="aide">
        L’écart de {{ formaterCentimes(Math.abs(montantCentimes - totalApercu)) }} vient de l’arrondi au centime de chaque part.
      </p>
    </section>

    <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

    <div class="actions-formulaire">
      <button type="submit" class="btn btn-primaire" :disabled="!peutEnvoyer || envoi">
        {{ envoi ? 'Enregistrement…' : 'Enregistrer la diffusion' }}
      </button>
    </div>
  </form>
</template>
