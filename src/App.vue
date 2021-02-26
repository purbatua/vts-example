<template>
  <div id="app">
    <TransitionPage>
      <component :is="layout">
        <TransitionPage>
          <router-view />
        </TransitionPage>
      </component>
    </TransitionPage>
  </div>
</template>

<script>
import TransitionPage from '@/components/shared/TransitionPage.vue'
import stringMixin from '@/mixins/string'

export default {
  name: 'App',
  mixins: [stringMixin],
  components: {
    TransitionPage
  },
  computed: {
    layout() {
      const lyt = this.slug2pascal(this.$route.meta.layout || 'default')
      return () => import(`@/layouts/${lyt}`)
    }
  }
}
</script>
