// Loaded in <head> so the theme is applied before first paint.
(function () {
  const key = "text-compare-theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function stored() {
    try {
      const value = localStorage.getItem(key);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  function apply(theme) {
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#0f1420" : "#f5f7fb";
    document.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }

  window.textCompareTheme = {
    current: () => root.dataset.theme,
    toggle() {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(key, next);
      } catch {}
      apply(next);
    },
  };

  root.dataset.theme = stored() ?? (media.matches ? "dark" : "light");
  media.addEventListener("change", (event) => {
    if (!stored()) apply(event.matches ? "dark" : "light");
  });
})();
