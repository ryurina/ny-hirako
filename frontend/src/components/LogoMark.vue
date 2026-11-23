<script setup>
defineProps({ taille: { type: Number, default: 38 } });
</script>

<template>
  <svg
    class="logo"
    :width="taille"
    :height="taille"
    viewBox="0 0 36 36"
    role="img"
    aria-label="ny-hirako"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="36" height="36" rx="10" fill="#172554" />
    <ellipse cx="14" cy="24.5" rx="4.4" ry="3.3" transform="rotate(-20 14 24.5)" fill="#D6A84F" />
    <rect x="17.4" y="9" width="2.2" height="15.5" rx="1" fill="#D6A84F" />
    <path d="M19.6 9 C24.5 10 26.5 13.2 26 17.5 C24.4 14.8 22.4 13.6 19.6 13 Z" fill="#D6A84F" />
  </svg>
</template>
