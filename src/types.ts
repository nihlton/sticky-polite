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
  naturalRect: DOMRect;
  lastScrollPos: number;
  isSticky: boolean;
  isTransforming: boolean;
  attributeObserver: MutationObserver;
  resizeObserver: ResizeObserver;
  cachedViewportPadding: paddingConfig;
  currentTranslation: number;
  cachedConfig: Config;
  cachedViewportSize: number;
}
