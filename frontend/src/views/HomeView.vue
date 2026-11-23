<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api/client.js';
import PaginationBar from '../components/PaginationBar.vue';
import { formaterDuree } from '../utils/format.js';

const q = ref('');
const genre = ref('');
const annee = ref('');
const page = ref(1);
const limit = 10;

const resultats = ref([]);
const total = ref(0);
const chargement = ref(false);
const erreur = ref('');

let minuteur = null;
let numeroRequete = 0;

async function charger() {
  const numero = ++numeroRequete;
  chargement.value = true;
  erreur.value = '';
  try {
    const donnees = await api('/oeuvres', {
      params: { q: q.value.trim(), genre: genre.value.trim(), annee: annee.value, page: page.value, limit },
    });
    if (numero !== numeroRequete) return; // réponse périmée : une recherche plus récente est partie
    resultats.value = donnees.data;
    total.value = donnees.total;
  } catch (e) {
    if (numero !== numeroRequete) return;
    erreur.value = e.message;
    resultats.value = [];
    total.value = 0;
  } finally {
    if (numero === numeroRequete) chargement.value = false;
  }
}

// Recherche automatique 300 ms après la dernière frappe
watch([q, genre, annee], () => {
  page.value = 1;
  clearTimeout(minuteur);
  minuteur = setTimeout(charger, 300);
});
watch(page, charger);

onMounted(charger);
onBeforeUnmount(() => clearTimeout(minuteur));
</script>

<template>
  <section class="hero">
    <div class="container">
      <span class="hero-surtitre">Gestion des droits d'auteur</span>
      <h1>Le répertoire des œuvres malagasy</h1>
      <p class="hero-texte">
        Retrouvez les œuvres, leurs auteurs, compositeurs, arrangeurs et éditeurs, avec la répartition des parts de
        chacun.
      </p>
      <p class="hero-actions">
        <RouterLink class="btn btn-accent" :to="{ name: 'soumettre' }">Soumettre une œuvre</RouterLink>
      </p>
    </div>
  </section>

  <div class="container">
    <div class="recherche carte">
      <div>
        <label for="recherche-q">Titre ou ayant droit</label>
        <input id="recherche-q" v-model="q" type="search" placeholder="Ex. : Tanindrazako, Hery…" />
      </div>
      <div>
        <label for="recherche-genre">Genre</label>
        <input id="recherche-genre" v-model="genre" type="search" placeholder="Ex. : Salegy" />
      </div>
      <div>
        <label for="recherche-annee">Année</label>
        <input id="recherche-annee" v-model.number="annee" type="number" min="1800" max="2100" placeholder="2020" />
      </div>
    </div>

    <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

    <div v-else-if="chargement && resultats.length === 0" class="liste" aria-busy="true" aria-label="Chargement">
      <div v-for="n in 3" :key="n" class="carte squelette">
        <span class="s-ligne s-titre"></span>
        <span class="s-ligne"></span>
        <span class="s-ligne s-court"></span>
      </div>
    </div>

    <p v-else-if="resultats.length === 0" class="alerte alerte-info">Aucune œuvre ne correspond à votre recherche.</p>

    <template v-else>
      <p class="resume">
        <span>{{ total }} œuvre{{ total > 1 ? 's' : '' }} trouvée{{ total > 1 ? 's' : '' }}</span>
      </p>

      <div class="liste" :class="{ 'en-chargement': chargement }">
        <article v-for="o in resultats" :key="o.id_oeuvre" class="carte oeuvre">
          <div class="oeuvre-tete">
            <h2>
              <RouterLink :to="{ name: 'oeuvre', params: { id: o.id_oeuvre } }">{{ o.titre }}</RouterLink>
            </h2>
            <span v-if="o.genre" class="badge">{{ o.genre }}</span>
          </div>
          <p class="meta">
            {{ o.annee_creation ?? 'Année inconnue' }} · {{ formaterDuree(o.duree_sec) }}
            <template v-if="o.code_iswc"> · {{ o.code_iswc }}</template>
          </p>
          <ul class="contributeurs">
            <li v-for="c in o.contributions" :key="c.id_contribution">
              <span class="role">{{ c.role }}</span>
              <span>{{ c.nom_affiche }}</span>
              <span class="part">{{ c.part_pct }} %</span>
            </li>
          </ul>
        </article>
      </div>

      <PaginationBar v-model:page="page" :limit="limit" :total="total" />
    </template>
  </div>
</template>
