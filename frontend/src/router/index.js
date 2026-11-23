import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'accueil', component: () => import('../views/HomeView.vue') },
    { path: '/oeuvres/:id', name: 'oeuvre', component: () => import('../views/OeuvreView.vue'), props: true },
    { path: '/connexion', name: 'connexion', component: () => import('../views/LoginView.vue') },
    // Les pages réservées utiliseront meta: { staff: true } (modérateurs et admins) ou { admin: true }
    { path: '/:pathMatch(.*)*', name: 'introuvable', component: () => import('../views/NotFoundView.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const { estConnecte, estAdmin } = useAuth();
  if ((to.meta.staff || to.meta.admin) && !estConnecte.value) {
    return { name: 'connexion', query: { redirect: to.fullPath } };
  }
  if (to.meta.admin && !estAdmin.value) {
    return { name: 'accueil' };
  }
  return true;
});

export default router;
