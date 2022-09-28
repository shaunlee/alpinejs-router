# alpinejs-router

Easy to use and flexible router for Alpine.js

## Getting Started

```html
<a x-link href="/hello/world">Hello World</a>

<a x-link href="/somewhere">Load template</a>

<template x-route="/hello/:name">
  <div>Say hello to <span x-text="$store.router.params.name"></span></div>
</template>

<template x-route="/somewhere" template="/somewhere.html"></template>
```

somewhere.html

```html
<div x-data="{ open: false }">
  <button @click="open = ! open">Toggle Content</button>

  <div x-show="open">Content...</div>
</div>
```
