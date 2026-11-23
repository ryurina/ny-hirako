<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import { api } from '../api/client.js';

const props = defineProps({
  // { mode: 'existante' | 'nouvelle', selection: {id_personne, type, libelle} | null, nouvelle: {...} }
  modelValue: { type: Object, required: true },
  typeRequis: { type: String, default: null }, // 'MORALE' lorsque le rôle est Éditeur
  idPrefixe: { type: String, required: true },
});
const emit = defineEmits(['update:modelValue']);

const recherche = ref('');
const resultats = ref([]);
const enCours = ref(false);
const erreur = ref('');
const ouvert = ref(false);

let minuteur = null;
let numeroRequete = 0;

const mode = computed(() => props.modelValue.mode);
const nouvelle = computed(() => props.modelValue.nouvelle);
const typeEffectif = computed(() => props.typeRequis ?? nouvelle.value.type);

function maj(partiel) {
  emit('update:modelValue', { ...props.modelValue, ...partiel });
}

function majNouvelle(partiel) {
  maj({ nouvelle: { ...nouvelle.value, ...partiel } });
}

function nomAffiche(p) {
  return p.nom_artiste || [p.prenom, p.nom].filter(Boolean).join(' ');
}

function detail(p) {
  const morceaux = [];
  if (p.nom_artiste && (p.prenom || p.nom)) morceaux.push([p.prenom, p.nom].filter(Boolean).join(' '));
  if (p.ville) morceaux.push(p.ville);
  morceaux.push(`${p.nb_oeuvres} œuvre${p.nb_oeuvres > 1 ? 's' : ''}`);
  return morceaux.join(' · ');
}

async function chercher() {
  const q = recherche.value.trim();
  const numero = ++numeroRequete;
  if (!q) {
    resultats.value = [];
    enCours.value = false;
    return;
  }
  enCours.value = true;
  erreur.value = '';
  try {
    const donnees = await api('/personnes', { params: { q, type: props.typeRequis ?? '', limit: 6 } });
    if (numero !== numeroRequete) return;
    resultats.value = donnees.data;
  } catch (e) {
    if (numero !== numeroRequete) return;
    erreur.value = e.message;
    resultats.value = [];
  } finally {
    if (numero === numeroRequete) enCours.value = false;
  }
}

watch(recherche, () => {
  ouvert.value = true;
  clearTimeout(minuteur);
  minuteur = setTimeout(chercher, 250);
});

// Si le rôle devient « Éditeur », on relance la recherche avec le filtre « personne morale »
watch(
  () => props.typeRequis,
  () => {
    if (recherche.value.trim()) chercher();
  },
);

function choisir(personne) {
  maj({ selection: { id_personne: personne.id_personne, type: personne.type, libelle: nomAffiche(personne) } });
  recherche.value = '';
  resultats.value = [];
  ouvert.value = false;
}

function passerEnNouvelle() {
  maj({
    mode: 'nouvelle',
    selection: null,
    nouvelle: { ...nouvelle.value, nom: recherche.value.trim() || nouvelle.value.nom, type: typeEffectif.value },
  });
  recherche.value = '';
  resultats.value = [];
  ouvert.value = false;
}

onBeforeUnmount(() => clearTimeout(minuteur));
</script>

<template>
  <div class="picker">
    <div class="segment" role="group" aria-label="Choix de l'ayant droit">
      <button type="button" :class="{ actif: mode === 'existante' }" :aria-pressed="mode === 'existante'" @click="maj({ mode: 'existante' })">
        Ayant droit existant
      </button>
      <button type="button" :class="{ actif: mode === 'nouvelle' }" :aria-pressed="mode === 'nouvelle'" @click="maj({ mode: 'nouvelle' })">
        Nouvelle personne
      </button>
    </div>

    <!-- Ayant droit déjà enregistré -->
    <template v-if="mode === 'existante'">
      <div v-if="modelValue.selection" class="selection">
        <span class="badge badge-succes">Sélectionné</span>
        <strong>{{ modelValue.selection.libelle }}</strong>
        <button type="button" class="btn btn-petit" @click="maj({ selection: null })">Changer</button>
      </div>

      <div v-else class="recherche-personne">
        <input
          :id="`${idPrefixe}-recherche`"
          v-model="recherche"
          type="search"
          autocomplete="off"
          :placeholder="typeRequis === 'MORALE' ? 'Rechercher un éditeur…' : 'Rechercher par nom ou nom d’artiste…'"
          aria-label="Rechercher un ayant droit"
        />
        <div v-if="ouvert && recherche.trim()" class="resultats-liste">
          <p v-if="enCours" class="aide">Recherche…</p>
          <p v-else-if="erreur" class="aide texte-erreur">{{ erreur }}</p>
          <template v-else>
            <button v-for="p in resultats" :key="p.id_personne" type="button" class="resultat" @click="choisir(p)">
              <span class="resultat-nom">{{ nomAffiche(p) }}</span>
              <span class="resultat-detail">{{ detail(p) }}</span>
            </button>
            <p v-if="resultats.length === 0" class="aide">Aucun ayant droit trouvé.</p>
            <button type="button" class="resultat resultat-creer" @click="passerEnNouvelle">
              + Ajouter « {{ recherche.trim() }} » comme nouvelle personne
            </button>
          </template>
        </div>
      </div>
    </template>

    <!-- Nouvelle personne : elle sera validée par un modérateur -->
    <div v-else class="grille-champs">
      <div>
        <label :for="`${idPrefixe}-type`">Type</label>
        <select
          :id="`${idPrefixe}-type`"
          :value="typeEffectif"
          :disabled="typeRequis !== null"
          @change="majNouvelle({ type: $event.target.value })"
        >
          <option value="PHYSIQUE">Personne physique</option>
          <option value="MORALE">Personne morale (société, éditeur…)</option>
        </select>
      </div>
      <div>
        <label :for="`${idPrefixe}-nom`">{{ typeEffectif === 'MORALE' ? 'Raison sociale' : 'Nom' }} <span class="requis">*</span></label>
        <input :id="`${idPrefixe}-nom`" :value="nouvelle.nom" type="text" maxlength="150" @input="majNouvelle({ nom: $event.target.value })" />
      </div>
      <template v-if="typeEffectif === 'PHYSIQUE'">
        <div>
          <label :for="`${idPrefixe}-prenom`">Prénom <span class="requis">*</span></label>
          <input :id="`${idPrefixe}-prenom`" :value="nouvelle.prenom" type="text" maxlength="100" @input="majNouvelle({ prenom: $event.target.value })" />
        </div>
        <div>
          <label :for="`${idPrefixe}-artiste`">Nom d’artiste</label>
          <input :id="`${idPrefixe}-artiste`" :value="nouvelle.nom_artiste" type="text" maxlength="150" @input="majNouvelle({ nom_artiste: $event.target.value })" />
        </div>
      </template>
      <div>
        <label :for="`${idPrefixe}-ville`">Ville</label>
        <input :id="`${idPrefixe}-ville`" :value="nouvelle.ville" type="text" maxlength="100" @input="majNouvelle({ ville: $event.target.value })" />
      </div>
      <p class="aide plein">Cette personne sera ajoutée au répertoire après validation par un modérateur.</p>
    </div>
  </div>
</template>
