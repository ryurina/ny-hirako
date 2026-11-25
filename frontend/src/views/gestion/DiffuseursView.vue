<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../../api/client.js';
import { supprimerDiffuseur } from '../../api/gestion.js';
import PaginationBar from '../../components/PaginationBar.vue';
import ConfirmDialog from '../../components/ConfirmDialog.vue';
import DiffuseurDialog from '../../components/DiffuseurDialog.vue';
import { formaterAriary, libelleTypeDiffuseur, TYPES_DIFFUSEUR } from '../../utils/format.js';

const q = ref('');
const type = ref('');
const page = ref(1);
const limit = 10;

const lignes = ref([]);
const total = ref(0);
const chargement = ref(true);
const erreur = ref('');
const info = ref('');

// Fenêtre de création / modification
const dialogueOuvert = ref(false);
const enEdition = ref(null);
const enregistrement = ref(false);
const erreurFormulaire = ref('');

// Suppression
const aSupprimer = ref(null);
const suppressionEnCours = ref(false);

let minuteur = null;
let numeroRequete = 0;

async function charger() {
  const numero = ++numeroRequete;
  chargement.value = true;
  try {
    const donnees = await api('/gestion/diffuseurs', {
      params: { q: q.value.trim(), type: type.value, page: page.value, limit },
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

function ouvrirCreation() {
  enEdition.value = null;
  erreurFormulaire.value = '';
  dialogueOuvert.value = true;
}

function ouvrirEdition(diffuseur) {
  enEdition.value = diffuseur;
  erreurFormulaire.value = '';
  dialogueOuvert.value = true;
}

async function enregistrer(donnees) {
  enregistrement.value = true;
  erreurFormulaire.value = '';
  try {
    if (enEdition.value) {
      await api(`/gestion/diffuseurs/${enEdition.value.id_diffuseur}`, { method: 'PUT', body: donnees });
      info.value = `Diffuseur « ${donnees.nom} » modifié.`;
    } else {
      await api('/gestion/diffuseurs', { method: 'POST', body: donnees });
      info.value = `Diffuseur « ${donnees.nom} » créé.`;
    }
    dialogueOuvert.value = false;
    await charger();
  } catch (e) {
    erreurFormulaire.value = e.status === 409 ? 'Un diffuseur de ce nom existe déjà dans cette ville.' : e.message;
  } finally {
    enregistrement.value = false;
  }
}

async function supprimer() {
  suppressionEnCours.value = true;
  erreur.value = '';
  info.value = '';
  const diffuseur = aSupprimer.value;
  try {
    await supprimerDiffuseur(diffuseur.id_diffuseur);
    info.value = `Diffuseur « ${diffuseur.nom} » supprimé.`;
    aSupprimer.value = null;
    await charger();
  } catch (e) {
    aSupprimer.value = null;
    erreur.value = `« ${diffuseur.nom} » : ${e.message}`;
  } finally {
    suppressionEnCours.value = false;
  }
}

watch([q, type], () => {
  page.value = 1;
  clearTimeout(minuteur);
  minuteur = setTimeout(charger, 300);
});
watch(page, charger);

onMounted(charger);
onBeforeUnmount(() => clearTimeout(minuteur));
</script>

<template>
  <div class="barre-outils">
    <input v-model="q" type="search" placeholder="Rechercher un diffuseur…" aria-label="Rechercher" />
    <select v-model="type" aria-label="Type de diffuseur" class="select-court">
      <option value="">Tous les types</option>
      <option v-for="t in TYPES_DIFFUSEUR" :key="t.valeur" :value="t.valeur">{{ t.libelle }}</option>
    </select>
    <button type="button" class="btn btn-primaire pousser" @click="ouvrirCreation">+ Nouveau diffuseur</button>
  </div>

  <p v-if="info" class="alerte alerte-succes" role="status">{{ info }}</p>
  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

  <section class="carte carte-table">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Diffuseur</th>
            <th>Type</th>
            <th>Ville</th>
            <th class="droite">Diffusions</th>
            <th class="droite">Total diffusé</th>
            <th class="droite">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="chargement && lignes.length === 0">
            <td colspan="6" class="discret">Chargement…</td>
          </tr>
          <tr v-else-if="lignes.length === 0">
            <td colspan="6" class="discret">Aucun diffuseur ne correspond à cette recherche.</td>
          </tr>
          <tr v-for="d in lignes" :key="d.id_diffuseur">
            <td class="lien-titre">{{ d.nom }}</td>
            <td><span class="badge">{{ libelleTypeDiffuseur(d.type) }}</span></td>
            <td>{{ d.ville }}</td>
            <td class="droite">{{ d.nb_diffusions }}</td>
            <td class="droite montant">{{ formaterAriary(d.total_diffusions) }}</td>
            <td>
              <div class="actions-table">
                <button type="button" class="btn btn-petit" @click="ouvrirEdition(d)">Modifier</button>
                <button type="button" class="btn btn-petit btn-danger" @click="aSupprimer = d">Supprimer</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <PaginationBar v-model:page="page" :limit="limit" :total="total" />

  <DiffuseurDialog
    :ouvert="dialogueOuvert"
    :diffuseur="enEdition"
    :en-cours="enregistrement"
    :erreur="erreurFormulaire"
    @enregistrer="enregistrer"
    @annuler="dialogueOuvert = false"
  />

  <ConfirmDialog
    :ouvert="aSupprimer !== null"
    titre="Supprimer ce diffuseur ?"
    :message="`« ${aSupprimer?.nom ?? ''} » sera supprimé définitivement. Impossible s'il a déjà des diffusions enregistrées.`"
    libelle-confirmer="Supprimer"
    danger
    :en-cours="suppressionEnCours"
    @confirmer="supprimer"
    @annuler="aSupprimer = null"
  />
</template>
