document.addEventListener('alpine:init', () => {

  Alpine.data('demo', () => ({
    goto (path) {
      this.$router.push(path)
    },

    replaceTo (path) {
      this.$router.replace(path)
    }
  }))

  Alpine.directive('hello', (el, { expression }, { evaluate, cleanup }) => {
    const $router = evaluate(expression)

    const onclick = () => {
      $router.push('/')
    }

    window.addEventListener('click', onclick, true)
    cleanup(() => {
      window.removeEventListener('click', onclick)
    })
  })
})
