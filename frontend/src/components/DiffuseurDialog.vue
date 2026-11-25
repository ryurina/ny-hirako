<script setup>
import { ref, computed, watch } from 'vue';
import { TYPES_DIFFUSEUR } from '../utils/format.js';

const props = defineProps({
  ouvert: { type: Boolean, default: false },
  diffuseur: { type: Object, default: null }, // null : création
  enCours: { type: Boolean, default: false },
  erreur: { type: String, default: '' },
});
const emit = defineEmits(['enregistrer', 'annuler']);

const dialogue = ref(null);
const nom = ref('');
const type = ref('RADIO');
const ville = ref('');

const complet = computed(() => nom.value.trim() !== '' && ville.value.trim() !== '');

watch(
  () => props.ouvert,
  (valeur) => {
    const d = dialogue.value;
    if (!d) return;
    if (valeur) {
      nom.value = props.diffuseur?.nom ?? '';
      type.value = props.diffuseur?.type ?? 'RADIO';
      ville.value = props.diffuseur?.ville ?? '';
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  },
);

function valider() {
  if (!complet.value) return;
  emit('enregistrer', { nom: nom.value.trim(), type: type.value, ville: ville.value.trim() });
}
</script>

<template>
  <dialog ref="dialogue" class="dialogue" @cancel.prevent="emit('annuler')" @click.self="emit('annuler')">
    <form class="dialogue-contenu" @submit.prevent="valider">
      <h2>{{ diffuseur ? 'Modifier le diffuseur' : 'Nouveau diffuseur' }}</h2>

      <div class="champ-dialogue">
        <label for="diff-nom">Nom <span class="requis">*</span></label>
        <input id="diff-nom" v-model="nom" type="text" maxlength="150" autocomplete="off" />
      </div>
      <div class="champ-dialogue">
        <label for="diff-type">Type <span class="requis">*</span></label>
        <select id="diff-type" v-model="type">
          <option v-for="t in TYPES_DIFFUSEUR" :key="t.valeur" :value="t.valeur">{{ t.libelle }}</option>
        </select>
      </div>
      <div class="champ-dialogue">
        <label for="diff-ville">Ville <span class="requis">*</span></label>
        <input id="diff-ville" v-model="ville" type="text" maxlength="100" autocomplete="off" />
      </div>

      <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

      <div class="dialogue-actions">
        <button type="button" class="btn" @click="emit('annuler')">Annuler</button>
        <button type="submit" class="btn btn-primaire" :disabled="enCours || !complet">
          {{ enCours ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
    </form>
  </dialog>
</template>
