// src/observer.ts

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

// Registry is now a standard Map to allow iteration
const stateRegistry = new Map<HTMLElement, ElementState>();
const cleanupRegistry = new Map<HTMLElement, () => void>();

// Throttling map for requestAnimationFrame
const resizeTickMap = new WeakMap<ElementState, boolean>();

// --- Shared Logic ---

const refreshState = (state: ElementState) => {
  const { element, parent } = state;

  // 1. Refresh Config
  state.cachedConfig = readConfigFromDOM(element);

  // 2. Refresh Measures
  state.naturalRect = measureNaturalRect(element, parent);

  // 3. Refresh Viewport Size
  // This will now pick up the updated window.innerHeight when called via visualViewport event
  state.cachedViewportSize = measureViewportSize(parent, state.cachedConfig.edge);
  state.cachedViewportPadding = getContainerPadding(parent);

  // Safe Reset
  if (state.isSticky) {
    applySticky(element);
  } else {
    applyStatic(state);
    state.isTransforming = false;
  }

  updateElementState(state);
};

/**
 * Triggers a throttled refresh for a specific state.
 */
const scheduleRefresh = (state: ElementState) => {
  if (resizeTickMap.get(state)) return;

  window.requestAnimationFrame(() => {
    refreshState(state);
    resizeTickMap.set(state, false);
  });
  resizeTickMap.set(state, true);
};

// --- Observers & Listeners ---

const handleResizeObserver = (entries: ResizeObserverEntry[]) => {
  const changedNodes = new Set(entries.map((e) => e.target));

  for (const state of stateRegistry.values()) {
    if (changedNodes.has(state.element) || changedNodes.has(state.parent)) {
      scheduleRefresh(state);
    }
  }
};

const handleVisualViewport = () => {
  // When the visual viewport resizes (URL bar moves),
  // we effectively need to refresh anything attached to the global window.
  // Since we don't have a "target" like ResizeObserver, we check the parent type.

  for (const state of stateRegistry.values()) {
    // Check if the parent is the <html> or <body> tag (Window-level scrolling)
    if (state.parent === document.documentElement || state.parent === document.body) {
      scheduleRefresh(state);
    }
  }
};

const resizeObserver = new ResizeObserver(handleResizeObserver);

// --- Lifecycle ---

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
    attributeFilter: ["class"],
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
  };

  element.setAttribute(CONFIG.attrName, "static");
  stateRegistry.set(element, state);

  refreshState(state);

  // Bind Observer
  resizeObserver.observe(element);
  resizeObserver.observe(parent);

  // Bind Scroll Listener
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

  cleanupRegistry.set(element, () => {
    scrollTarget.removeEventListener("scroll", onScroll);
    attributeObserver.disconnect();

    resizeObserver.unobserve(element);

    let parentInUse = false;
    for (const [el, s] of stateRegistry.entries()) {
      if (el !== element && s.parent === parent) {
        parentInUse = true;
        break;
      }
    }

    if (!parentInUse) {
      resizeObserver.unobserve(parent);
    }

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

  if (checkRemovals) {
    Array.from(cleanupRegistry.keys()).forEach((node) => {
      if (!document.contains(node)) cleanupRegistry.get(node)?.();
    });
  }
};

const handleAnimationStart = (event: AnimationEvent) => {
  if (event.animationName === "sticky-polite-announce") {
    const node = event.target as HTMLElement;
    if (!cleanupRegistry.has(node)) {
      mountElement(node);
    }
  }
};

export const initPoliteSticky = () => {
  injectAnimationBeacon();
  document.addEventListener("animationstart", handleAnimationStart);

  // Attach Visual Viewport Listener (The Fix)
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleVisualViewport);
  } else {
    // Fallback for older browsers (though most support visualViewport now)
    window.addEventListener("resize", handleVisualViewport);
  }

  document.querySelectorAll(`.${CONFIG.className}`).forEach((el) => mountElement(el as HTMLElement));

  new MutationObserver(handleMutations).observe(document.body, {
    childList: true,
    subtree: true,
  });
};
