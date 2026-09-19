import type { ScreenLocation } from "../data/locations";

export function screenRatio(screen?: ScreenLocation) {
  if (
    screen?.screenWidth &&
    screen.screenHeight &&
    [screen.screenWidth, screen.screenHeight].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    return screen.screenWidth / screen.screenHeight;
  if (screen?.aspectRatio) {
    const parts = screen.aspectRatio.split(/[:/]/).map(Number);
    if (
      parts.length === 2 &&
      parts.every((value) => Number.isFinite(value) && value > 0)
    )
      return parts[0] / parts[1];
  }
  return 16 / 5;
}
