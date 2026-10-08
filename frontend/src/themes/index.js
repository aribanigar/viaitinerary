// JS-side copies of the theme colours, for places CSS classes can't reach:
// chart strokes/gradients, Google Maps markers and inline styles. Keep these
// in sync with src/themes/*.css, and ACTIVE_THEME with the theme imported
// at the top of src/index.css.
const THEMES = {
  "via-kashmir": {
    brand: "#00361a",
    ink: "#191c1d",
    accent: "#b8f0c5",
    accentHover: "#9dd3aa",
    onAccent: "#00210e",
  },
  // Backup: the "Minimalist Editorial" look (graphite + lime).
  editorial: {
    brand: "#181c22",
    ink: "#181c22",
    accent: "#e7f63c",
    accentHover: "#d4e42e",
    onAccent: "#181c22",
  },
};

export const ACTIVE_THEME = "via-kashmir";

export const themeColors = THEMES[ACTIVE_THEME];
