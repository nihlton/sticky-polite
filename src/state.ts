// state.ts

import { CONFIG } from "./constants";
import { applyStatic, applySticky, applyTransform, getScrollPosition } from "./dom";
import { ElementState } from "./types";

// --- Types & Context ---
// a junk-drawer of boundaries and measurements we'll need to dermine what to do
interface FrameContext {
  isVertical: boolean;
  isStartAnchor: boolean; // top/left = true.  bottom/right = false;
  currentScroll: number;
  viewportSize: number;
  scrollDelta: number;
  offset: number; // CSS edge offset + container Padding)
  implicitShift: number; // Visual shift from relative positioning
  layoutStart: number;
  dimension: number;
  constraintStart: number;
  constraintEnd: number;
}

// --- Helpers ---

const getFrameContext = (state: ElementState): FrameContext => {
  const {
    parent,
    lastScrollPos,
    naturalRect,
    cachedConfig: config,
    cachedViewportSize: viewportSize,
    directParentRect,
    cachedViewportPadding,
  } = state;
  const { edge, offset: cssOffset } = config;

  const isVertical = edge === "top" || edge === "bottom";
  const isStartAnchor = edge === "top" || edge === "left";

  const currentScroll = getScrollPosition(parent, edge);
  const scrollDelta = currentScroll - lastScrollPos;

  const offset = cssOffset + cachedViewportPadding[edge];

  // Dimensions
  const layoutStart = isVertical ? naturalRect.top : naturalRect.left;
  const dimension = isVertical ? naturalRect.height : naturalRect.width;

  // Implicit Shift & Visual Start
  const implicitShift = isStartAnchor ? cssOffset : -cssOffset;
  const visualStart = layoutStart + implicitShift;

  // Constraints
  const constraintEnd = isVertical ? directParentRect.bottom : directParentRect.right;
  const constraintStart = isVertical ? directParentRect.top : directParentRect.left;

  return {
    isVertical,
    isStartAnchor,
    currentScroll,
    viewportSize,
    scrollDelta,
    offset,
    implicitShift,
    layoutStart,
    dimension,
    constraintStart,
    constraintEnd,
  };
};

const isParentOutOfView = (ctx: FrameContext): boolean => {
  const viewportEnd = ctx.currentScroll + ctx.viewportSize;
  return ctx.constraintEnd < ctx.currentScroll || ctx.constraintStart > viewportEnd;
};

const isNaturalPosSafe = (ctx: FrameContext): boolean => {
  if (ctx.isStartAnchor) {
    return ctx.layoutStart >= ctx.currentScroll + ctx.offset - CONFIG.epsilon;
  }
  return ctx.layoutStart + ctx.dimension <= ctx.currentScroll + ctx.viewportSize - ctx.offset + CONFIG.epsilon;
};

const processScrollAway = (ctx: FrameContext, state: ElementState) => {
  // Logic B: Scroll Away (Hide)
  if (state.isSticky) {
    let translation = 0;

    if (ctx.isStartAnchor) {
      // Visual Pos = Sticky Position = currentScroll + Offset
      // Translation = TargetVisual - LayoutStart
      const targetVisual = ctx.currentScroll + ctx.offset;
      translation = targetVisual - ctx.layoutStart;
    } else {
      const targetVisual = ctx.currentScroll + ctx.viewportSize - ctx.offset - ctx.dimension;
      translation = targetVisual - ctx.layoutStart;
    }

    // Adjust for Implicit Shift
    const finalTransform = translation - ctx.implicitShift;

    if (ctx.isVertical) applyTransform(state, 0, finalTransform);
    else applyTransform(state, finalTransform, 0);

    state.isSticky = false;
    state.isTransforming = true;
  }

  // Optimization: Math-based Visibility Check (No DOM Read)
  if (state.isTransforming) {
    const currentVisualPos = ctx.layoutStart + state.currentTranslation + ctx.implicitShift;

    let isHidden = false;
    if (ctx.isStartAnchor) {
      // Hidden if bottom of element is above scroll top
      isHidden = currentVisualPos + ctx.dimension < ctx.currentScroll;
    } else {
      // Hidden if top of element is below scroll bottom
      isHidden = currentVisualPos > ctx.currentScroll + ctx.viewportSize;
    }

    if (isHidden) {
      applyStatic(state);
      state.isTransforming = false;
    }
  }
};

