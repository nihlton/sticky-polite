// observer.ts

import { CONFIG } from "./constants";
import {
  applyStatic,
  applySticky,
  defaultPaddingConfig,
  getContainerPadding,
  getScrollParent,
  injectAnimationBeacon,
  measureConstraintRect, // New Import
  measureNaturalRect,
  measureViewportSize,
  readConfigFromDOM,
} from "./dom";
import { updateElementState } from "./state";
import { ElementState } from "./types";

const stateRegistry = new Map<HTMLElement, ElementState>();
const cleanupRegistry = new Map<HTMLElement, () => void>();

const resizeTickMap = new WeakMap<ElementState, boolean>();

const refreshState = (state: ElementState) => {
  const { element, parent, directParent } = state;
  state.cachedConfig = readConfigFromDOM(element);
  state.naturalRect = measureNaturalRect(element, parent);

  // Change: Use measureConstraintRect to handle scroll containers correctly
  state.directParentRect = measureConstraintRect(directParent, parent);

  state.cachedViewportSize = measureViewportSize(parent, state.cachedConfig.edge);
  state.cachedViewportPadding = getContainerPadding(parent);

  if (state.isSticky) {
    applySticky(element);
  } else {
    applyStatic(state);
    state.isTransforming = false;
  }

  updateElementState(state);
};

const scheduleRefresh = (state: ElementState) => {
  if (resizeTickMap.get(state)) return;

  window.requestAnimationFrame(() => {
    refreshState(state);
    resizeTickMap.set(state, false);
  });
  resizeTickMap.set(state, true);
};

const handleResizeObserver = (entries: ResizeObserverEntry[]) => {
  const changedNodes = new Set(entries.map((e) => e.target));

  for (const state of stateRegistry.values()) {
    if (changedNodes.has(state.element) || changedNodes.has(state.parent) || changedNodes.has(state.directParent)) {
      scheduleRefresh(state);
    }
  }
};

const handleVisualViewport = () => {
  for (const state of stateRegistry.values()) {
    if (state.parent === document.documentElement || state.parent === document.body) {
      scheduleRefresh(state);
    }
  }
};

const resizeObserver = new ResizeObserver(handleResizeObserver);

export const mountElement = (element: HTMLElement) => {
  if (stateRegistry.has(element)) return;

  const parent = getScrollParent(element);
  const directParent = element.parentElement || parent;

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
    directParent,
    directParentRect: { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => {} },
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

  resizeObserver.observe(element);
  resizeObserver.observe(parent);

  if (directParent !== parent) {
    resizeObserver.observe(directParent);
  }

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
    let directParentInUse = false;

    for (const [el, s] of stateRegistry.entries()) {
      if (el === element) continue;

      if (s.parent === parent) parentInUse = true;
      if (s.directParent === directParent) directParentInUse = true;
    }

    if (!parentInUse) {
      resizeObserver.unobserve(parent);
    }

    if (!directParentInUse && directParent !== parent) {
      resizeObserver.unobserve(directParent);
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

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleVisualViewport);
  } else {
    window.addEventListener("resize", handleVisualViewport);
  }

  document.querySelectorAll(`.${CONFIG.className}`).forEach((el) => mountElement(el as HTMLElement));

  new MutationObserver(handleMutations).observe(document.body, {
    childList: true,
    subtree: true,
  });
};
