# alpinejs-router

![NPM](https://img.shields.io/npm/l/@shaun/alpinejs-router)
![GitHub package.json version](https://img.shields.io/github/package-json/v/shaunlee/alpinejs-router)

A lightweight client-side router for Alpine.js that adds declarative routes, link navigation, dynamic params, external templates, and hash or HTML5 history modes without turning your app into a larger framework.

## Router benchmark

Example result from `npm run bench:router` on Node.js v26.2.0:

| Routes per type | Total routes | Case | ops/sec | us/op |
| --- | ---: | --- | ---: | ---: |
| 1000 | 4000 | match static | 6,253,583 | 0.160 |
| 1000 | 4000 | match dynamic first | 1,271,974 | 0.786 |
| 1000 | 4000 | match dynamic last | 1,287,858 | 0.776 |
| 1000 | 4000 | match miss | 4,129,862 | 0.242 |
| 1000 | 4000 | is cached dynamic | 3,610,343 | 0.277 |
| 1000 | 4000 | notfound miss | 4,148,457 | 0.241 |
| 1000 | 4000 | build routes | 69 | 14,416.050 |

Static route matching and cached `is()` checks stay effectively constant-time. Dynamic `match()` and `notfound()` are indexed by first path segment, with wildcard-first dynamic routes used as a fallback.

## Installation

### npm

```bash
npm install @shaun/alpinejs-router
```

```js
import Alpine from 'alpinejs'
import router from '@shaun/alpinejs-router'

Alpine.plugin(router)
Alpine.start()
```

### yarn

```bash
yarn add @shaun/alpinejs-router
```

### bun

```bash
bun add @shaun/alpinejs-router
```

### CDN

```html
<script src="https://unpkg.com/@shaun/alpinejs-router@1.x.x/dist/cdn.min.js" defer></script>
<script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
```

```html
<!-- older browsers -->
<script src="https://unpkg.com/@shaun/alpinejs-router@1.x.x/dist/es6.min.js" defer></script>
<script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
```

## Development

```bash
bun install
```

```bash
bun run test --runInBand
```

```bash
bun run bench:router
```

```bash
bun run build
```

Build artifacts are written to `dist/`:

- `dist/module.esm.js`
- `dist/module.cjs.js`
- `dist/cdn.min.js`
- `dist/es6.min.js`

The build uses Vite library mode and keeps the published filenames stable.

## Getting Started

Here is a complete CDN example:

```html
<!doctype html>
<html>
  <head>
    <script src="https://unpkg.com/@shaun/alpinejs-router@1.x.x/dist/cdn.min.js" defer></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
  </head>
  <body x-data>
    <nav>
      <a x-link href="/">Home</a>
      <a x-link href="/hello/alpine">Hello</a>
    </nav>

    <template x-route="/">
      <main>Home</main>
    </template>

    <template x-route="/hello/:name">
      <main>Hello <span x-text="$router.params.name"></span></main>
    </template>

    <template x-route.notfound>
      <main>Not found</main>
    </template>
  </body>
</html>
```

Routes can also load inline or external templates:

```html
<a x-link href="/hello/world">Hello World</a>

<a x-link href="/somewhere">Load template</a>

<template x-route="/hello/:name">
  <!-- Inner template -->
  <div>Say hello to <span x-text="$router.params.name"></span></div>
</template>

<!-- Separate template file -->
<template x-route="/somewhere" template="/somewhere.html"></template>
```

somewhere.html

```html
<div x-data="{ open: false }">
  <button @click="open = ! open">Toggle Content</button>

  <div x-show="open">Content...</div>
</div>
```

## Dynamic Route Matching with Params

Very often we will need to map routes with the given pattern to the same template.
For example we may have a `user` template which should be rendered for all users but with different user IDs.
In `@shaun/alpinejs-router` we can use a dynamic segment in the path to achieve that, we call that a param:

```html
<!-- dynamic segments start with a colon -->
<template x-route="/users/:id" template="/user.html"></template>
```

Now URLs like `/users/johnny` and `/users/jolyne` will both map to the same route.

A param is denoted by a colon `:`. When a route is matched, the value of its params will be exposed as `$router.params`.
Therefore, we can render the current user ID by updating user's template to this:

```html
<div>User ID: <span x-text="$router.params.id"></span></div>
```

You can have multiple params in the same route, and they will map to corresponding fields on `$router.params`. Examples:

| pattern | matched path | $router.params |
| --- | --- | --- |
| /users/:username | /users/eduardo | `{ username: 'eduardo' }` |
| /users/:username/posts/:postId | /users/eduardo/posts/123 | `{ username: 'eduardo', postId: '123' }` |

In addition to `$router.params`, the `$router` magic also exposes other useful information such as `$router.query` (if there is a query in the URL), `$router.path`, etc.

## Route Matching Syntax

Most applications will use static routes like `/about` and dynamic routes like `/users/:userId` like we just saw in Dynamic Route Matching, but `@shaun/alpinejs-router` has much more to offer!

### Custom regex in params

When defining a param like `:userId`, we internally use the following regex `([^/]+)` (at least one character that isn't a slash `/`) to extract params from URLs.
This works well unless you need to differentiate two routes based on the param content. Imagine two routes `/:orderId` and `/:productName`, both would match the exact same URLs, so we need a way to differentiate them.
The easiest way would be to add a static section to the path that differentiates them:

```html
<!-- matches /o/3549 -->
<template x-route="/o/:orderId"></template>
<!-- matches /p/books -->
<template x-route="/p/:productName"></template>
```

But in some scenarios we don't want to add that static section `/o/p`. However, `orderId` is always a number while `productName` can be anything, so we can specify a custom regex for a param in parentheses:

```html
<!-- /:orderId -> matches only numbers -->
<template x-route="/:orderId(\d+)"></template>
<!-- /:productName -> matches anything else -->
<template x-route="/:productName"></template>
```

Now, going to `/25` will match `/:orderId` while going to anything else will match `/:productName`.

## Programmatic Navigation

Aside from using `<a x-link href="...">` to create anchor tags for declarative navigation, we can do this programmatically using the router's instance methods.

### Navigate to a different location

To navigate to a different URL, use `$router.push`. This method pushes a new entry into the history stack, so when the user clicks the browser back button they will be taken to the previous URL.

This is the method called internally when you click a `x-link`, so clicking `<a x-link href="...">` is the equivalent of calling `$router.push(...)`.

| Declarative | Programmatic |
| --- | --- |
| `<a x-link href="...">` | `$router.push(...)` |

### Replace current location

It acts like `$router.push`, the only difference is that it navigates without pushing a new history entry, as its name suggests - it replaces the current entry.

| Declarative | Programmatic |
| --- | --- |
| `<a x-link.replace href="...">` | `$router.replace('...')` |

### History Manipulation

You may have noticed that `$router.push` and `$router.replace` are counterparts of `window.history.pushState` and `window.history.replaceState`, and they do imitate the `window.history` APIs.

Therefore, if you are already familiar with [Browser History APIs](https://developer.mozilla.org/en-US/docs/Web/API/History_API), manipulating history will feel familiar when using `@shaun/alpinejs-router`.

It is worth mentioning that `@shaun/alpinejs-router` navigation methods (push, replace) work consistently no matter the kind of `mode` option is passed when configuring the router instance.

## Different History modes

The `mode` option when configuring the router instance allows us to choose among different history modes.

### Hash Mode

The hash history mode is configured with `'hash'`:

```html
<body x-data x-init="$router.config({ mode: 'hash' })"></body>
```

If you use a `base`, prefer a value without a trailing slash, e.g. `/prefix`.

It uses a hash character (`#`) before the actual URL that is internally passed.
Because this section of the URL is never sent to the server, it doesn't require any special treatment on the server level.
It does however have a bad impact in SEO. If that's a concern for you, use the HTML5 history mode.

### HTML5 Mode

The HTML5 mode is configured with `'web'` and is the recommended mode:

```html
<body x-data x-init="$router.config({ mode: 'web' })"></body>
<!-- Or do nothing by default -->
<body x-data></body>
```

If you use a `base`, prefer a value without a trailing slash, e.g. `/prefix`.

When using `'web'`, the URL is a normal path, e.g. `https://example.com/user/id`.

Since this is a client-side router, direct browser requests to nested paths need server support.
Without a fallback route, users will get a 404 error if they access `https://example.com/user/id` directly in their browser.

To fix the issue, add a catch-all fallback route to your server.
If the URL doesn't match any static assets, serve the same `index.html` page that your app lives in.

## Route directive

Declare routes by creating a template tag with `x-route` attribute.
Each route template should render exactly one root element.

```html
<template x-route="/path/to/route">
  <div x-data>
    ...
  </div>
</template>

<template x-route="/path/to/route" template="/path/to/template.html"></template>
<!-- Preload the separate template file -->
<template x-route="/path/to/route" template.preload="/path/to/template.html"></template>
<!-- Use inline content as a fallback when the external template cannot be loaded -->
<template x-route="/path/to/route" template="/path/to/template.html">
  <div>Fallback template</div>
</template>
<!-- Relative paths -->
<template x-route="/path/to/route" template="template.html"></template>
<template x-route="/path/to/route" template="./template.html"></template>
<template x-route="/path/to/route" template="../template.html"></template>
<template x-route="/path/to/route" template="../../template.html"></template>

<!-- When declaring a template that is not found, the path parameter does not need to be specified -->
<template x-route.notfound>
  <div>
    Error 404 not found
  </div>
</template>
```

## Link directive

```html
<!-- The same as $router.push -->
<a x-link href="/path/to/route">...</a>

<!-- The same as $router.replace -->
<a x-link.replace href="/path/to/route">...</a>

<!-- Activate the `active` and `exact-active` classes on router links -->
<a x-link.activity href="/path/to/route">...</a>
<!-- Custom active class and exact active class can be added by setting `active` and `exactActive` props to the `x-link.activity` directive -->
<a x-link.activity="{ active: 'text-blue-500', exactActive: 'text-green-500' }">...</a>
```

`x-link.activity` marks a link as active when the current path is exactly the same as the link path, or is a nested child route such as `/users/1` for `/users`.
It does not treat `/users2` as active for `/users`.
Modified clicks such as Ctrl/Cmd-click, middle click, `target="_blank"`, `download`, and external links keep the browser's native behavior.

## Magic $router

### Properties

```html
<!-- String $router.path -->
<span x-text="$router.path"></span>

<!-- Object $router.query -->
<span x-text="$router.query.page"></span>

<!-- Object $router.params -->
<span x-text="$router.params.userId"></span>

<!-- Boolean $router.loading -->
<span x-show="$router.loading">Separate template file is loading</span>
```

`$router.loading` is useful when routes load external templates with `template` or `template.preload`.

### Methods

```html
<!-- Navigate to -->
<button @click="$router.push('/path/to/route')">...</button>
<!-- Replace to -->
<button @click="$router.push('/path/to/route', { replace: true })">...</button>

<!-- Replace to -->
<button @click="$router.replace('/path/to/route')">...</button>

<!-- Add queries to the current URL -->
<a x-link x-bind:href="$router.resolve({ page: 2 })">Page 2/10</a>

<!-- Mode 'web' with prefix -->
<body x-data x-init="$router.config({ base: '/prefix' })">...</body>
<!-- Mode 'web' with prefix -->
<body x-data x-init="$router.config({ mode: 'web', base: '/prefix' })">...</body>
<!-- Mode 'hash' with no prefix -->
<body x-data x-init="$router.config({ mode: 'hash' })">...</body>
<!-- Mode 'hash' with prefix -->
<body x-data x-init="$router.config({ mode: 'hash', base: '/prefix' })">...</body>
<!-- Do nothing by default to mode 'web' with no prefix -->
<body x-data>...</body>

<!-- Check if the route matches the current location -->
<div x-show="$router.is('/path/to/route')">You can see me</div>
<template x-if="$router.is('/path/to/route1', '/path/to/route2', ...)">You can see me also</template>
<div x-show="$router.not('/path/to/route')">...</div>
```

## License

Licensed under [MIT](https://github.com/shaunlee/alpinejs-router/blob/master/LICENSE)
