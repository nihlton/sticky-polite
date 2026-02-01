// --- DOM & Math Helpers ---

import { CONFIG } from "./constants";
import { getRelativeShift } from "./math";
import { Config, Edge, ElementState, paddingConfig } from "./types";

export const defaultPaddingConfig = { top: 0, bottom: 0, left: 0, right: 0 };

export const injectAnimationBeacon = () => {
  if (document.getElementById("sticky-polite-beacon")) return;

  const style = document.createElement("style");
  style.id = "sticky-polite-beacon";
  style.innerHTML = `
    @keyframes sticky-polite-announce { 
      from { opacity: 0.999; } 
      to { opacity: 1; } 
    }
    .${CONFIG.className} { 
      animation-duration: 1ms; 
      animation-name: sticky-polite-announce; 
    }
  `;
  document.head.appendChild(style);
};

export const getContainerPadding = (container: HTMLElement | Window): paddingConfig => {
  if (container instanceof Window) {
    return defaultPaddingConfig;
  }

  const style = getComputedStyle(container);
  return {
    top: parseInt(style.paddingTop, 10) || 0,
    bottom: parseInt(style.paddingBottom, 10) || 0,
    left: parseInt(style.paddingLeft, 10) || 0,
    right: parseInt(style.paddingRight, 10) || 0,
  };
};

export const applyTransform = (state: ElementState, targetX: number, targetY: number) => {
  const { element, cachedConfig } = state;
  const shift = getRelativeShift(cachedConfig);

  const finalX = targetX - shift.x;
  const finalY = targetY - shift.y;

  element.style.position = "relative";
  element.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
  element.setAttribute(CONFIG.attrName, "intersect");

  state.currentTranslation = targetX !== 0 ? targetX : targetY;
};

export const applySticky = (element: HTMLElement) => {
  element.style.position = "sticky";
  element.style.transform = "";
  element.setAttribute(CONFIG.attrName, "sticky");
};

export const applyStatic = (state: ElementState) => {
  const { element, cachedConfig } = state;
  const shift = getRelativeShift(cachedConfig);

  element.style.position = "relative";
  element.style.transform = `translate3d(${-shift.x}px, ${-shift.y}px, 0)`;
  element.setAttribute(CONFIG.attrName, "static");
};

// Safe to call inside ResizeObserver
export const measureViewportSize = (parent: HTMLElement, edge: Edge): number => {
  const isVertical = edge === "top" || edge === "bottom";
  if (parent === document.documentElement) {
    if (window.visualViewport) {
      return isVertical ? window.visualViewport.height : window.visualViewport.width;
    }
    return isVertical ? window.innerHeight : window.innerWidth;
  }
  return isVertical ? parent.clientHeight : parent.clientWidth;
};

export const getScrollPosition = (parent: HTMLElement, edge: Edge): number => {
  const isWindow = parent === document.documentElement;
  if (edge === "left" || edge === "right") return isWindow ? window.scrollX : parent.scrollLeft;
  return isWindow ? window.scrollY : parent.scrollTop;
};

export const getScrollParent = (node: HTMLElement): HTMLElement => {
  if (!node || node === document.body) return document.documentElement;
  const style = getComputedStyle(node);
  const overflowY = style.overflowY;
  const isScrollable = overflowY !== "visible" && overflowY !== "hidden";
  if (isScrollable && node.scrollHeight >= node.clientHeight) return node;
  return getScrollParent(node.parentElement as HTMLElement);
};

export const getPageOffset = (element: HTMLElement): { top: number; left: number } => {
  let el: HTMLElement | null = element;
  let top = 0;
  let left = 0;

  while (el) {
    top += el.offsetTop;
    left += el.offsetLeft;
    el = el.offsetParent as HTMLElement;
  }
  return { top, left };
};

