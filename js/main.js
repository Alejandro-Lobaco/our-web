document.getElementById("year").textContent = new Date().getFullYear();

// Stagger delay per item inside each grid, used by the CSS transition-delay rule.
document.querySelectorAll(".features-grid, .plans-grid, .team-list").forEach((grid) => {
  grid.querySelectorAll("[data-reveal]").forEach((el, i) => {
    el.style.setProperty("--i", i);
  });
});

const revealTargets = document.querySelectorAll("[data-reveal]");

if ("IntersectionObserver" in window && revealTargets.length) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );

  revealTargets.forEach((el) => revealObserver.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add("in-view"));
}

// Header gains a shadow once the page has scrolled past the hero.
const header = document.getElementById("site-header");

if (header) {
  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

// Mobile sticky CTA appears once the visitor has scrolled past the hero.
const mobileCta = document.getElementById("mobile-cta");

if (mobileCta) {
  const updateMobileCta = () => {
    mobileCta.classList.toggle("is-visible", window.scrollY > 400);
  };

  updateMobileCta();
  window.addEventListener("scroll", updateMobileCta, { passive: true });
}
