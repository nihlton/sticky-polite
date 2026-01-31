import { CONFIG } from "./constants";
import {
  applyStatic,
  applySticky,
  defaultPaddingConfig,
  getContainerPadding,
  getScrollParent,
  injectAnimationBeacon,
  measureNaturalRect,
  measureViewportSize,
  readConfigFromDOM,
} from "./dom";
import { updateElementState } from "./state";
import { ElementState } from "./types";

const stateRegistry = new WeakMap<HTMLElement, ElementState>();
const cleanupRegistry = new Map<HTMLElement, () => void>();

export const mountElement = (element: HTMLElement) => {
  if (stateRegistry.has(element)) return;

  const parent = getScrollParent(element);

  const attributeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName === "class") {
        if (!element.classList.contains(CONFIG.className)) {
          cleanupRegistry.get(element)?.();
        }
      }
    }
  });

  attributeObserver.observe(element, {
    attributes: true,
    attributeFilter: ["class"], // Only watch class changes
  });

  const state: ElementState = {
    element,
    parent,
    naturalRect: { top: 0, left: 0, height: 0, width: 0 } as DOMRect,
    lastScrollPos: 0,
    isSticky: false,
    isTransforming: false,
    currentTranslation: 0,
    cachedConfig: { valid: false, edge: "top", offset: 0 },
    cachedViewportSize: 0,
    cachedViewportPadding: defaultPaddingConfig,
    attributeObserver,
    resizeObserver: new ResizeObserver(() => {
      // 1. Refresh Config
      state.cachedConfig = readConfigFromDOM(element);
      // 2. Refresh Measures
      state.naturalRect = measureNaturalRect(element, parent);
      // 3. Refresh Viewport Size (Crucial for Bottom/Right)
      state.cachedViewportSize = measureViewportSize(parent, state.cachedConfig.edge);
      state.cachedViewportPadding = getContainerPadding(parent);

      // Safe Reset on Resize
      if (state.isSticky) applySticky(element);
      else {
        applyStatic(state);
        state.isTransforming = false;
      }

      // Trigger update
      updateElementState(state);
    }),
  };

  element.setAttribute(CONFIG.attrName, "static");
  state.resizeObserver.observe(element);

  // Note: ResizeObserver on element doesn't always catch parent resize.
  // ideally we observe parent too, but for simplicity we rely on scroll/resize events
  // or the fact that parent resize usually triggers element layout shift.

  stateRegistry.set(element, state);

  let scrollTick = false;
  const onScroll = () => {
    if (scrollTick) return;
    window.requestAnimationFrame(() => {
      updateElementState(state);
      scrollTick = false;
    });
    scrollTick = true;
  };

  const scrollTarget = parent === document.documentElement ? window : parent;
  scrollTarget.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true }); // Fallback for viewport changes

  cleanupRegistry.set(element, () => {
    scrollTarget.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    state.resizeObserver.disconnect();
    attributeObserver.disconnect();
    stateRegistry.delete(element);
    cleanupRegistry.delete(element);
  });
};

export const handleMutations = (mutations: MutationRecord[]) => {
  let checkRemovals = false;

  for (const { type, addedNodes, removedNodes } of mutations) {
    if (type === "childList") {
      addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.classList.contains(CONFIG.className)) mountElement(node);
          node.querySelectorAll(`.${CONFIG.className}`).forEach((el) => mountElement(el as HTMLElement));
        }
      });
      checkRemovals = checkRemovals || Boolean(removedNodes.length);
    }
  }

  // check for removals
  if (checkRemovals) {
    Array.from(cleanupRegistry.keys()).forEach((node) => {
      if (!document.contains(node)) cleanupRegistry.get(node)?.();
    });
  }
};

const handleAnimationStart = (event: AnimationEvent) => {
  if (event.animationName === "sticky-polite-announce") {
    const node = event.target as HTMLElement;
    // Safety check: ensure it's not already tracked
    if (!cleanupRegistry.has(node)) {
      mountElement(node);
    }
  }
};

export const initPoliteSticky = () => {
  injectAnimationBeacon();
  document.addEventListener("animationstart", handleAnimationStart);
  document.querySelectorAll(`.${CONFIG.className}`).forEach((el) => mountElement(el as HTMLElement));
  new MutationObserver(handleMutations).observe(document.body, {
    childList: true,
    subtree: true,
  });
};
