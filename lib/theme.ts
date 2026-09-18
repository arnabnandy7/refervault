export const THEME_STORAGE_KEY = "refervault-theme";

export const THEME_INITIALIZATION_SCRIPT = `
  try {
    const savedTheme = localStorage.getItem("${THEME_STORAGE_KEY}");
    const theme = savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    const theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }
`;
