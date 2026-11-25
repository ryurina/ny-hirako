<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api/client.js';
import PersonnePicker from '../components/PersonnePicker.vue';
import ShareGauge from '../components/ShareGauge.vue';
import { validerSoumission, construireCorps, totalCentimes, repartirEquitablement } from '../utils/soumission.js';

const MAX_LIGNES = 20;
let compteur = 0;

function nouvelleLigne(idRole = '') {
  return {
    cle: ++compteur,
    id_role: idRole,
    part: '',
    personne: {
      mode: 'existante',
      selection: null,
      nouvelle: { type: 'PHYSIQUE', nom: '', prenom: '', nom_artiste: '', ville: '' },
    },
  };
}

const roles = ref([]);
const erreurRoles = ref('');
const erreurs = ref([]);
const erreurServeur = ref('');
const envoi = ref(false);
const succes = ref(null);
const blocErreurs = ref(null);

const formulaire = reactive({
  titre: '',
  genre: '',
  annee: '',
  duree: '',
  email: '',
  lignes: [nouvelleLigne(), nouvelleLigne()],
});

const total = computed(() => totalCentimes(formulaire.lignes) / 100);

const idRole = (libelle) => roles.value.find((r) => r.libelle === libelle)?.id_role ?? '';
const estEditeur = (valeur) => roles.value.find((r) => String(r.id_role) === String(valeur))?.libelle === 'Éditeur';

// Par défaut : une ligne « Auteur » et une ligne « Compositeur »
function lignesInitiales() {
  return [nouvelleLigne(idRole('Auteur')), nouvelleLigne(idRole('Compositeur'))];
}

onMounted(async () => {
  try {
    const donnees = await api('/roles');
    roles.value = donnees.data;
    const [auteur, compositeur] = [idRole('Auteur'), idRole('Compositeur')];
    if (formulaire.lignes[0] && formulaire.lignes[0].id_role === '') formulaire.lignes[0].id_role = auteur;
    if (formulaire.lignes[1] && formulaire.lignes[1].id_role === '') formulaire.lignes[1].id_role = compositeur;
  } catch (e) {
    erreurRoles.value = `Impossible de charger les rôles : ${e.message}`;
  }
});

// Un éditeur est toujours une personne morale
function changerRole(ligne, valeur) {
  if (!estEditeur(valeur)) return;
  const n = ligne.personne.nouvelle;
  n.type = 'MORALE';
  n.prenom = '';
  n.nom_artiste = '';
  if (ligne.personne.selection && ligne.personne.selection.type !== 'MORALE') ligne.personne.selection = null;
}

function ajouterLigne() {
  if (formulaire.lignes.length < MAX_LIGNES) formulaire.lignes.push(nouvelleLigne());
}

function supprimerLigne(index) {
  if (formulaire.lignes.length > 1) formulaire.lignes.splice(index, 1);
}

function repartir() {
  const parts = repartirEquitablement(formulaire.lignes.length);
  formulaire.lignes.forEach((ligne, i) => {
    ligne.part = parts[i];
  });
}

