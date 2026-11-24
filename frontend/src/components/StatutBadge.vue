<script setup>
import { computed } from 'vue';

const props = defineProps({ statut: { type: String, required: true } });

const config = {
  EN_ATTENTE: { classe: 'badge-attente', libelle: 'En attente' },
  VALIDE: { classe: 'badge-succes', libelle: 'Validée' },
  REJETE: { classe: 'badge-erreur', libelle: 'Rejetée' },
};
const courant = computed(() => config[props.statut] ?? { classe: '', libelle: props.statut });
</script>

<template>
  <span class="badge" :class="courant.classe">{{ courant.libelle }}</span>
</template>
