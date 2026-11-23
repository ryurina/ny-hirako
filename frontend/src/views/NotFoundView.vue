<script setup>
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="container page">
    <section class="carte centre">
      <p class="surtitre">Erreur 404</p>
      <h1>Page introuvable</h1>
      <p class="discret">Cette adresse ne correspond à aucune page du site.</p>
      <RouterLink class="btn btn-primaire" :to="{ name: 'accueil' }">Retour au répertoire</RouterLink>
    </section>
  </div>
</template>
