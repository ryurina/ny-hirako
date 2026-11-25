<script setup>
import { ref, computed, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../../api/client.js';
import { changerStatutOeuvre, changerStatutPersonne, supprimerOeuvre } from '../../api/gestion.js';
import { useStats } from '../../composables/useStats.js';
import StatutBadge from '../../components/StatutBadge.vue';
import ShareGauge from '../../components/ShareGauge.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import { formaterDuree, formaterDate } from '../../utils/format.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();
const route = useRoute();
const { rafraichir } = useStats();

const oeuvre = ref(null);
const chargement = ref(true);
const erreur = ref('');
const info = ref('');
const enAction = ref(false);
const confirmationSuppression = ref(false);

async function charger({ silencieux = false } = {}) {
  if (!silencieux) {
    chargement.value = true;
    oeuvre.value = null;
  }
  try {
    oeuvre.value = await api(`/gestion/oeuvres/${props.id}`);
  } catch (e) {
    erreur.value = e.status === 404 ? 'Cette œuvre est introuvable.' : e.message;
  } finally {
    chargement.value = false;
  }
}

const contributions = computed(() => oeuvre.value?.contributions ?? []);
const total = computed(() => contributions.value.reduce((s, c) => s + Math.round(Number(c.part_pct) * 100), 0) / 100);

// Ayants droit non validés (une personne peut apparaître avec deux rôles : on la compte une fois)
const aValider = computed(() => [
  ...new Map(contributions.value.filter((c) => c.statut_personne !== 'VALIDE').map((c) => [c.id_personne, c])).values(),
]);

async function executer(action, message) {
  enAction.value = true;
  erreur.value = '';
  info.value = '';
  try {
    await action();
    await Promise.all([charger({ silencieux: true }), rafraichir()]);
    info.value = message;
  } catch (e) {
    erreur.value = e.message;
  } finally {
    enAction.value = false;
  }
}

const changer = (statut) =>
  executer(() => changerStatutOeuvre(props.id, statut), statut === 'VALIDE' ? 'Œuvre validée : elle est maintenant publique.' : 'Œuvre rejetée.');

const validerPersonne = (idPersonne) =>
  executer(() => changerStatutPersonne(idPersonne, 'VALIDE'), 'Ayant droit validé.');

const validerTous = () =>
  executer(async () => {
    for (const c of aValider.value) await changerStatutPersonne(c.id_personne, 'VALIDE');
  }, `${aValider.value.length} ayant(s) droit validé(s).`);

async function supprimer() {
  enAction.value = true;
  try {
    await supprimerOeuvre(props.id);
    rafraichir();
    router.push({ name: 'gestion-oeuvres' });
  } catch (e) {
    confirmationSuppression.value = false;
    erreur.value = e.message;
  } finally {
    enAction.value = false;
  }
}

// Message affiché après un enregistrement depuis la page de modification
if (route.query.modifie) info.value = 'Modifications enregistrées.';

watch(() => props.id, () => charger(), { immediate: true });
</script>

<template>
  <p class="fil"><RouterLink :to="{ name: 'gestion-oeuvres' }">← Retour aux œuvres</RouterLink></p>

  <div v-if="chargement" class="carte squelette" aria-busy="true" aria-label="Chargement">
    <span class="s-ligne s-titre"></span>
    <span class="s-ligne"></span>
    <span class="s-ligne s-court"></span>
  </div>

  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>
  <p v-if="info" class="alerte alerte-succes" role="status">{{ info }}</p>

  <template v-if="oeuvre">
    <header class="carte fiche-tete">
      <div class="oeuvre-tete">
        <div>
          <p class="surtitre">{{ oeuvre.genre ?? 'Œuvre musicale' }}</p>
          <h2 class="grand-titre">{{ oeuvre.titre }}</h2>
        </div>
        <StatutBadge :statut="oeuvre.statut" />
      </div>
      <ul class="infos">
        <li>Année · <strong>{{ oeuvre.annee_creation ?? 'inconnue' }}</strong></li>
        <li>Durée · <strong>{{ formaterDuree(oeuvre.duree_sec) }}</strong></li>
        <li>Soumise le · <strong>{{ formaterDate(oeuvre.date_soumission) }}</strong></li>
        <li v-if="oeuvre.soumetteur_email">
          Soumetteur · <a :href="`mailto:${oeuvre.soumetteur_email}`">{{ oeuvre.soumetteur_email }}</a>
        </li>
      </ul>

      <div class="actions-fiche">
        <RouterLink class="btn" :to="{ name: 'gestion-oeuvre-edition', params: { id } }">Modifier</RouterLink>
        <button
          v-if="oeuvre.statut !== 'VALIDE'"
          type="button"
          class="btn btn-succes"
          :disabled="enAction"
          @click="changer('VALIDE')"
        >
          Valider l’œuvre
        </button>
        <button v-if="oeuvre.statut === 'EN_ATTENTE'" type="button" class="btn" :disabled="enAction" @click="changer('REJETE')">
          Rejeter
        </button>
        <button type="button" class="btn btn-danger" :disabled="enAction" @click="confirmationSuppression = true">Supprimer</button>
      </div>
    </header>

    <p v-if="oeuvre.statut !== 'VALIDE' && aValider.length > 0" class="alerte alerte-attention" role="status">
      <strong>{{ aValider.length }} ayant{{ aValider.length > 1 ? 's' : '' }} droit à valider avant de pouvoir valider l’œuvre.</strong>
      <button type="button" class="btn btn-petit" style="margin-left: 0.75rem" :disabled="enAction" @click="validerTous">
        Valider tous les ayants droit en attente
      </button>
    </p>

    <section class="carte bloc">
      <h2>Répartition des droits</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rôle</th>
              <th>Ayant droit</th>
              <th>Statut</th>
              <th>Part</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in contributions" :key="c.id_contribution">
              <td>{{ c.role }}</td>
              <td>
                <RouterLink :to="{ name: 'gestion-personne', params: { id: c.id_personne } }">{{ c.nom_affiche }}</RouterLink>
              </td>
              <td><StatutBadge :statut="c.statut_personne" /></td>
              <td>
                <div class="part-cellule">
                  <strong>{{ c.part_pct }} %</strong>
                  <div class="barre" aria-hidden="true"><span :style="{ width: c.part_pct + '%' }"></span></div>
                </div>
              </td>
              <td class="droite">
                <button
                  v-if="c.statut_personne !== 'VALIDE'"
                  type="button"
                  class="btn btn-petit btn-succes"
                  :disabled="enAction"
                  @click="validerPersonne(c.id_personne)"
                >
                  Valider
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="margin-top: 1rem"><ShareGauge :total="total" /></div>
    </section>
  </template>

  <ConfirmDialog
    :ouvert="confirmationSuppression"
    titre="Supprimer cette œuvre ?"
    message="L’œuvre et ses contributions seront supprimées définitivement. Impossible si l’œuvre a déjà été diffusée."
    libelle-confirmer="Supprimer"
    danger
    :en-cours="enAction"
    @confirmer="supprimer"
    @annuler="confirmationSuppression = false"
  />
</template>