const processScrollToward = (ctx: FrameContext, state: ElementState) => {
  // Logic C: Scroll Toward (Reveal)

  // 1. Check if we have physically passed the element
  let isNaturallyPassed = false;
  const visualStart = ctx.layoutStart + ctx.implicitShift;

  if (ctx.isStartAnchor) {
    isNaturallyPassed = visualStart + ctx.dimension < ctx.currentScroll;
  } else {
    isNaturallyPassed = visualStart > ctx.currentScroll + ctx.viewportSize;
  }

  // 2. Trigger: Place Element for Reveal
  if (!state.isSticky && !state.isTransforming && isNaturallyPassed) {
    let targetVisual = 0;

    if (ctx.isStartAnchor) {
      // Place bottom of element at top of viewport
      targetVisual = ctx.currentScroll - ctx.dimension;

      // Clamp
      const maxPos = ctx.constraintEnd - ctx.dimension;
      if (targetVisual > maxPos) targetVisual = maxPos;
    } else {
      // Place top of element at bottom of viewport
      targetVisual = ctx.currentScroll + ctx.viewportSize;

      // Clamp
      const minPos = ctx.constraintStart;
      if (targetVisual < minPos) targetVisual = minPos;
    }

    const translation = targetVisual - ctx.layoutStart;
    const finalTransform = translation - ctx.implicitShift;

    // Check for "Effectively Static"
    if (Math.abs(finalTransform - -ctx.implicitShift) < CONFIG.epsilon) {
      applyStatic(state);
      state.isTransforming = false;
    } else {
      if (ctx.isVertical) applyTransform(state, 0, finalTransform);
      else applyTransform(state, finalTransform, 0);
      state.isTransforming = true;
    }
  }

  // 3. Docking Check
  if (state.isTransforming) {
    const currentVisualPos = ctx.layoutStart + state.currentTranslation + ctx.implicitShift;
    let shouldStick = false;

    if (ctx.isStartAnchor) {
      const stickyThreshold = ctx.currentScroll + ctx.offset;
      if (currentVisualPos >= stickyThreshold - CONFIG.epsilon) {
        shouldStick = true;
      }
    } else {
      const stickyThreshold = ctx.currentScroll + ctx.viewportSize - ctx.offset;
      if (currentVisualPos + ctx.dimension <= stickyThreshold + CONFIG.epsilon) {
        shouldStick = true;
      }
    }

    if (shouldStick) {
      applySticky(state.element);
      state.isSticky = true;
      state.isTransforming = false;
    }
  }
};

export const updateElementState = (state: ElementState) => {
  if (!state.cachedConfig.valid) {
    if (state.isSticky || state.isTransforming) {
      state.element.style.position = "static";
      state.element.style.transform = "";
      state.isSticky = false;
      state.isTransforming = false;
    }
    return;
  }

  // 1. Prepare Context (Derived Variables)
  const ctx = getFrameContext(state);
  state.lastScrollPos = ctx.currentScroll;

  // 2. Guard: Constraint Visibility
  if (isParentOutOfView(ctx)) {
    if (state.isSticky || state.isTransforming) {
      applyStatic(state);
      state.isSticky = false;
      state.isTransforming = false;
    }
    return;
  }

  // 3. Safety Check: Are we naturally below the fold?
  if (isNaturalPosSafe(ctx)) {
    if (state.isSticky || state.isTransforming) {
      applyStatic(state);
      state.isSticky = false;
      state.isTransforming = false;
    }
    return;
  }

  const isScrollingAway = ctx.isStartAnchor ? ctx.scrollDelta > 0 : ctx.scrollDelta < 0;
  const isScrollingToward = ctx.isStartAnchor ? ctx.scrollDelta < 0 : ctx.scrollDelta > 0;

  // 4. Directional Logic
  if (isScrollingAway) {
    processScrollAway(ctx, state);
  } else if (isScrollingToward) {
    processScrollToward(ctx, state);
  }
};
