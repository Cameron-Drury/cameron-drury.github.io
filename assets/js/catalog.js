(() => {
  "use strict";
  const search = document.querySelector("#software-search");
  const category = document.querySelector("#software-category");
  const cards = [...document.querySelectorAll("[data-software-card]")];
  const count = document.querySelector("#catalog-count");
  const empty = document.querySelector("#catalog-empty");
  const reset = document.querySelector("#catalog-reset");
  if (!search || !category || !count || !empty) return;
  search.disabled = false;
  category.disabled = false;
  const normalize = (value) => value.toLocaleLowerCase().normalize("NFKD");
  function filter() {
    const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let matches = 0;
    for (const card of cards) {
      const text = normalize(card.dataset.search || "");
      const visible =
        (category.value === "all" ||
          card.dataset.category === category.value) &&
        words.every((word) => text.includes(word));
      card.hidden = !visible;
      if (visible) matches += 1;
    }
    const filtered = words.length > 0 || category.value !== "all";
    count.textContent = `${matches} free ${matches === 1 ? "app" : "apps"}${filtered ? " found" : ", ready to use"}`;
    empty.hidden = matches !== 0;
  }
  search.addEventListener("input", filter);
  category.addEventListener("change", filter);
  search
    .closest("form")
    ?.addEventListener("submit", (event) => event.preventDefault());
  reset?.addEventListener("click", () => {
    search.value = "";
    category.value = "all";
    filter();
    search.focus();
  });
})();
