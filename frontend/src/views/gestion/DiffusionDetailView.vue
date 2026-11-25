<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../../api/client.js';
import { supprimerDiffusion, recalculerRepartition } from '../../api/gestion.js';
import StatCard from '../../components/StatCard.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import { formaterAriary, formaterDate, libelleTypeDiffuseur } from '../../utils/format.js';
import { centimesMontant, formaterCentimes } from '../../utils/droits.js';
import { formaterPourcent } from '../../utils/soumission.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();

const diffusion = ref(null);
const diffuseurs = ref([]);
const chargement = ref(true);
const erreur = ref('');
const info = ref('');
const enAction = ref(false);
const confirmationSuppression = ref(false);

const edition = ref(false);
const formulaire = reactive({ id_diffuseur: '', date_diffusion: '', montant_total: '' });

async function charger({ silencieux = false } = {}) {
  if (!silencieux) {
    chargement.value = true;
    diffusion.value = null;
  }
  try {
    diffusion.value = await api(`/gestion/diffusions/${props.id}`);
  } catch (e) {
    erreur.value = e.status === 404 ? 'Cette diffusion est introuvable.' : e.message;
  } finally {
    chargement.value = false;
  }
}

const ecart = computed(() =>
  diffusion.value ? centimesMontant(diffusion.value.montant_total) - centimesMontant(diffusion.value.total_reparti) : 0,
);

async function commencerEdition() {
  erreur.value = '';
  info.value = '';
  if (diffuseurs.value.length === 0) {
    try {
      diffuseurs.value = (await api('/gestion/diffuseurs', { params: { limit: 100 } })).data;
    } catch (e) {
      erreur.value = e.message;
      return;
    }
  }
  formulaire.id_diffuseur = diffusion.value.id_diffuseur;
  formulaire.date_diffusion = diffusion.value.date_diffusion;
  formulaire.montant_total = String(Number(diffusion.value.montant_total));
  edition.value = true;
}

async function enregistrerModification() {
  const centimes = centimesMontant(formulaire.montant_total);
  if (centimes === null || !formulaire.date_diffusion || formulaire.id_diffuseur === '') {
    erreur.value = 'Vérifiez le diffuseur, la date et le montant (positif, 2 décimales maximum).';
    return;
  }
  enAction.value = true;
  erreur.value = '';
  try {
    await api(`/gestion/diffusions/${props.id}`, {
      method: 'PUT',
      body: {
        id_diffuseur: Number(formulaire.id_diffuseur),
        date_diffusion: formulaire.date_diffusion,
        montant_total: centimes / 100,
      },
    });
    edition.value = false;
    await charger({ silencieux: true });
    info.value = 'Diffusion modifiée : la répartition a été recalculée.';
  } catch (e) {
    erreur.value = e.message;
  } finally {
    enAction.value = false;
  }
}

async function recalculer() {
  enAction.value = true;
  erreur.value = '';
  info.value = '';
  try {
    diffusion.value = await recalculerRepartition(props.id);
    info.value = 'Répartition recalculée.';
  } catch (e) {
    erreur.value = e.message;
  } finally {
    enAction.value = false;
  }
}

async function supprimer() {
  enAction.value = true;
  try {
    await supprimerDiffusion(props.id);
    router.push({ name: 'gestion-diffusions' });
  } catch (e) {
    confirmationSuppression.value = false;
    erreur.value = e.message;
  } finally {
    enAction.value = false;
  }
}

watch(() => props.id, () => charger(), { immediate: true });
</script>

