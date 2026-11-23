<script setup>
import { computed } from 'vue';
import { formaterPourcent } from '../utils/soumission.js';

const props = defineProps({ total: { type: Number, required: true } }); // en pourcents

const centimes = computed(() => Math.round(props.total * 100));
const etat = computed(() => (centimes.value === 10000 ? 'complet' : centimes.value > 10000 ? 'depasse' : 'incomplet'));
const largeur = computed(() => Math.min(100, props.total));
const message = computed(() => {
  if (etat.value === 'complet') return 'Répartition complète';
  if (etat.value === 'depasse') return `Dépassement de ${formaterPourcent(props.total - 100)} %`;
  return `Il reste ${formaterPourcent(100 - props.total)} % à attribuer`;
});
</script>

<template>
  <div class="jauge" :class="`jauge-${etat}`" role="status" aria-live="polite">
    <div class="jauge-entete">
      <strong>Total des parts : {{ formaterPourcent(total) }} %</strong>
      <span>{{ message }}</span>
    </div>
    <div class="jauge-barre" aria-hidden="true">
      <span :style="{ width: largeur + '%' }"></span>
    </div>
  </div>
</template>
