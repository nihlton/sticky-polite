# sticky-polite

![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/sticky-polite)
![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)
![Static Badge](https://img.shields.io/badge/react-compatible-blue?logo=react&logoColor=white)
![Static Badge](https://img.shields.io/badge/vue-compatible-blue?logo=vue.js&logoColor=white)
![Static Badge](https://img.shields.io/badge/svelte-compatible-blue?logo=svelte&logoColor=white)

![stick-polite-animation](https://github.com/user-attachments/assets/be262276-443d-4362-b24f-1dd4f84dcd20)

A robust, zero-dependency headless utility for 'polite' sticky positioning. Imagine if `position: sticky` could understand when your user wants it out of the way and politely excuses itself from the viewport.

Keep important page elements highly available, while keeping the screen clear of distractions.

[Code Sandbox](https://codesandbox.io/p/sandbox/h6z4jh)

[Live Preview](https://h6z4jh.csb.app/)

**Key Features:**

- **nearly-zero setup:** Apply the class name `sticky-polite` and an edge offset to an element, and you are done.
- **Compatible with React/Vue/Svelte:** Performance-optimized observers manage `sticky-polite` element lifecycles.
- **axis and direction agnostic:** Elements can stick to the top, bottom, left or right.
- **Supports nested scrolling containers:** Elements within a scroll container will respect the boundaries of its parent.
- **No animations/transitions:** Interactions feel buttery and smooth, like native browser behavior - because most of it is!

**Limitations:**

- **Mobile footer:** Mobile browsers manipulate the viewport size when scrolling in a ways that are difficult to predict/adapt to. Footers whose scrolling-parent are the body/document cannot always transition smoothly between 'hidden' and 'visible'. So it goes.
- **single edge:** While `position: sticky` supports all four edges simultaneously, `sticky-polite` supports one. This feels like the appropriate balance between package size/complexity and core-use coverage.
  
## Installation

```bash
npm install sticky-polite

```

## Usage

Import the package.

```javascript
// main.js or index.js
import "sticky-polite";
```
or
```html
<script src="https://unpkg.com/sticky-polite/dist/index.cjs"></script>
```

Add the class and an edge offset to an element:

```html
// inline edge offset
<header class="sticky-polite" style="top: 1rem">Header</header>

- or -

// via stylesheet
<style>
  header.sticky-polite { top: 20px }
</style>
```

**Important Notes:**

- **defined edge**: `sticky-polite` elements must have one edge offset defined. Elements with more than one, or less than one edge will be ignored.
- **nested containers**: elements with an edge offset greater than zero, which are nested within a scrolling container may never be able to return to their static/natural position. This reflects the browser's native `'position: sticky'` behavior, but is something to be aware of. You may find it useful to set the edge to '0px' and apply a padding value to the parent instead.

## Advanced Usage

You can optionally style the element based on the state it's in.

- `static` - The default state, where the element is resting in it's natural position
- `intersect` - The element was off-screen, and you have begun scrolling towards it. It enters this state as it begins to reveal itself
- `sticky` - The element is stuck to the view port edge (e.g. The element is fully revealed, and you are scrolling toward its natural position)

```css
.sticky-polite[data-polite-state="static"] {
  outline: none;
}

.sticky-polite[data-polite-state="intersect"] {
  outline: 3px solid green;
}

.sticky-polite[data-polite-state="sticky"] {
  outline: 3px solid blue;
}
```

**Important Notes:**

- **foot guns**: you can pretty easily shoot yourself in the foot by applying CSS which changes the element's dimensions or position. The utility will do what it can to adapt, but apply these state styles with caution, and test extensively.

## Development

This repo uses `tsup` for bundling and `live-server` for a parallel-watch playground.

```bash
# Run the test harness (Builds source + Serves /playground)
npm run dev

# Build for production (Generates ESM, CJS, and Types)
npm run build

```

## License

MIT
