<script setup>
import { ref, reactive, nextTick, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../../api/client.js';
import ContributionsEditor from '../../components/ContributionsEditor.vue';
import StatutBadge from '../../components/StatutBadge.vue';
import { validerSoumission } from '../../utils/soumission.js';
import { lignesDepuisContributions, construireCorpsOeuvre, secondesVersTexte } from '../../utils/edition.js';

const props = defineProps({ id: { type: String, required: true } });
const router = useRouter();

const oeuvre = ref(null);
const roles = ref([]);
const chargement = ref(true);
const erreurChargement = ref('');

const formulaire = reactive({ titre: '', genre: '', annee: '', duree: '', iswc: '', email: '', lignes: [] });
const modifierDroits = ref(false);

const erreurs = ref([]);
const erreurServeur = ref('');
const envoi = ref(false);
const blocErreurs = ref(null);

async function charger() {
  chargement.value = true;
  erreurChargement.value = '';
  try {
    const [o, r] = await Promise.all([api(`/gestion/oeuvres/${props.id}`), api('/roles')]);
    oeuvre.value = o;
    roles.value = r.data;
    Object.assign(formulaire, {
      titre: o.titre,
      genre: o.genre ?? '',
      annee: o.annee_creation ?? '',
      duree: secondesVersTexte(o.duree_sec),
      iswc: o.code_iswc ?? '',
      email: '',
      lignes: lignesDepuisContributions(o.contributions),
    });
  } catch (e) {
    erreurChargement.value = e.status === 404 ? 'Cette œuvre est introuvable.' : e.message;
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
  erreurs.value = validerSoumission(formulaire, { avecEmail: false, avecContributions: modifierDroits.value });
  if (erreurs.value.length > 0) {
    await afficherErreurs();
    return;
  }

  envoi.value = true;
  try {
    await api(`/gestion/oeuvres/${props.id}`, {
      method: 'PUT',
      body: construireCorpsOeuvre(formulaire, { avecContributions: modifierDroits.value }),
    });
    router.push({ name: 'gestion-oeuvre', params: { id: props.id }, query: { modifie: '1' } });
  } catch (e) {
    let message = e.message;
    if (modifierDroits.value && e.status === 409 && /utilisé/.test(message)) {
      message += ' — des droits ont déjà été répartis pour cette œuvre : décochez la modification des ayants droit pour ne changer que ses informations.';
    }
    erreurServeur.value = message;
    await afficherErreurs();
  } finally {
    envoi.value = false;
  }
}

watch(() => props.id, charger, { immediate: true });
</script>

<template>
  <p class="fil"><RouterLink :to="{ name: 'gestion-oeuvre', params: { id } }">← Retour à l’œuvre</RouterLink></p>

  <div v-if="chargement" class="carte squelette" aria-busy="true" aria-label="Chargement">
    <span class="s-ligne s-titre"></span>
    <span class="s-ligne"></span>
    <span class="s-ligne s-court"></span>
  </div>

  <p v-else-if="erreurChargement" class="alerte alerte-erreur" role="alert">{{ erreurChargement }}</p>

  <form v-else-if="oeuvre" novalidate @submit.prevent="enregistrer">
    <section class="carte bloc">
      <div class="oeuvre-tete">
        <h2>Informations de l’œuvre</h2>
        <StatutBadge :statut="oeuvre.statut" />
      </div>
      <div class="grille-champs">
        <div class="plein">
          <label for="edit-titre">Titre <span class="requis">*</span></label>
          <input id="edit-titre" v-model="formulaire.titre" type="text" maxlength="255" autocomplete="off" />
        </div>
        <div>
          <label for="edit-genre">Genre</label>
          <input id="edit-genre" v-model="formulaire.genre" type="text" maxlength="80" placeholder="Ex. : Salegy" />
        </div>
        <div>
          <label for="edit-annee">Année de création</label>
          <input id="edit-annee" v-model="formulaire.annee" type="number" min="1800" max="2100" />
        </div>
        <div>
          <label for="edit-duree">Durée</label>
          <input id="edit-duree" v-model="formulaire.duree" type="text" inputmode="numeric" placeholder="3:45" />
          <p class="aide">Format minutes:secondes.</p>
        </div>
        <div>
          <label for="edit-iswc">Code ISWC</label>
          <input id="edit-iswc" v-model="formulaire.iswc" type="text" maxlength="15" placeholder="T-123.456.789-0" />
        </div>
      </div>
    </section>

    <section class="carte bloc">
      <h2>Ayants droit et répartition</h2>

      <label class="case-a-cocher" for="edit-droits">
        <input id="edit-droits" v-model="modifierDroits" type="checkbox" />
        <span>
          Modifier aussi les ayants droit et leurs parts
          <span class="aide" style="display: block">
            Impossible si des droits ont déjà été répartis pour cette œuvre (diffusions enregistrées).
          </span>
        </span>
      </label>

      <div v-if="!modifierDroits" class="table-scroll" style="margin-top: 1rem">
        <table>
          <thead>
            <tr>
              <th>Rôle</th>
              <th>Ayant droit</th>
              <th class="droite">Part</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in oeuvre.contributions" :key="c.id_contribution">
              <td>{{ c.role }}</td>
              <td>{{ c.nom_affiche }}</td>
              <td class="droite">{{ c.part_pct }} %</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else style="margin-top: 1rem">
        <ContributionsEditor :lignes="formulaire.lignes" :roles="roles" prefixe="edition" />
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
      <RouterLink class="btn" :to="{ name: 'gestion-oeuvre', params: { id } }" style="margin-right: 0.6rem">Annuler</RouterLink>
      <button type="submit" class="btn btn-primaire" :disabled="envoi">
        {{ envoi ? 'Enregistrement…' : 'Enregistrer les modifications' }}
      </button>
    </div>
  </form>
</template>
