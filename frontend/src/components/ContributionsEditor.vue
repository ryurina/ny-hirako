<script setup>
import { computed } from 'vue';
import PersonnePicker from './PersonnePicker.vue';
import ShareGauge from './ShareGauge.vue';
import { totalCentimes, repartirEquitablement } from '../utils/soumission.js';

const MAX_LIGNES = 20;
let compteur = 1000; // les clés des lignes ajoutées ne doivent pas entrer en conflit avec celles du parent

// `lignes` est un tableau réactif appartenant au parent : il est modifié sur place
const props = defineProps({
  lignes: { type: Array, required: true },
  roles: { type: Array, required: true },
  prefixe: { type: String, default: 'edit' },
});

const total = computed(() => totalCentimes(props.lignes) / 100);
const estEditeur = (valeur) => props.roles.find((r) => String(r.id_role) === String(valeur))?.libelle === 'Éditeur';

function nouvelleLigne() {
  return {
    cle: ++compteur,
    id_role: '',
    part: '',
    personne: {
      mode: 'existante',
      selection: null,
      nouvelle: { type: 'PHYSIQUE', nom: '', prenom: '', nom_artiste: '', ville: '' },
    },
  };
}

// Un éditeur est toujours une personne morale
function changerRole(ligne, valeur) {
  if (!estEditeur(valeur)) return;
  const n = ligne.personne.nouvelle;
  n.type = 'MORALE';
  n.prenom = '';
  n.nom_artiste = '';
  if (ligne.personne.selection && ligne.personne.selection.type !== 'MORALE') ligne.personne.selection = null;
}

function ajouter() {
  if (props.lignes.length < MAX_LIGNES) props.lignes.push(nouvelleLigne());
}

function retirer(index) {
  if (props.lignes.length > 1) props.lignes.splice(index, 1);
}

function repartir() {
  const parts = repartirEquitablement(props.lignes.length);
  props.lignes.forEach((ligne, i) => {
    ligne.part = parts[i];
  });
}
</script>

<template>
  <div>
    <div v-for="(ligne, index) in lignes" :key="ligne.cle" class="ligne-contribution">
      <div class="ligne-entete">
        <strong>Ayant droit {{ index + 1 }}</strong>
        <button type="button" class="btn btn-petit" :disabled="lignes.length <= 1" @click="retirer(index)">Retirer</button>
      </div>
      <div class="ligne-grille">
        <div>
          <label :for="`${prefixe}-role-${ligne.cle}`">Rôle <span class="requis">*</span></label>
          <select :id="`${prefixe}-role-${ligne.cle}`" v-model="ligne.id_role" @change="changerRole(ligne, $event.target.value)">
            <option value="">Choisir…</option>
            <option v-for="r in roles" :key="r.id_role" :value="r.id_role">{{ r.libelle }}</option>
          </select>
        </div>
        <div>
          <span class="etiquette">Ayant droit <span class="requis">*</span></span>
          <PersonnePicker
            v-model="ligne.personne"
            :type-requis="estEditeur(ligne.id_role) ? 'MORALE' : null"
            :id-prefixe="`${prefixe}-p-${ligne.cle}`"
          />
        </div>
        <div>
          <label :for="`${prefixe}-part-${ligne.cle}`">Part (%) <span class="requis">*</span></label>
          <input
            :id="`${prefixe}-part-${ligne.cle}`"
            v-model="ligne.part"
            type="number"
            min="0"
            max="100"
            step="0.01"
            inputmode="decimal"
            placeholder="0"
          />
        </div>
      </div>
    </div>

    <div class="actions-ligne">
      <button type="button" class="btn" :disabled="lignes.length >= 20" @click="ajouter">+ Ajouter un ayant droit</button>
      <button type="button" class="btn" @click="repartir">Répartir équitablement</button>
    </div>

    <ShareGauge :total="total" />
  </div>
</template>