export const measureNaturalRect = (element: HTMLElement, parent: HTMLElement): DOMRect => {
  // 1. Check if we need to clean-slate the element
  // We only need to do this if the element is currently heavily modified
  // (Sticky or Transformed) to ensure we get true "Natural" dimensions.
  const isManaged = element.hasAttribute(CONFIG.attrName);
  const prevPosition = element.style.position;
  const prevTransform = element.style.transform;

  if (isManaged) {
    element.style.position = "relative";
    element.style.transform = "";
  }

  const { width, height } = element.getBoundingClientRect();
  const elOffset = getPageOffset(element);

  if (isManaged) {
    element.style.position = prevPosition;
    element.style.transform = prevTransform;
  }

  if (parent === document.documentElement) {
    return {
      top: elOffset.top,
      left: elOffset.left,
      width,
      height,
      bottom: elOffset.top + height,
      right: elOffset.left + width,
      x: elOffset.left,
      y: elOffset.top,
      toJSON: () => {},
    };
  }

  const parentOffset = getPageOffset(parent);
  const top = elOffset.top - parentOffset.top - (parent.clientTop || 0);
  const left = elOffset.left - parentOffset.left - (parent.clientLeft || 0);

  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
    x: left,
    y: top,
    toJSON: () => {},
  };
};

export const isCompletelyOutOfView = (element: HTMLElement, parent: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();

  let parentRect;
  if (parent === document.documentElement) {
    if (window.visualViewport) {
      parentRect = {
        top: 0,
        left: 0,
        bottom: window.visualViewport.height,
        right: window.visualViewport.width,
      };
    } else {
      parentRect = {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
      };
    }
  } else {
    parentRect = parent.getBoundingClientRect();
  }

  return rect.bottom < parentRect.top || rect.top > parentRect.bottom || rect.right < parentRect.left || rect.left > parentRect.right;
};

export const readConfigFromDOM = (element: HTMLElement): Config => {
  // 1. Clean Slate: Temporarily remove inline positioning.
  // This prevents 'position: relative' from generating computed artifacts
  // (e.g., preventing 'top' from computing to '-32px' when 'bottom' is set).
  const prevPosition = element.style.position;
  const isManaged = element.hasAttribute(CONFIG.attrName);

  if (isManaged) {
    element.style.position = "";
  }

  const edges: Edge[] = ["top", "bottom", "left", "right"];
  let foundEdge: Edge | null = null;
  let foundOffset = 0;

  // 2. Attempt Modern API (CSS Typed OM)
  if ("computedStyleMap" in element) {
    try {
      const map = element.computedStyleMap();
      for (const edge of edges) {
        const val = map.get(edge);

        // In Typed OM, 'auto' is a CSSKeywordValue. We only want CSSUnitValue.
        // We also check value != 0 to ensure we don't accidentally grab a default.
        // (If explicit 'top: 0' is set, it will be valid).
        if (val && "value" in val && typeof val.value === "number") {
          if (foundEdge) {
            // Restore before returning
            if (isManaged) element.style.position = prevPosition;
            return { valid: false, edge: "top", offset: 0 };
          }
          foundEdge = edge;
          foundOffset = val.value;
        }
      }
    } catch (e) {}
  }

  // 3. Fallback (Firefox / Legacy) or if Typed OM was skipped
  if (!foundEdge) {
    const style = getComputedStyle(element);
    for (const edge of edges) {
      const value = style.getPropertyValue(edge);
      // Check for non-auto, non-empty values
      if (value && value !== "auto" && value !== "") {
        if (foundEdge) {
          if (isManaged) element.style.position = prevPosition;
          return { valid: false, edge: "top", offset: 0 };
        }
        foundEdge = edge;
        foundOffset = parseFloat(value) || 0;
      }
    }
  }

  // 4. Restore State
  if (isManaged) {
    element.style.position = prevPosition;
  }

  return foundEdge ? { valid: true, edge: foundEdge, offset: foundOffset } : { valid: false, edge: "top", offset: 0 };
};
