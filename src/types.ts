export type Edge = "top" | "bottom" | "left" | "right";

export interface Config {
  valid: boolean;
  edge: Edge;
  offset: number;
}

export interface paddingConfig {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ElementState {
  element: HTMLElement;
  parent: HTMLElement;
  directParent: HTMLElement; // New: The constraint container
  directParentRect: DOMRect; // New: Cached relative position of the constraint
  naturalRect: DOMRect;
  lastScrollPos: number;
  isSticky: boolean;
  isTransforming: boolean;
  attributeObserver: MutationObserver;
  cachedViewportPadding: paddingConfig;
  currentTranslation: number;
  cachedConfig: Config;
  cachedViewportSize: number;
}
