// Mosquito Man Plus — shared site behavior (no framework, no build step)

// Mobile nav toggle
const menuButton = document.querySelector("[data-menu-button]");
const primaryNav = document.querySelector("[data-primary-nav]");

if (menuButton && primaryNav) {
  menuButton.addEventListener("click", () => {
    const isOpen = primaryNav.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  primaryNav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      primaryNav.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
}

// FAQ accordion
document.querySelectorAll("[data-accordion]").forEach((accordion) => {
  accordion.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !accordion.contains(button)) return;

    const item = button.closest(".accordion-item");
    const panel = item.querySelector(".accordion-panel");
    const mark = button.querySelector(".accordion-mark");
    const isExpanded = button.getAttribute("aria-expanded") === "true";

    button.setAttribute("aria-expanded", String(!isExpanded));
    panel.hidden = isExpanded;
    if (mark) mark.textContent = isExpanded ? "+" : "−";
  });
});

// Scroll reveal
const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -80px 0px", threshold: 0.1 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

// Pre-fill the quote form's service/location selects from a linked card
// (e.g. a service card's "Get a Quote" link to contact.html?service=...&location=...)
document.querySelectorAll("[data-quote-form]").forEach((form) => {
  const params = new URLSearchParams(window.location.search);
  const service = params.get("service");
  const locationValue = params.get("location");
  const serviceSelect = form.querySelector("select[name='service']");
  const locationSelect = form.querySelector("select[name='location']");

  if (service && serviceSelect) serviceSelect.value = service;
  if (locationValue && locationSelect) locationSelect.value = locationValue;
});

// 5% new-customer popup.
//
// Trigger: shows once, 8 seconds after the page finishes loading, on any
// page (index, about, services, areas, contact) — as long as the visitor
// hasn't already dismissed it or submitted the form.
//
// "Don't show again" memory: dismissing the popup (X button, backdrop
// click, or Escape) OR successfully submitting the form sets a flag in
// two places — localStorage (primary) and a first-party cookie (fallback,
// 30-day max-age) for browsers/private windows that restrict storage. On
// the next page load, if either flag is present, the popup never appears
// and the 8-second timer never even starts. To test repeatedly: open dev
// tools > Application/Storage, clear both the "mosquitoManDiscountOfferDismissed"
// localStorage key and cookie (or use a fresh private window each time,
// since a private window only stays "fresh" until you dismiss/submit once
// inside it).
const discountModal = document.querySelector("[data-discount-modal]");
const discountStorageKey = "mosquitoManDiscountOfferDismissed";

const discountStorage = {
  get() {
    const cookieMatch = () => document.cookie.match(new RegExp(`${discountStorageKey}=true`))?.[0];
    try {
      return window.localStorage.getItem(discountStorageKey) || cookieMatch();
    } catch {
      return cookieMatch() || null;
    }
  },
  set() {
    try {
      window.localStorage.setItem(discountStorageKey, "true");
    } catch {
      // Ignore storage failures so the offer still works in private browsing.
    }
    document.cookie = `${discountStorageKey}=true; max-age=2592000; path=/; SameSite=Lax`;
  },
};

const closeDiscountModal = () => {
  if (!discountModal) return;
  discountModal.hidden = true;
  document.body.classList.remove("modal-open");
  discountStorage.set();
};

if (discountModal && !discountStorage.get()) {
  window.setTimeout(() => {
    discountModal.hidden = false;
    document.body.classList.add("modal-open");
  }, 8000);

  discountModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-discount-close]")) {
      closeDiscountModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !discountModal.hidden) {
      closeDiscountModal();
    }
  });
}

// Contact/quote form: client-side validation + Formspree submission.
document.querySelectorAll("[data-quote-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const note = form.querySelector("[data-form-note]");
    const submitButton = form.querySelector("button[type='submit']");
    const honeypot = form.querySelector("input[name='website']");

    // Silently drop likely-bot submissions.
    if (honeypot && honeypot.value) return;

    form.classList.add("was-validated");

    if (!form.checkValidity()) {
      form.reportValidity();
      if (note) {
        note.textContent = "Please fill in the required fields above.";
        note.classList.add("is-error");
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent;
      submitButton.textContent = "Sending…";
    }
    if (note) {
      note.textContent = "Sending…";
      note.classList.remove("is-error");
    }

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });

      if (!response.ok) throw new Error(`Formspree responded with ${response.status}`);

      form.reset();
      form.classList.remove("was-validated");
      if (note) {
        note.textContent =
          form.dataset.successMessage || "Thanks. Mosquito Man Plus received your request and will follow up soon.";
      }
    } catch (error) {
      if (note) {
        note.textContent = "Something went wrong sending your request. Please call 905-924-2847 instead.";
        note.classList.add("is-error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || "Submit";
      }
    }
  });
});

// 5% discount popup: client-side validation + /api/subscribe (Mailchimp).
document.querySelectorAll("[data-discount-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const note = form.querySelector("[data-form-note]");
    const submitButton = form.querySelector("button[type='submit']");
    const honeypot = form.querySelector("input[name='website']");

    // Silently drop likely-bot submissions.
    if (honeypot && honeypot.value) return;

    form.classList.add("was-validated");

    if (!form.checkValidity()) {
      form.reportValidity();
      if (note) {
        note.textContent = "Please fill in the required fields above.";
        note.classList.add("is-error");
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent;
      submitButton.textContent = "Sending…";
    }
    if (note) {
      note.textContent = "Sending…";
      note.classList.remove("is-error");
    }

    try {
      const email = form.querySelector("input[name='email']").value;
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) throw new Error(`Subscribe responded with ${response.status}`);

      if (data.existing) {
        if (note) {
          note.textContent = "You're already subscribed! Use code PEST5.";
          note.classList.remove("is-error");
        }
      } else {
        const successMessage = form.parentElement.querySelector("[data-discount-success]");
        form.hidden = true;
        if (successMessage) {
          successMessage.textContent = "🎉 Your 5% discount code is PEST5! Check your inbox.";
          successMessage.hidden = false;
        }
      }
      discountStorage.set();
    } catch (error) {
      if (note) {
        note.textContent = "Something went wrong. Please try again.";
        note.classList.add("is-error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || "Submit";
      }
    }
  });
});
