<script setup>
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useAuth } from './composables/useAuth.js';
import LogoMark from './components/LogoMark.vue';
import SiteFooter from './components/SiteFooter.vue';

const { utilisateur, estConnecte, deconnecter } = useAuth();
const route = useRoute();
const router = useRouter();

// L'espace de gestion a sa propre mise en page (barre latérale) : on masque l'en-tête public
const enGestion = computed(() => route.matched.some((r) => r.meta.gestion));

function sortir() {
  deconnecter();
  router.push({ name: 'accueil' });
}
</script>

<template>
  <header v-if="!enGestion" class="site-header">
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
        <RouterLink :to="{ name: 'soumettre' }">Soumettre une œuvre</RouterLink>
        <template v-if="estConnecte">
          <RouterLink :to="{ name: 'gestion' }">Espace de gestion</RouterLink>
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

  <SiteFooter v-if="!enGestion" />
</template>
