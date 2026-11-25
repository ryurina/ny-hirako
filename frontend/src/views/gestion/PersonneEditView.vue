<script setup>
import { ref, reactive, computed, nextTick, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../../api/client.js';
import StatutBadge from '../../components/StatutBadge.vue';
import { validerPersonneEdition, construireCorpsPersonne, personneVersFormulaire } from '../../utils/edition.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();

const personne = ref(null);
const chargement = ref(true);
const erreurChargement = ref('');

const formulaire = reactive({
  type: 'PHYSIQUE',
  nom: '',
  prenom: '',
  nom_artiste: '',
  date_naissance: '',
  telephone: '',
  email: '',
  ville: '',
});

const erreurs = ref([]);
const erreurServeur = ref('');
const envoi = ref(false);
const blocErreurs = ref(null);

const physique = computed(() => formulaire.type === 'PHYSIQUE');

async function charger() {
  chargement.value = true;
  erreurChargement.value = '';
  try {
    personne.value = await api(`/gestion/personnes/${props.id}`);
    Object.assign(formulaire, personneVersFormulaire(personne.value));
  } catch (e) {
    erreurChargement.value = e.status === 404 ? 'Cet ayant droit est introuvable.' : e.message;
  } finally {
    chargement.value = false;
  }
}

async function afficherErreurs() {
  await nextTick();
  blocErreurs.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function enregistrer() {
  erreurServeur.value = '';
  erreurs.value = validerPersonneEdition(formulaire);
  if (erreurs.value.length > 0) {
    await afficherErreurs();
    return;
  }

  envoi.value = true;
  try {
    await api(`/gestion/personnes/${props.id}`, { method: 'PUT', body: construireCorpsPersonne(formulaire) });
    router.push({ name: 'gestion-personne', params: { id: props.id }, query: { modifie: '1' } });
  } catch (e) {
    erreurServeur.value = e.message;
    await afficherErreurs();
  } finally {
    envoi.value = false;
  }
}

watch(() => props.id, charger, { immediate: true });
</script>

<template>
  <p class="fil"><RouterLink :to="{ name: 'gestion-personne', params: { id } }">← Retour à l’ayant droit</RouterLink></p>

  <div v-if="chargement" class="carte squelette" aria-busy="true" aria-label="Chargement">
    <span class="s-ligne s-titre"></span>
    <span class="s-ligne"></span>
    <span class="s-ligne s-court"></span>
  </div>

  <p v-else-if="erreurChargement" class="alerte alerte-erreur" role="alert">{{ erreurChargement }}</p>

  <form v-else-if="personne" novalidate @submit.prevent="enregistrer">
    <section class="carte bloc">
      <div class="oeuvre-tete">
        <h2>Informations de l’ayant droit</h2>
        <StatutBadge :statut="personne.statut" />
      </div>

      <div class="grille-champs">
        <div class="plein">
          <label for="pers-type">Type</label>
          <select id="pers-type" v-model="formulaire.type">
            <option value="PHYSIQUE">Personne physique</option>
            <option value="MORALE">Personne morale (société, éditeur…)</option>
          </select>
          <p v-if="personne.type === 'MORALE' && formulaire.type === 'PHYSIQUE'" class="aide">
            Un éditeur doit rester une personne morale : la base refusera ce changement s’il est éditeur d’une œuvre.
          </p>
        </div>

        <div :class="{ plein: !physique }">
          <label for="pers-nom">{{ physique ? 'Nom' : 'Raison sociale' }} <span class="requis">*</span></label>
          <input id="pers-nom" v-model="formulaire.nom" type="text" maxlength="150" autocomplete="off" />
        </div>
        <div v-if="physique">
          <label for="pers-prenom">Prénom <span class="requis">*</span></label>
          <input id="pers-prenom" v-model="formulaire.prenom" type="text" maxlength="100" autocomplete="off" />
        </div>
        <div v-if="physique">
          <label for="pers-artiste">Nom d’artiste</label>
          <input id="pers-artiste" v-model="formulaire.nom_artiste" type="text" maxlength="150" autocomplete="off" />
        </div>
        <div v-if="physique">
          <label for="pers-naissance">Date de naissance</label>
          <input id="pers-naissance" v-model="formulaire.date_naissance" type="date" />
        </div>
        <div>
          <label for="pers-email">Email</label>
          <input id="pers-email" v-model="formulaire.email" type="email" maxlength="255" autocomplete="off" />
        </div>
        <div>
          <label for="pers-tel">Téléphone</label>
          <input id="pers-tel" v-model="formulaire.telephone" type="tel" maxlength="30" autocomplete="off" />
        </div>
        <div>
          <label for="pers-ville">Ville</label>
          <input id="pers-ville" v-model="formulaire.ville" type="text" maxlength="100" autocomplete="off" />
        </div>
      </div>
    </section>

    <div ref="blocErreurs">
      <div v-if="erreurs.length > 0" class="alerte alerte-erreur" role="alert">
        <strong>Merci de corriger les points suivants :</strong>
        <ul class="erreurs-liste">
          <li v-for="(e, i) in erreurs" :key="i">{{ e }}</li>
        </ul>
      </div>
      <p v-if="erreurServeur" class="alerte alerte-erreur" role="alert">{{ erreurServeur }}</p>
    </div>

    <div class="actions-formulaire">
      <RouterLink class="btn" :to="{ name: 'gestion-personne', params: { id } }" style="margin-right: 0.6rem">Annuler</RouterLink>
      <button type="submit" class="btn btn-primaire" :disabled="envoi">
        {{ envoi ? 'Enregistrement…' : 'Enregistrer les modifications' }}
      </button>
    </div>
  </form>
</template>
