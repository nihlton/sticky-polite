// dom.ts

import { CONFIG } from "./constants";
import { Config, Edge, ElementState, paddingConfig } from "./types";

export const defaultPaddingConfig = { top: 0, bottom: 0, left: 0, right: 0 };

const getRelativeShift = (config: Config): { x: number; y: number } => {
  if (!config.valid) return { x: 0, y: 0 };
  const { edge, offset } = config;

  switch (edge) {
    case "top":
      return { x: 0, y: offset };
    case "bottom":
      return { x: 0, y: -offset };
    case "left":
      return { x: offset, y: 0 };
    case "right":
      return { x: -offset, y: 0 };
  }
};

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
  if (container instanceof Window || container === document.documentElement || container === document.body) {
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
  const { element } = state;
  element.style.position = "relative";
  element.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
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

export const measureRelativeRect = (target: HTMLElement, ancestor: HTMLElement): DOMRect => {
  const tRect = target.getBoundingClientRect();

  let aRectTop = 0;
  let aRectLeft = 0;
  let scrollTop = 0;
  let scrollLeft = 0;
  let clientTop = 0;
  let clientLeft = 0;

  if (ancestor === document.documentElement) {
    scrollTop = window.scrollY;
    scrollLeft = window.scrollX;
  } else {
    const aRect = ancestor.getBoundingClientRect();
    aRectTop = aRect.top;
    aRectLeft = aRect.left;
    scrollTop = ancestor.scrollTop;
    scrollLeft = ancestor.scrollLeft;
    clientTop = ancestor.clientTop || 0;
    clientLeft = ancestor.clientLeft || 0;
  }

  const top = tRect.top - aRectTop + scrollTop - clientTop;
  const left = tRect.left - aRectLeft + scrollLeft - clientLeft;

  return {
    top,
    left,
    width: tRect.width,
    height: tRect.height,
    bottom: top + tRect.height,
    right: left + tRect.width,
    x: left,
    y: top,
    toJSON: () => {},
  };
};

export const measureConstraintRect = (target: HTMLElement, ancestor: HTMLElement): DOMRect => {
  // Fix for Issue 3 (Nested Scroll):
  // If the direct parent IS the scrolling container, the constraint is the
  // CONTENT size (scrollHeight), not the VIEWPORT size (getBoundingClientRect).
  if (target === ancestor) {
    const width = ancestor.scrollWidth;
    const height = ancestor.scrollHeight;
    return {
      top: 0,
      left: 0,
      width,
      height,
      bottom: height,
      right: width,
      x: 0,
      y: 0,
      toJSON: () => {},
    };
  }

  return measureRelativeRect(target, ancestor);
};

export const measureNaturalRect = (element: HTMLElement, parent: HTMLElement): DOMRect => {
  const isManaged = element.hasAttribute(CONFIG.attrName);

  const prevPosition = element.style.position;
  const prevTransform = element.style.transform;
  const prevTop = element.style.top;
  const prevLeft = element.style.left;
  const prevRight = element.style.right;
  const prevBottom = element.style.bottom;

  if (isManaged) {
    element.style.position = "relative";
    element.style.transform = "";
    element.style.top = "auto";
    element.style.left = "auto";
    element.style.right = "auto";
    element.style.bottom = "auto";
  }

  const rect = measureRelativeRect(element, parent);

  if (isManaged) {
    element.style.position = prevPosition;
    element.style.transform = prevTransform;
    element.style.top = prevTop;
    element.style.left = prevLeft;
    element.style.right = prevRight;
    element.style.bottom = prevBottom;
  }

  return rect;
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
  const prevPosition = element.style.position;
  const isManaged = element.hasAttribute(CONFIG.attrName);

  if (isManaged) {
    element.style.position = "";
  }

  const edges: Edge[] = ["top", "bottom", "left", "right"];
  let foundEdge: Edge | null = null;
  let foundOffset = 0;

  if ("computedStyleMap" in element) {
    try {
      const map = element.computedStyleMap();
      for (const edge of edges) {
        const val = map.get(edge);
        if (val && "value" in val && typeof val.value === "number") {
          if (foundEdge) {
            if (isManaged) element.style.position = prevPosition;
            return { valid: false, edge: "top", offset: 0 };
          }
          foundEdge = edge;
          foundOffset = val.value;
        }
      }
    } catch (e) {}
  }

  if (!foundEdge) {
    const style = getComputedStyle(element);
    for (const edge of edges) {
      const value = style.getPropertyValue(edge);
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

  if (isManaged) {
    element.style.position = prevPosition;
  }

  return foundEdge ? { valid: true, edge: foundEdge, offset: foundOffset } : { valid: false, edge: "top", offset: 0 };
};
