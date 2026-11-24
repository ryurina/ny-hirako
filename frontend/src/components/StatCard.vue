<script setup>
import { RouterLink } from 'vue-router';

defineProps({
  libelle: { type: String, required: true },
  valeur: { type: [String, Number], default: null },
  aide: { type: String, default: '' },
  ton: { type: String, default: 'normal' }, // 'normal' | 'attente' | 'or'
  vers: { type: Object, default: null }, // destination du lien (facultatif)
});
</script>

<template>
  <component :is="vers ? RouterLink : 'div'" :to="vers ?? undefined" class="kpi" :class="[`kpi-${ton}`, { 'kpi-lien': vers }]">
    <span class="kpi-libelle">{{ libelle }}</span>
    <span class="kpi-valeur">{{ valeur ?? '—' }}</span>
    <span v-if="aide" class="kpi-aide">{{ aide }}</span>
  </component>
</template>
