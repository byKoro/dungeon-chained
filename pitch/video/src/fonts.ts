import { loadFont as loadCinzel } from "@remotion/google-fonts/Cinzel";
import { loadFont as loadRajdhani } from "@remotion/google-fonts/Rajdhani";

// Cinzel = títulos épicos (lore/logo). Rajdhani = UI/pitch.
export const cinzel = loadCinzel("normal", {
  weights: ["700"],
  subsets: ["latin"],
}).fontFamily;

export const rajdhani = loadRajdhani("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
}).fontFamily;
