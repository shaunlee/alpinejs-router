# alpinejs-router

![NPM](https://img.shields.io/npm/l/@shaun/alpinejs-router)
![GitHub package.json version](https://img.shields.io/github/package-json/v/shaunlee/alpinejs-router)

Easy to use and flexible router for Alpine.js

## Installation

### npm

```bash
npm install @shaun/alpinejs-router
```

### yarn

```bash
yarn add @shaun/alpinejs-router
```

### cdn

```html
<script src="https://unpkg.com/@shaun/alpinejs-router@1.x.x/dist/cdn.min.js" defer></script>
```

## Getting Started

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
<div>User ID: {$router.params.id}</div>
```

You can have multiple params in the same route, and they will map to corresponding fields on `$router.params`. Examples:

| pattern | matched path | $router.params |
| --- | --- | --- |
| /users/:username | /users/eduardo | `{ username: 'eduardo' }` |
| /users/:username/posts/:postId | /users/eduardo/posts/123 | `{ username: 'eduardo', postId: '123' }` |

In addition to `$router.params`, the `$router` magic also exposes other useful information such as `$route.query` (if there is a query in the URL), `$router.path`, etc.

## Routes' Matching Syntax

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

Now, going to `/25` will match `/:orderId` while going to anything else will match `/:productName`. The order of the `routes` array doesn't even matter!

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

When using `'web'`, the URL will look "normal," e.g. `https://example.com/user/id`. Beautiful!

Here comes a problem, though: Since our app is a single page client side app, without a proper server configuration,
the users will get a 404 error if they access `https://example.com/user/id` directly in their browser. Now that's ugly.

Not to worry: To fix the issue, all you need to do is add a simple catch-all fallback route to your server.
If the URL doesn't match any static assets, it should serve the same `index.html` page that your app lives in. Beautiful, again!

## Route directive

Declare routes by creating a template tag with `x-route` attribute.

```html
<template x-route="/path/to/route">
  <div x-data>
    ...
  </div>
</template>

<template x-route="/path/to/route" template="/path/to/template.html"></template>

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

<!-- Activate the `active` and `exact-active` classes to router links -->
<a x-link.activity">...</a>
<!-- Custom active class and exact active class can be added by setting `active` and `exactActive` props to the `x-link.activity` directive -->
<a x-link.activity="{ active: 'text-blue-500', exactActive: 'text-green-500' }">...</a>
```

## Magic $router

### Properties

```html
<!-- String $route.path -->
<span x-text="$router.path"></span>

<!-- Object $route.query -->
<span x-text="$router.query.page"></span>

<!-- Object $route.params -->
<span x-text="$router.params.userId"></span>

<!-- Boolean $route.loading -->
<span x-show="$router.loading">Separate template file is loading</span>
```

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
<body x-data x-init="$router.config({ base: '/prefix/' })">...</body>
<!-- Mode 'web' with prefix -->
<body x-data x-init="$router.config({ mode: 'web', base: '/prefix/' })">...</body>
<!-- Mode 'hash' with no prefix -->
<body x-data x-init="$router.config({ mode: 'hash' })">...</body>
<!-- Mode 'hash' with prefix -->
<body x-data x-init="$router.config({ mode: 'hash', base: '/prefix/' })">...</body>
<!-- Do nothing by default to mode 'web' with no prefix -->
<body x-data>...</body>
```

## License

Licensed under [MIT](https://github.com/shaunlee/alpinejs-router/blob/master/LICENSE)