<template>
  <p class="fil"><RouterLink :to="{ name: 'gestion-diffusions' }">← Retour aux diffusions</RouterLink></p>

  <div v-if="chargement" class="carte squelette" aria-busy="true" aria-label="Chargement">
    <span class="s-ligne s-titre"></span>
    <span class="s-ligne"></span>
    <span class="s-ligne s-court"></span>
  </div>

  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>
  <p v-if="info" class="alerte alerte-succes" role="status">{{ info }}</p>

  <template v-if="diffusion">
    <header class="carte fiche-tete">
      <p class="surtitre">Diffusion du {{ formaterDate(diffusion.date_diffusion) }}</p>
      <h2 class="grand-titre">
        <RouterLink :to="{ name: 'gestion-oeuvre', params: { id: diffusion.id_oeuvre } }">{{ diffusion.titre_oeuvre }}</RouterLink>
      </h2>
      <p class="discret" style="margin: 0.4rem 0 0">
        {{ diffusion.nom_diffuseur }} · {{ libelleTypeDiffuseur(diffusion.type_diffuseur) }} · {{ diffusion.ville_diffuseur }}
      </p>

      <form v-if="edition" class="edition-diffusion" novalidate @submit.prevent="enregistrerModification">
        <div class="grille-champs">
          <div>
            <label for="edit-diffuseur">Diffuseur</label>
            <select id="edit-diffuseur" v-model="formulaire.id_diffuseur">
              <option v-for="d in diffuseurs" :key="d.id_diffuseur" :value="d.id_diffuseur">{{ d.nom }} ({{ d.ville }})</option>
            </select>
          </div>
          <div>
            <label for="edit-date">Date</label>
            <input id="edit-date" v-model="formulaire.date_diffusion" type="date" />
          </div>
          <div class="plein">
            <label for="edit-montant">Montant (Ariary)</label>
            <input id="edit-montant" v-model="formulaire.montant_total" type="number" min="0" step="0.01" inputmode="decimal" />
            <p class="aide">L’œuvre n’est pas modifiable. La répartition sera recalculée avec le nouveau montant.</p>
          </div>
        </div>
        <div class="actions-fiche">
          <button type="submit" class="btn btn-primaire" :disabled="enAction">Enregistrer</button>
          <button type="button" class="btn" @click="edition = false">Annuler</button>
        </div>
      </form>

      <div v-else class="actions-fiche">
        <button type="button" class="btn" :disabled="enAction" @click="commencerEdition">Modifier</button>
        <button type="button" class="btn" :disabled="enAction" @click="recalculer">Recalculer la répartition</button>
        <button type="button" class="btn btn-danger" :disabled="enAction" @click="confirmationSuppression = true">Supprimer</button>
      </div>
    </header>

    <section class="kpis" aria-label="Montants">
      <StatCard libelle="Montant de la diffusion" :valeur="formaterAriary(diffusion.montant_total)" ton="or" />
      <StatCard libelle="Total réparti" :valeur="formaterAriary(diffusion.total_reparti)" />
      <StatCard
        libelle="Écart"
        :valeur="formaterCentimes(Math.abs(ecart))"
        :aide="ecart === 0 ? 'Répartition exacte' : 'Dû à l’arrondi au centime'"
        :ton="ecart === 0 ? 'normal' : 'attente'"
      />
    </section>

    <section class="carte bloc">
      <h2>Répartition des droits</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rôle</th>
              <th>Ayant droit</th>
              <th class="droite">Part</th>
              <th class="droite">Montant perçu</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in diffusion.repartition" :key="`${l.id_personne}-${i}`">
              <td>{{ l.role }}</td>
              <td>
                <RouterLink :to="{ name: 'gestion-droit', params: { id: l.id_personne } }">{{ l.nom_affiche }}</RouterLink>
              </td>
              <td class="droite">{{ formaterPourcent(Number(l.part_pct)) }} %</td>
              <td class="droite montant">{{ formaterAriary(l.montant) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>

  <ConfirmDialog
    :ouvert="confirmationSuppression"
    titre="Supprimer cette diffusion ?"
    message="La diffusion et sa répartition seront supprimées définitivement : les droits correspondants disparaîtront du classement."
    libelle-confirmer="Supprimer"
    danger
    :en-cours="enAction"
    @confirmer="supprimer"
    @annuler="confirmationSuppression = false"
  />
</template>
