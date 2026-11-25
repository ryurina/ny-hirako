<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';
import { useStats } from '../composables/useStats.js';
import LogoMark from '../components/LogoMark.vue';
import Icone from '../components/Icone.vue';

const route = useRoute();
const router = useRouter();
const { utilisateur, estAdmin, deconnecter } = useAuth();
const { stats, rafraichir } = useStats();

const menuOuvert = ref(false);

const elements = computed(() => [
  { nom: 'Tableau de bord', icone: 'tableau', vers: { name: 'gestion' }, actif: route.name === 'gestion' },
  {
    nom: 'Œuvres',
    icone: 'oeuvres',
    vers: { name: 'gestion-oeuvres' },
    actif: route.path.startsWith('/gestion/oeuvres'),
    compteur: stats.value?.oeuvres_en_attente,
  },
  {
    nom: 'Ayants droit',
    icone: 'personnes',
    vers: { name: 'gestion-personnes' },
    actif: route.path.startsWith('/gestion/personnes'),
    compteur: stats.value?.personnes_en_attente,
  },
]);

// Section réservée aux administrateurs : tout ce qui touche à l'argent
const elementsAdmin = computed(() => [
  { nom: 'Diffuseurs', icone: 'radio', vers: { name: 'gestion-diffuseurs' }, actif: route.path.startsWith('/gestion/diffuseurs') },
  { nom: 'Diffusions', icone: 'calendrier', vers: { name: 'gestion-diffusions' }, actif: route.path.startsWith('/gestion/diffusions') },
  { nom: 'Droits perçus', icone: 'droits', vers: { name: 'gestion-droits' }, actif: route.path.startsWith('/gestion/droits') },
]);

const titre = computed(() => route.meta.titre ?? 'Espace de gestion');

// Le menu mobile se referme à chaque changement de page
watch(
  () => route.fullPath,
  () => {
    menuOuvert.value = false;
  },
);

onMounted(rafraichir);

function sortir() {
  deconnecter();
  router.push({ name: 'accueil' });
}
</script>

<template>
  <div class="gestion" :class="{ 'menu-ouvert': menuOuvert }">
    <aside class="barre-laterale" aria-label="Navigation de l'espace de gestion">
      <RouterLink :to="{ name: 'gestion' }" class="marque">
        <LogoMark :taille="36" />
        <span>
          <span class="marque-nom">ny-hirako</span>
          <span class="marque-sous-titre">Espace de gestion</span>
        </span>
      </RouterLink>

      <nav class="menu">
        <RouterLink v-for="el in elements" :key="el.nom" :to="el.vers" :class="{ actif: el.actif }">
          <Icone :nom="el.icone" />
          <span>{{ el.nom }}</span>
          <span v-if="el.compteur" class="compteur" :aria-label="`${el.compteur} en attente`">{{ el.compteur }}</span>
        </RouterLink>
      </nav>

      <template v-if="estAdmin">
        <p class="menu-titre">Administration</p>
        <nav class="menu" aria-label="Administration">
          <RouterLink v-for="el in elementsAdmin" :key="el.nom" :to="el.vers" :class="{ actif: el.actif }">
            <Icone :nom="el.icone" />
            <span>{{ el.nom }}</span>
          </RouterLink>
        </nav>
      </template>

      <div class="barre-bas">
        <div class="utilisateur-lateral">
          <span class="utilisateur-email">{{ utilisateur?.email }}</span>
          <span class="badge badge-or">{{ utilisateur?.role }}</span>
        </div>
        <RouterLink :to="{ name: 'accueil' }" class="lien-bas">
          <Icone nom="site" :taille="16" /> Voir le site public
        </RouterLink>
        <button type="button" class="lien-bas" @click="sortir"><Icone nom="sortie" :taille="16" /> Déconnexion</button>
      </div>
    </aside>

    <div class="voile" @click="menuOuvert = false"></div>

    <div class="gestion-principal">
      <header class="topbar">
        <button type="button" class="btn btn-menu" aria-label="Ouvrir le menu" @click="menuOuvert = true">
          <Icone nom="menu" :taille="20" />
        </button>
        <h1>{{ titre }}</h1>
      </header>
      <main class="gestion-contenu">
        <RouterView />
      </main>
    </div>
  </div>
</template>
