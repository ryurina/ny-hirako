<script setup>
import { ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../../api/client.js';
import { changerStatutPersonne, supprimerPersonne } from '../../api/gestion.js';
import { useStats } from '../../composables/useStats.js';
import StatutBadge from '../../components/StatutBadge.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import { formaterDate, nomPersonne, libelleType } from '../../utils/format.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const { rafraichir } = useStats();

const personne = ref(null);
const chargement = ref(true);
const erreur = ref('');
const info = ref('');
const enAction = ref(false);
const confirmationSuppression = ref(false);

async function charger({ silencieux = false } = {}) {
  if (!silencieux) {
    chargement.value = true;
    personne.value = null;
  }
  try {
    personne.value = await api(`/gestion/personnes/${props.id}`);
  } catch (e) {
    erreur.value = e.status === 404 ? 'Cet ayant droit est introuvable.' : e.message;
  } finally {
    chargement.value = false;
  }
}

async function changer(statut) {
  enAction.value = true;
  erreur.value = '';
  info.value = '';
  try {
    await changerStatutPersonne(props.id, statut);
    await Promise.all([charger({ silencieux: true }), rafraichir()]);
    info.value = statut === 'VALIDE' ? 'Ayant droit validé.' : 'Ayant droit rejeté.';
  } catch (e) {
    erreur.value = e.message;
  } finally {
    enAction.value = false;
  }
}

async function supprimer() {
  enAction.value = true;
  try {
    await supprimerPersonne(props.id);
    rafraichir();
    router.push({ name: 'gestion-personnes' });
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
  <p class="fil"><RouterLink :to="{ name: 'gestion-personnes' }">← Retour aux ayants droit</RouterLink></p>

  <div v-if="chargement" class="carte squelette" aria-busy="true" aria-label="Chargement">
    <span class="s-ligne s-titre"></span>
    <span class="s-ligne"></span>
    <span class="s-ligne s-court"></span>
  </div>

  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>
  <p v-if="info" class="alerte alerte-succes" role="status">{{ info }}</p>

  <template v-if="personne">
    <header class="carte fiche-tete">
      <div class="oeuvre-tete">
        <div>
          <p class="surtitre">{{ libelleType(personne.type) }}</p>
          <h2 class="grand-titre">{{ nomPersonne(personne) }}</h2>
        </div>
        <StatutBadge :statut="personne.statut" />
      </div>

      <dl class="definitions">
        <dt>Nom</dt>
        <dd>{{ personne.nom }}</dd>
        <template v-if="personne.type === 'PHYSIQUE'">
          <dt>Prénom</dt>
          <dd>{{ personne.prenom }}</dd>
          <dt>Nom d’artiste</dt>
          <dd>{{ personne.nom_artiste ?? '—' }}</dd>
          <dt>Naissance</dt>
          <dd>{{ formaterDate(personne.date_naissance) }}</dd>
        </template>
        <dt>Email</dt>
        <dd>
          <a v-if="personne.email" :href="`mailto:${personne.email}`">{{ personne.email }}</a>
          <span v-else>—</span>
        </dd>
        <dt>Téléphone</dt>
        <dd>{{ personne.telephone ?? '—' }}</dd>
        <dt>Ville</dt>
        <dd>{{ personne.ville ?? '—' }}</dd>
      </dl>

      <div class="actions-fiche">
        <button v-if="personne.statut !== 'VALIDE'" type="button" class="btn btn-succes" :disabled="enAction" @click="changer('VALIDE')">
          Valider l’ayant droit
        </button>
        <button v-if="personne.statut === 'EN_ATTENTE'" type="button" class="btn" :disabled="enAction" @click="changer('REJETE')">
          Rejeter
        </button>
        <button type="button" class="btn btn-danger" :disabled="enAction" @click="confirmationSuppression = true">Supprimer</button>
      </div>
    </header>

    <section class="carte bloc">
      <h2>Œuvres liées</h2>
      <p v-if="personne.oeuvres.length === 0" class="discret">Aucune œuvre n’est encore liée à cet ayant droit.</p>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Œuvre</th>
              <th>Rôle</th>
              <th>Part</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(o, i) in personne.oeuvres" :key="`${o.id_oeuvre}-${i}`">
              <td>
                <RouterLink :to="{ name: 'gestion-oeuvre', params: { id: o.id_oeuvre } }">{{ o.titre }}</RouterLink>
              </td>
              <td>{{ o.role }}</td>
              <td>{{ o.part_pct }} %</td>
              <td><StatutBadge :statut="o.statut" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>

  <ConfirmDialog
    :ouvert="confirmationSuppression"
    titre="Supprimer cet ayant droit ?"
    message="Cette action est définitive. Impossible si l’ayant droit est lié à des œuvres."
    libelle-confirmer="Supprimer"
    danger
    :en-cours="enAction"
    @confirmer="supprimer"
    @annuler="confirmationSuppression = false"
  />
</template>
