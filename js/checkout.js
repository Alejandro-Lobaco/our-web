const PLANS = {
  basica: {
    name: "Básica",
    price: 99,
    desc: "Todo lo necesario para empezar.",
    accent: "basica",
    features: [
      "Diseño personalizado",
      "Galería",
      "Opiniones",
      "Reservas",
      "WhatsApp",
      "Animaciones simples",
      "1 mes de garantía",
    ],
  },
  profesional: {
    name: "Profesional",
    price: 199,
    desc: "Más personalización y funcionalidades.",
    accent: "profesional",
    features: [
      "Todo lo de Básica",
      "Diseño más avanzado",
      "Animaciones avanzadas",
      "2 idiomas",
      "Más personalización",
      "2 meses de garantía",
    ],
  },
  premium: {
    name: "Premium",
    price: 299,
    desc: "La opción más completa.",
    accent: "premium",
    features: [
      "Todo lo de Profesional",
      "Diseño totalmente personalizado",
      "Funcionalidades especiales",
      "Reservas avanzadas",
      "2+ idiomas según proyecto",
      "3 revisiones",
      "4 meses de garantía",
    ],
  },
};

const HOLD_MS = 1600;

const params = new URLSearchParams(window.location.search);
const planSlug = PLANS[params.get("plan")] ? params.get("plan") : "profesional";
const plan = PLANS[planSlug];

const orderCard = document.getElementById("order-card");
const orderPlanName = document.getElementById("order-plan-name");
const orderPlanPrice = document.getElementById("order-plan-price");
const orderPlanDesc = document.getElementById("order-plan-desc");
const orderFeatures = document.getElementById("order-features");

orderCard.classList.add(`order-card-${plan.accent}`);
orderPlanName.textContent = plan.name;
orderPlanPrice.textContent = plan.price;
orderPlanDesc.textContent = plan.desc;
orderFeatures.innerHTML = plan.features.map((f) => `<li>${f}</li>`).join("");

const acceptTerms = document.getElementById("accept-terms");
const payBtn = document.getElementById("pay-btn");
const tpvStatus = document.getElementById("tpv-status");
const receiptWell = document.getElementById("receipt-well");
const receiptPaper = document.getElementById("receipt-paper");
const checkoutSuccess = document.getElementById("checkout-success");

acceptTerms.addEventListener("change", () => {
  payBtn.disabled = !acceptTerms.checked;
});

let holding = false;
let holdTimer = null;
let paid = false;

function startHold(event) {
  if (payBtn.disabled || paid) return;
  event.preventDefault();
  holding = true;
  payBtn.style.setProperty("--hold-duration", `${HOLD_MS}ms`);
  payBtn.classList.add("is-holding");
  holdTimer = setTimeout(() => {
    if (holding) completePayment();
  }, HOLD_MS);
}

function cancelHold() {
  if (!holding) return;
  holding = false;
  clearTimeout(holdTimer);
  payBtn.classList.remove("is-holding");
}

payBtn.addEventListener("pointerdown", startHold);
["pointerup", "pointerleave", "pointercancel"].forEach((evt) =>
  payBtn.addEventListener(evt, cancelHold)
);

function completePayment() {
  paid = true;
  holding = false;
  payBtn.classList.remove("is-holding");
  payBtn.classList.add("is-success");
  payBtn.disabled = true;
  payBtn.querySelector(".pay-hold-label").textContent = "Pago confirmado ✓";
  tpvStatus.textContent = "Procesando pago…";

  const now = new Date();
  const orderNumber = `NW-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

  document.getElementById("receipt-date").textContent = now.toLocaleString("es-ES");
  document.getElementById("receipt-order").textContent = `Pedido: ${orderNumber}`;
  document.getElementById("receipt-plan-line").textContent = `Plan: ${plan.name}`;
  document.getElementById("receipt-total-line").textContent = `Total: ${plan.price},00 €`;

  setTimeout(() => {
    tpvStatus.textContent = "Imprimiendo tique…";
    printReceipt();
  }, 600);
}

function printReceipt() {
  receiptWell.style.height = `${receiptPaper.scrollHeight}px`;

  const onDone = (e) => {
    if (e.propertyName !== "height") return;
    receiptWell.removeEventListener("transitionend", onDone);
    tpvStatus.textContent = "¡Pago completado!";
    checkoutSuccess.classList.add("is-visible");
  };
  receiptWell.addEventListener("transitionend", onDone);
}
