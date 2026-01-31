import { Config } from "./types";

export const getRelativeShift = (config: Config): { x: number; y: number } => {
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
