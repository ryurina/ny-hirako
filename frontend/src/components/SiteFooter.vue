<script setup>
import { RouterLink } from 'vue-router';
import LogoMark from './LogoMark.vue';
import { SITE } from '../config/site.js';

const annee = new Date().getFullYear();

// Liens purement décoratifs : ils ne mènent nulle part dans cette version du projet
const liensInformations = ['Confidentialité', 'Conditions d’utilisation', 'Mentions légales', 'Cookies', 'Contact'];
</script>

<template>
  <footer class="site-footer">
    <div class="container pied">
      <div class="pied-marque">
        <RouterLink :to="{ name: 'accueil' }" class="marque">
          <LogoMark :taille="34" />
          <span>
            <span class="marque-nom">{{ SITE.nom }}</span>
            <span class="marque-sous-titre">Droits d'auteur malagasy</span>
          </span>
        </RouterLink>
        <p>
          Répertoire des œuvres et gestion des droits des auteurs, compositeurs, arrangeurs et éditeurs de Madagascar.
        </p>
      </div>

      <nav class="pied-colonne" aria-label="Explorer">
        <p class="pied-titre">Explorer</p>
        <RouterLink :to="{ name: 'accueil' }">Répertoire des œuvres</RouterLink>
        <RouterLink :to="{ name: 'soumettre' }">Soumettre une œuvre</RouterLink>
        <RouterLink :to="{ name: 'connexion' }">Espace professionnel</RouterLink>
      </nav>

      <nav class="pied-colonne" aria-label="Informations">
        <p class="pied-titre">Informations</p>
        <a v-for="libelle in liensInformations" :key="libelle" href="#" @click.prevent>{{ libelle }}</a>
      </nav>

      <nav class="pied-colonne" aria-label="Projet">
        <p class="pied-titre">Projet</p>
        <a :href="SITE.github" target="_blank" rel="noopener noreferrer">Profil GitHub</a>
        <a :href="SITE.depot" target="_blank" rel="noopener noreferrer">Code source du projet</a>
      </nav>
    </div>

    <div class="pied-bas">
      <div class="container pied-bas-contenu">
        <span>© {{ annee }} {{ SITE.nom }}. Tous droits réservés.</span>
        <span>
          Conçu et développé par
          <a :href="SITE.github" target="_blank" rel="noopener noreferrer">{{ SITE.auteur }}</a>
        </span>
      </div>
    </div>
  </footer>
</template>
