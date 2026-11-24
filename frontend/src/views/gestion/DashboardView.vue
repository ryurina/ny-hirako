<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../../api/client.js';
import { useStats } from '../../composables/useStats.js';
import { useAuth } from '../../composables/useAuth.js';
import StatCard from '../../components/StatCard.vue';
import { formaterAriary, formaterDate, nomPersonne, libelleType } from '../../utils/format.js';

const { stats, rafraichir } = useStats();
const { estAdmin } = useAuth();

const oeuvres = ref([]);
const personnes = ref([]);
const chargement = ref(true);
const erreur = ref('');

onMounted(async () => {
  try {
    const [o, p] = await Promise.all([
      api('/gestion/oeuvres', { params: { statut: 'EN_ATTENTE', limit: 5 } }),
      api('/gestion/personnes', { params: { statut: 'EN_ATTENTE', limit: 5 } }),
      rafraichir(),
    ]);
    oeuvres.value = o.data;
    personnes.value = p.data;
  } catch (e) {
    erreur.value = e.message;
  } finally {
    chargement.value = false;
  }
});
</script>

<template>
  <p class="discret intro">Vue d’ensemble du répertoire et des soumissions à traiter.</p>

  <p v-if="erreur" class="alerte alerte-erreur" role="alert">{{ erreur }}</p>

  <section class="kpis" aria-label="Chiffres clés">
    <StatCard libelle="Œuvres validées" :valeur="stats?.oeuvres_validees" aide="Visibles dans le répertoire public" />
    <StatCard
      libelle="Œuvres en attente"
      :valeur="stats?.oeuvres_en_attente"
      ton="attente"
      aide="À examiner"
      :vers="{ name: 'gestion-oeuvres', query: { statut: 'EN_ATTENTE' } }"
    />
    <StatCard libelle="Ayants droit validés" :valeur="stats?.personnes_validees" aide="Dans le répertoire" />
    <StatCard
      libelle="Ayants droit en attente"
      :valeur="stats?.personnes_en_attente"
      ton="attente"
      aide="À examiner"
      :vers="{ name: 'gestion-personnes', query: { statut: 'EN_ATTENTE' } }"
    />
    <template v-if="estAdmin && stats && stats.diffusions !== null">
      <StatCard libelle="Diffusions enregistrées" :valeur="stats.diffusions" aide="Toutes périodes" ton="or" />
      <StatCard libelle="Montant total diffusé" :valeur="formaterAriary(stats.montant_total_diffusions)" aide="Base de calcul des droits" ton="or" />
    </template>
  </section>

  <h2 class="titre-section">À traiter</h2>
  <div class="deux-colonnes">
    <section class="carte">
      <div class="entete-carte">
        <h3>Œuvres en attente</h3>
        <RouterLink :to="{ name: 'gestion-oeuvres', query: { statut: 'EN_ATTENTE' } }">Tout voir</RouterLink>
      </div>
      <p v-if="chargement" class="discret">Chargement…</p>
      <p v-else-if="oeuvres.length === 0" class="alerte alerte-succes">Tout est à jour : aucune œuvre en attente.</p>
      <ul v-else class="liste-simple">
        <li v-for="o in oeuvres" :key="o.id_oeuvre">
          <RouterLink :to="{ name: 'gestion-oeuvre', params: { id: o.id_oeuvre } }">{{ o.titre }}</RouterLink>
          <span class="discret">Soumise le {{ formaterDate(o.date_soumission) }}</span>
        </li>
      </ul>
    </section>

    <section class="carte">
      <div class="entete-carte">
        <h3>Ayants droit en attente</h3>
        <RouterLink :to="{ name: 'gestion-personnes', query: { statut: 'EN_ATTENTE' } }">Tout voir</RouterLink>
      </div>
      <p v-if="chargement" class="discret">Chargement…</p>
      <p v-else-if="personnes.length === 0" class="alerte alerte-succes">Tout est à jour : aucun ayant droit en attente.</p>
      <ul v-else class="liste-simple">
        <li v-for="p in personnes" :key="p.id_personne">
          <RouterLink :to="{ name: 'gestion-personne', params: { id: p.id_personne } }">{{ nomPersonne(p) }}</RouterLink>
          <span class="discret">{{ libelleType(p.type) }}{{ p.ville ? ' · ' + p.ville : '' }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
