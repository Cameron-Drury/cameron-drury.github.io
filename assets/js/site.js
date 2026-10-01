(() => {
  "use strict";
  document.documentElement.classList.add("js");
  const menu = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#site-nav");
  function closeMenu(returnFocus = false) {
    if (!menu || !nav) return;
    menu.setAttribute("aria-expanded", "false");
    menu.textContent = "Menu";
    nav.classList.remove("is-open");
    if (returnFocus) menu.focus();
  }
  menu?.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.textContent = open ? "Close" : "Menu";
    nav.classList.toggle("is-open", open);
  });
  nav
    ?.querySelectorAll("a")
    .forEach((link) => link.addEventListener("click", () => closeMenu()));
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      menu?.getAttribute("aria-expanded") === "true"
    )
      closeMenu(true);
  });
  window
    .matchMedia("(min-width: 761px)")
    .addEventListener("change", (event) => {
      if (event.matches) closeMenu();
    });
  const motionButton = document.querySelector("[data-motion]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function setMotion(paused) {
    paused = paused || reducedMotion.matches;
    document.documentElement.classList.toggle("motion-off", paused);
    if (motionButton) {
      motionButton.disabled = reducedMotion.matches;
      motionButton.textContent = reducedMotion.matches
        ? "Reduced motion"
        : paused
          ? "Enable motion"
          : "Pause motion";
      motionButton.setAttribute("aria-pressed", String(paused));
    }
  }
  setMotion(reducedMotion.matches);
  reducedMotion.addEventListener("change", (event) => setMotion(event.matches));
  motionButton?.addEventListener("click", () =>
    setMotion(!document.documentElement.classList.contains("motion-off")),
  );
  const form = document.querySelector("#support-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const game = data.get("game");
    const topic = data.get("topic");
    const body = `Hi Drury Module,\n\nSoftware / game: ${game}\nTopic: ${topic}\nDevice / OS: ${data.get("device") || "Not specified"}\nApp / browser version: ${data.get("version") || "Not specified"}\n\n${data.get("message")}\n\n`;
    const url = `mailto:camerondrurytas@gmail.com?subject=${encodeURIComponent(`${game} — ${topic}`)}&body=${encodeURIComponent(body)}`;
    document.querySelector("#form-status").textContent =
      "Your email draft is ready. Complete and send it in your email app. If it did not open, use the email address on this page.";
    const retry = document.querySelector("#email-draft-link");
    retry.href = url;
    retry.hidden = false;
    window.location.href = url;
  });
  if (form) document.querySelector("#support-fields").disabled = false;
})();
