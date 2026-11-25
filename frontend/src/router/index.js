import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ---------- Pages publiques ----------
    { path: '/', name: 'accueil', component: () => import('../views/HomeView.vue') },
    { path: '/oeuvres/:id', name: 'oeuvre', component: () => import('../views/OeuvreView.vue'), props: true },
    { path: '/soumettre', name: 'soumettre', component: () => import('../views/SoumettreView.vue') },
    { path: '/connexion', name: 'connexion', component: () => import('../views/LoginView.vue') },

    // ---------- Espace de gestion (modérateurs et administrateurs) ----------
    {
      path: '/gestion',
      component: () => import('../layouts/GestionLayout.vue'),
      meta: { staff: true, gestion: true },
      children: [
        {
          path: '',
          name: 'gestion',
          component: () => import('../views/gestion/DashboardView.vue'),
          meta: { titre: 'Tableau de bord' },
        },
        {
          path: 'oeuvres',
          name: 'gestion-oeuvres',
          component: () => import('../views/gestion/OeuvresGestionView.vue'),
          meta: { titre: 'Œuvres' },
        },
        {
          path: 'oeuvres/:id',
          name: 'gestion-oeuvre',
          component: () => import('../views/gestion/OeuvreGestionDetailView.vue'),
          props: true,
          meta: { titre: 'Détail de l’œuvre' },
        },
        {
          path: 'oeuvres/:id/modifier',
          name: 'gestion-oeuvre-edition',
          component: () => import('../views/gestion/OeuvreEditView.vue'),
          props: true,
          meta: { titre: 'Modifier l’œuvre' },
        },
        {
          path: 'personnes',
          name: 'gestion-personnes',
          component: () => import('../views/gestion/PersonnesGestionView.vue'),
          meta: { titre: 'Ayants droit' },
        },
        {
          path: 'personnes/:id',
          name: 'gestion-personne',
          component: () => import('../views/gestion/PersonneGestionDetailView.vue'),
          props: true,
          meta: { titre: 'Détail de l’ayant droit' },
        },
        {
          path: 'personnes/:id/modifier',
          name: 'gestion-personne-edition',
          component: () => import('../views/gestion/PersonneEditView.vue'),
          props: true,
          meta: { titre: 'Modifier l’ayant droit' },
        },

        // ----- Administration (administrateurs uniquement) -----
        {
          path: 'diffuseurs',
          name: 'gestion-diffuseurs',
          component: () => import('../views/gestion/DiffuseursView.vue'),
          meta: { admin: true, titre: 'Diffuseurs' },
        },
        {
          path: 'diffusions',
          name: 'gestion-diffusions',
          component: () => import('../views/gestion/DiffusionsView.vue'),
          meta: { admin: true, titre: 'Diffusions' },
        },
        {
          path: 'diffusions/nouvelle',
          name: 'gestion-diffusion-nouvelle',
          component: () => import('../views/gestion/NouvelleDiffusionView.vue'),
          meta: { admin: true, titre: 'Nouvelle diffusion' },
        },
        {
          path: 'diffusions/:id',
          name: 'gestion-diffusion',
          component: () => import('../views/gestion/DiffusionDetailView.vue'),
          props: true,
          meta: { admin: true, titre: 'Détail de la diffusion' },
        },
        {
          path: 'droits',
          name: 'gestion-droits',
          component: () => import('../views/gestion/DroitsView.vue'),
          meta: { admin: true, titre: 'Droits perçus' },
        },
        {
          path: 'droits/:id',
          name: 'gestion-droit',
          component: () => import('../views/gestion/DroitsDetailView.vue'),
          props: true,
          meta: { admin: true, titre: 'Droits d’un ayant droit' },
        },
      ],
    },

    { path: '/:pathMatch(.*)*', name: 'introuvable', component: () => import('../views/NotFoundView.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

// Pages réservées : meta.staff (modérateurs et admins) ou meta.admin (admins seulement).
// La navigation vers un enfant hérite des meta de son parent.
router.beforeEach((to) => {
  const { estConnecte, estAdmin } = useAuth();
  if ((to.meta.staff || to.meta.admin) && !estConnecte.value) {
    return { name: 'connexion', query: { redirect: to.fullPath } };
  }
  if (to.meta.admin && !estAdmin.value) {
    return { name: 'gestion' };
  }
  return true;
});

export default router;
