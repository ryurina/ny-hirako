<script setup>
import { computed } from 'vue';

const props = defineProps({
  page: { type: Number, required: true },
  limit: { type: Number, required: true },
  total: { type: Number, required: true },
});
const emit = defineEmits(['update:page']);

const nbPages = computed(() => Math.max(1, Math.ceil(props.total / props.limit)));
</script>

<template>
  <nav v-if="nbPages > 1" class="pagination" aria-label="Pagination">
    <button class="btn" type="button" :disabled="page <= 1" @click="emit('update:page', page - 1)">
      ← Précédent
    </button>
    <span class="discret">Page {{ page }} sur {{ nbPages }}</span>
    <button class="btn" type="button" :disabled="page >= nbPages" @click="emit('update:page', page + 1)">
      Suivant →
    </button>
  </nav>
</template>
