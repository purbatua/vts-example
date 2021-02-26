import Vue from 'vue'
import App from './App.vue'
import router from "./router"
import './assets/css/main.css';

import * as VueGoogleMaps from 'gmap-vue'


Vue.config.productionTip = false

Vue.use(VueGoogleMaps, {
  load: {
    key: process.env.VUE_APP_GMAP_API_KEY,
    libraries: 'places,geometry',
  },
  installComponents: true
})

new Vue({
  router,
  render: h => h(App),
}).$mount('#app')
