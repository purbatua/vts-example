import Vue from 'vue'
import Router from 'vue-router'
import Home from '@/pages/Home.vue'
import scrollBehavior from '@/utils/scrollBehavior'

Vue.use(Router)

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  scrollBehavior,
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home,
      meta: { scrollToTop: true, transitionName: 'fade' }
    },
  ]
})
