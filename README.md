# sticky-polite

A robust, zero-dependency utility for "Polite" sticky positioning. Imagine if `position: sticky` could understand when your user wants it out of the way and politely excuses itself from the viewport.

It strikes a balance between keeping important page elements highly available, and keeping the screen clear of distractions.

As an example - Scrolling down allows your header to gracefully scroll off screen, returning valuable screen real estate. Scrolling up later immediately recalls your header.

[Code Sandbox](https://codesandbox.io/p/sandbox/h6z4jh)

[Live Preview](https://h6z4jh.csb.app/)

**Key Features:**

- **Nearly-Zero setup:** Apply the class name `sticky-polite` to an element, and you are done.
- **Axis and Direction agnostic:** Elements can stick to the top, bottom, left or right.
- **SPA Ready:** Performance-optimized observers catch `sticky-polite` elements as they're created and destroyed to handle React/Vue/Svelte lifecycles automatically.
- **Supports nested scrolling containers:** Elements within a scroll container will respect the boundaries of its parent.
- **No animations/transitions:** Interactions feel buttery and smooth, like native browser behavior - because most of it is!

## Installation

```bash
npm install sticky-polite

```

## Usage

Import the package.

```html
<script src="https://unpkg.com/sticky-polite/dist/index.cjs"></script>
```

```javascript
// main.js or index.js
import "sticky-polite";
```

Add the class and an edge offset to an element:

```html
<header class="sticky-polite" style="top: 1rem">My Header</header>
```

or

```
<style>
  footer.sticky-polite { bottom: 20px }
</style>

...

<footer class="sticky-polite">My Footer</footer>
```

**Important Notes:**

- **defined edge**: sticky-polite elements must have one edge offset defined. Elements with more than one, or less than one edge will be ignored.
- **nested containers**: elements with an edge offset greater than zero, which are nested within a scrolling container may never be able to return to their static/natural position. This reflects the browser's native `'position: sticky'` behavior, but is something to be aware of. You may find it useful to set the edge to '0px' and apply a padding value to the parent instead.

## Advanced Usage

You can optionally style the element based on the state it's in.

- `static` - The default state, where the element is resting in it's natural position
- `intersect` - The element was off-screen, and you have begun scrolling towards it. It enters this state as it begins to reveal itself
- `sticky` - The element is stuck to the view port edge (e.g. The element is fully revealed, and you are scrolling toward its natural position)

```css
.sticky-polite[data-polite-state="static"] {
  box-shadow: none;
}

.sticky-polite[data-polite-state="intersect"] {
  box-shadow: 0 0 0 3px orange;
}

.sticky-polite[data-polite-state="sticky"] {
  box-shadow: 0 1em 2em rgba(0, 0, 0, 0.2);
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
