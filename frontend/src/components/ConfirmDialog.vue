<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  ouvert: { type: Boolean, default: false },
  titre: { type: String, required: true },
  message: { type: String, required: true },
  libelleConfirmer: { type: String, default: 'Confirmer' },
  danger: { type: Boolean, default: false },
  enCours: { type: Boolean, default: false },
});
const emit = defineEmits(['confirmer', 'annuler']);

const dialogue = ref(null);

watch(
  () => props.ouvert,
  (valeur) => {
    const d = dialogue.value;
    if (!d) return;
    if (valeur && !d.open) d.showModal();
    else if (!valeur && d.open) d.close();
  },
);
</script>

<template>
  <dialog ref="dialogue" class="dialogue" @cancel.prevent="emit('annuler')" @click.self="emit('annuler')">
    <div class="dialogue-contenu">
      <h2>{{ titre }}</h2>
      <p class="discret">{{ message }}</p>
      <div class="dialogue-actions">
        <button type="button" class="btn" @click="emit('annuler')">Annuler</button>
        <button
          type="button"
          class="btn"
          :class="danger ? 'btn-danger-plein' : 'btn-primaire'"
          :disabled="enCours"
          @click="emit('confirmer')"
        >
          {{ enCours ? 'Patientez…' : libelleConfirmer }}
        </button>
      </div>
    </div>
  </dialog>
</template>