async function afficherErreurs() {
  await nextTick();
  blocErreurs.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function envoyer() {
  erreurServeur.value = '';
  erreurs.value = validerSoumission(formulaire);
  if (erreurs.value.length > 0) {
    await afficherErreurs();
    return;
  }

  envoi.value = true;
  try {
    succes.value = await api('/oeuvres', { method: 'POST', body: construireCorps(formulaire) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    erreurServeur.value = e.message;
    await afficherErreurs();
  } finally {
    envoi.value = false;
  }
}

function recommencer() {
  Object.assign(formulaire, { titre: '', genre: '', annee: '', duree: '', email: '', lignes: lignesInitiales() });
  erreurs.value = [];
  erreurServeur.value = '';
  succes.value = null;
}
</script>

<template>
  <div class="container page">
    <p class="fil"><RouterLink :to="{ name: 'accueil' }">← Retour au répertoire</RouterLink></p>

    <!-- Confirmation -->
    <section v-if="succes" class="carte centre">
      <span class="badge badge-succes">Soumission reçue</span>
      <h1 style="margin-top: 0.75rem">Merci, votre œuvre a bien été soumise</h1>
      <p class="discret">
        Référence n° {{ succes.id_oeuvre }}. Un modérateur va examiner votre soumission. L’œuvre apparaîtra dans le
        répertoire dès qu’elle sera validée.
      </p>
      <p>
        <button type="button" class="btn btn-primaire" @click="recommencer">Soumettre une autre œuvre</button>
        <RouterLink class="btn" :to="{ name: 'accueil' }" style="margin-left: 0.5rem">Retour au répertoire</RouterLink>
      </p>
    </section>

    <!-- Formulaire -->
    <template v-else>
      <header class="entete-page">
        <p class="surtitre">Formulaire de soumission</p>
        <h1>Soumettre une œuvre</h1>
        <p class="discret">
          Renseignez l’œuvre et la répartition des droits entre ses ayants droit. Un modérateur vérifiera votre
          soumission avant sa publication.
        </p>
      </header>

      <p v-if="erreurRoles" class="alerte alerte-erreur" role="alert">{{ erreurRoles }}</p>

      <form novalidate @submit.prevent="envoyer">
        <!-- 1. L'œuvre -->
        <section class="carte bloc">
          <h2><span class="numero">1</span> L’œuvre</h2>
          <div class="grille-champs">
            <div class="plein">
              <label for="sou-titre">Titre <span class="requis">*</span></label>
              <input id="sou-titre" v-model="formulaire.titre" type="text" maxlength="255" autocomplete="off" />
            </div>
            <div>
              <label for="sou-genre">Genre</label>
              <input id="sou-genre" v-model="formulaire.genre" type="text" maxlength="80" placeholder="Ex. : Salegy" />
            </div>
            <div>
              <label for="sou-annee">Année de création</label>
              <input id="sou-annee" v-model="formulaire.annee" type="number" min="1800" max="2100" placeholder="2024" />
            </div>
            <div>
              <label for="sou-duree">Durée</label>
              <input id="sou-duree" v-model="formulaire.duree" type="text" inputmode="numeric" placeholder="3:45" />
              <p class="aide">Format minutes:secondes.</p>
            </div>
          </div>
        </section>

        <!-- 2. Ayants droit -->
        <section class="carte bloc">
          <h2><span class="numero">2</span> Ayants droit et répartition</h2>
          <p class="discret">Indiquez le rôle de chaque personne et sa part. La somme des parts doit être égale à 100 %.</p>

          <div v-for="(ligne, index) in formulaire.lignes" :key="ligne.cle" class="ligne-contribution">
            <div class="ligne-entete">
              <strong>Ayant droit {{ index + 1 }}</strong>
              <button type="button" class="btn btn-petit" :disabled="formulaire.lignes.length <= 1" @click="supprimerLigne(index)">
                Retirer
              </button>
            </div>
            <div class="ligne-grille">
              <div>
                <label :for="`sou-role-${ligne.cle}`">Rôle <span class="requis">*</span></label>
                <select :id="`sou-role-${ligne.cle}`" v-model="ligne.id_role" @change="changerRole(ligne, $event.target.value)">
                  <option value="">Choisir…</option>
                  <option v-for="r in roles" :key="r.id_role" :value="r.id_role">{{ r.libelle }}</option>
                </select>
              </div>
              <div>
                <span class="etiquette">Ayant droit <span class="requis">*</span></span>
                <PersonnePicker
                  v-model="ligne.personne"
                  :type-requis="estEditeur(ligne.id_role) ? 'MORALE' : null"
                  :id-prefixe="`sou-p-${ligne.cle}`"
                />
              </div>
              <div>
                <label :for="`sou-part-${ligne.cle}`">Part (%) <span class="requis">*</span></label>
                <input
                  :id="`sou-part-${ligne.cle}`"
                  v-model="ligne.part"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  inputmode="decimal"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div class="actions-ligne">
            <button type="button" class="btn" :disabled="formulaire.lignes.length >= 20" @click="ajouterLigne">
              + Ajouter un ayant droit
            </button>
            <button type="button" class="btn" @click="repartir">Répartir équitablement</button>
          </div>

          <ShareGauge :total="total" />
        </section>

        <!-- 3. Coordonnées -->
        <section class="carte bloc">
          <h2><span class="numero">3</span> Vos coordonnées</h2>
          <div class="grille-champs">
            <div class="plein">
              <label for="sou-email">Adresse email <span class="requis">*</span></label>
              <input id="sou-email" v-model="formulaire.email" type="email" autocomplete="email" />
              <p class="aide">Utilisée uniquement pour vous contacter au sujet de cette soumission. Elle n’est jamais affichée publiquement.</p>
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
          <button type="submit" class="btn btn-primaire" :disabled="envoi || erreurRoles !== ''">
            {{ envoi ? 'Envoi en cours…' : 'Envoyer la soumission' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
