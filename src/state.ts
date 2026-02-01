import { CONFIG } from "./constants";
import { applyStatic, applySticky, applyTransform, getScrollPosition, isCompletelyOutOfView } from "./dom";
import { ElementState } from "./types";

export const updateElementState = (state: ElementState) => {
  const { element, parent, lastScrollPos, naturalRect, cachedConfig: config, cachedViewportSize: viewportSize } = state;
  const { edge } = config;

  if (!config.valid) {
    if (state.isSticky || state.isTransforming) {
      element.style.position = "static";
      element.style.transform = "";
      state.isSticky = false;
      state.isTransforming = false;
    }
    return;
  }

  // Determine Directionality
  const isStartAnchor = edge === "top" || edge === "left";
  const isVertical = edge === "top" || edge === "bottom";

  const currentScroll = getScrollPosition(parent, edge);
  const scrollDelta = currentScroll - lastScrollPos;

  const edgePadding = state.cachedViewportPadding[edge];
  const offset = config.offset + edgePadding;

  state.lastScrollPos = currentScroll;

  // Dimensions
  const naturalStart = isVertical ? naturalRect.top : naturalRect.left;
  const dimension = isVertical ? naturalRect.height : naturalRect.width;

  // Logic Inversion for End Anchors (Bottom/Right)
  const isScrollingAway = isStartAnchor ? scrollDelta > 0 : scrollDelta < 0;
  const isScrollingToward = isStartAnchor ? scrollDelta < 0 : scrollDelta > 0;

  // --- Reset Check (Natural Position) ---
  // If we are "safe" in natural flow, reset to static.
  let isNaturalSafe = false;

  if (isStartAnchor) {
    // Top/Left: Safe if natural pos is below the sticky line
    isNaturalSafe = naturalStart >= currentScroll + offset - CONFIG.epsilon;
  } else {
    // Bottom/Right: Safe if natural pos is above the sticky line
    // Sticky Line = Scroll + Viewport - Offset
    // Element End = naturalStart + dimension
    isNaturalSafe = naturalStart + dimension <= currentScroll + viewportSize - offset + CONFIG.epsilon;
  }

  if (isNaturalSafe) {
    if (state.isSticky || state.isTransforming) {
      applyStatic(state);
      state.isSticky = false;
      state.isTransforming = false;
    }

    return;
  }

  // --- Logic B: Scroll Away (Hide) ---
  if (isScrollingAway) {
    if (state.isSticky) {
      // Transition from Sticky -> Revealed (Drifting off)
      let translation = 0;

      if (isStartAnchor) {
        // Target Visual = Scroll + Offset
        // Translate = Target - Natural
        const visualPos = currentScroll + offset;
        translation = visualPos - naturalStart;
      } else {
        // Target Visual = Scroll + Viewport - Offset - Dimension
        // (We position the top-left, so we subtract dimension to align bottom-right)
        const visualPos = currentScroll + viewportSize - offset - dimension;
        translation = visualPos - naturalStart;
      }

      if (isVertical) applyTransform(state, 0, translation);
      else applyTransform(state, translation, 0);

      state.isSticky = false;
      state.isTransforming = true;
    }

    // Exit Reset: If completely off screen, just go static/invisible
    if (state.isTransforming && isCompletelyOutOfView(element, parent)) {
      applyStatic(state);
      state.isTransforming = false;
    }
    return;
  }

  // --- Logic C: Scroll Toward (Reveal) ---
  if (isScrollingToward) {
    // Only reveal if we have naturally passed the element (it's off-screen)
    let isNaturallyPassed = false;
    if (isStartAnchor) {
      isNaturallyPassed = naturalStart + dimension < currentScroll;
    } else {
      isNaturallyPassed = naturalStart > currentScroll + viewportSize;
    }

    // 1. Reveal (Transition State)
    if (!state.isSticky && !state.isTransforming && isNaturallyPassed) {
      let translation = 0;

      if (isStartAnchor) {
        // Place just above/left of viewport
        const targetVisualPos = currentScroll - dimension;
        translation = targetVisualPos - naturalStart;
      } else {
        // Place just below/right of viewport
        const targetVisualPos = currentScroll + viewportSize;
        translation = targetVisualPos - naturalStart;
      }

      if (isVertical) applyTransform(state, 0, translation);
      else applyTransform(state, translation, 0);

      state.isTransforming = true;
    }

    // 2. Sticky Docking (Logic D)
    if (state.isTransforming) {
      const currentVisualPos = naturalStart + state.currentTranslation;
      let shouldStick = false;

      if (isStartAnchor) {
        const stickyThreshold = currentScroll + offset;
        // If we slid down enough to hit the top offset
        shouldStick = currentVisualPos >= stickyThreshold - CONFIG.epsilon;
      } else {
        const stickyThreshold = currentScroll + viewportSize - offset;
        // If we slid up enough to hit the bottom offset
        shouldStick = currentVisualPos + dimension <= stickyThreshold + CONFIG.epsilon;
      }

      if (shouldStick) {
        applySticky(element);
        state.isSticky = true;
        state.isTransforming = false;
      }
    }
  }
};
