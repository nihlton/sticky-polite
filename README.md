# sticky-polite

A robust, zero-dependency utility for "Polite" sticky positioning.

It strikes a balance between keeping important page elements highly available, and keeping the screen clear of distractions.

Scrolling down allows your header to gracefully scroll off screen, returning valuable screen real estate, while scrolling up immediately recalls your header.

**Key Features:**

- **Axis and Direction agnostic:** Elements can stick to the top, bottom, left or right.
- **SPA Ready:** Built-in `MutationObserver` with "Zombie" protection (auto-cleanup of detached subtrees) handles React/Vue/Svelte lifecycles automatically.
- **Supports nested scrolling containers:** Elements within a scroll container will respect the boundaries of its parent.

## Installation

```bash
npm install sticky-polite

```

## Usage

Just import the package. It automatically initializes a global observer that watches for the `.sticky-polite` class.

```javascript
// main.js or index.js
import "sticky-polite";
```

Then, add the class and and edge offset to any element in your HTML:

```html
<header class="sticky-polite" style="top: 1rem">My Header</header>

<footer class="sticky-polite" style="bottom: 20px">My Footer</footer>
```

**Important Notes:**

- **defined edge**: sticky-polite elements must have one edge offset defined. Elements with more or less than one edge will be ignored.
- **nested containers**: elements with an edge offset greater than zero, which are nested within a scrolling container may never be able to return to their static/natural position. This reflects the browser's native `'position: sticky'` behavior, but is something to be aware of. You may find it useful to set the edge to '0px' and apply a padding value to the parent instead.

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
