<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { api } from '../api/client.js';

// Sélection d'une œuvre validée. La valeur est l'œuvre complète (avec ses contributions).
const props = defineProps({
  modelValue: { type: Object, default: null },
  idPrefixe: { type: String, default: 'oeuvre' },
});
const emit = defineEmits(['update:modelValue']);

const recherche = ref('');
const resultats = ref([]);
const enCours = ref(false);
const erreur = ref('');
const ouvert = ref(false);

let minuteur = null;
let numeroRequete = 0;

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
    const donnees = await api('/oeuvres', { params: { q, limit: 6 } });
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

function choisir(oeuvre) {
  emit('update:modelValue', oeuvre);
  recherche.value = '';
  resultats.value = [];
  ouvert.value = false;
}

onBeforeUnmount(() => clearTimeout(minuteur));
</script>

<template>
  <div>
    <div v-if="props.modelValue" class="selection">
      <span class="badge badge-succes">Sélectionnée</span>
      <strong>{{ props.modelValue.titre }}</strong>
      <button type="button" class="btn btn-petit" @click="emit('update:modelValue', null)">Changer</button>
    </div>

    <div v-else class="recherche-personne">
      <input
        :id="`${idPrefixe}-recherche`"
        v-model="recherche"
        type="search"
        autocomplete="off"
        placeholder="Rechercher une œuvre validée par son titre…"
        aria-label="Rechercher une œuvre"
      />
      <div v-if="ouvert && recherche.trim()" class="resultats-liste">
        <p v-if="enCours" class="aide">Recherche…</p>
        <p v-else-if="erreur" class="aide texte-erreur">{{ erreur }}</p>
        <template v-else>
          <button v-for="o in resultats" :key="o.id_oeuvre" type="button" class="resultat" @click="choisir(o)">
            <span class="resultat-nom">{{ o.titre }}</span>
            <span class="resultat-detail">
              {{ [o.genre, o.annee_creation].filter(Boolean).join(' · ') }}{{ o.genre || o.annee_creation ? ' · ' : '' }}{{ o.contributions.length }}
              contribution{{ o.contributions.length > 1 ? 's' : '' }}
            </span>
          </button>
          <p v-if="resultats.length === 0" class="aide">Aucune œuvre validée trouvée.</p>
        </template>
      </div>
    </div>
  </div>
</template>
