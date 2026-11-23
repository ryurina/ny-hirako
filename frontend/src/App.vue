<script setup>
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useAuth } from './composables/useAuth.js';
import LogoMark from './components/LogoMark.vue';

const { utilisateur, estConnecte, deconnecter } = useAuth();
const router = useRouter();

function sortir() {
  deconnecter();
  router.push({ name: 'accueil' });
}
</script>

<template>
  <header class="site-header">
    <div class="container">
      <RouterLink :to="{ name: 'accueil' }" class="marque">
        <LogoMark />
        <span>
          <span class="marque-nom">ny-hirako</span>
          <span class="marque-sous-titre">Droits d'auteur malagasy</span>
        </span>
      </RouterLink>

      <nav class="navigation" aria-label="Navigation principale">
        <RouterLink :to="{ name: 'accueil' }">Œuvres</RouterLink>
        <template v-if="estConnecte">
          <span class="utilisateur">
            <span>{{ utilisateur.email }}</span>
            <span class="badge badge-or">{{ utilisateur.role }}</span>
          </span>
          <button class="btn btn-petit" type="button" @click="sortir">Déconnexion</button>
        </template>
        <RouterLink v-else :to="{ name: 'connexion' }">Connexion</RouterLink>
      </nav>
    </div>
  </header>

  <main>
    <RouterView />
  </main>

  <footer class="site-footer">ny-hirako · Gestion des droits d'auteur · Projet de base de données relationnelle</footer>
</template>
