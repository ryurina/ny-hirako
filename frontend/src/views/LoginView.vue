<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';
import LogoMark from '../components/LogoMark.vue';

const route = useRoute();
const router = useRouter();
const { connecter } = useAuth();

const email = ref('');
const motDePasse = ref('');
const erreur = ref('');
const envoi = ref(false);

// Redirection après connexion : uniquement vers une page interne du site
function destination() {
  const cible = route.query.redirect;
  return typeof cible === 'string' && cible.startsWith('/') && !cible.startsWith('//') ? cible : '/';
}

async function soumettre() {
  erreur.value = '';
  envoi.value = true;
  try {
    await connecter(email.value.trim(), motDePasse.value);
    router.push(destination());
  } catch (e) {
    erreur.value = e.message;
  } finally {
    envoi.value = false;
  }
}
</script>

<template>
  <div class="page-connexion">
    <LogoMark :taille="52" />
    <section class="formulaire-connexion carte" style="margin-top: 1.25rem">
      <h1>Connexion</h1>
      <p class="discret">Espace réservé aux modérateurs et aux administrateurs.</p>

      <form @submit.prevent="soumettre">
        <div class="champ">
          <label for="connexion-email">Adresse email</label>
          <input id="connexion-email" v-model="email" type="email" autocomplete="username" required />
        </div>
        <div class="champ">
          <label for="connexion-mdp">Mot de passe</label>
          <input id="connexion-mdp" v-model="motDePasse" type="password" autocomplete="current-password" required />
        </div>

        <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

        <button class="btn btn-primaire" type="submit" :disabled="envoi">
          {{ envoi ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>
    </section>
  </div>
</template>
