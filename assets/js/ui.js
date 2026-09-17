export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[ch]));

export const money = value => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
}).format(Number(value) || 0);

export const date = value => value
  ? new Intl.DateTimeFormat("en-IN", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value))
  : "—";

export const pill = status => {
  const label = String(status ?? "unknown").replaceAll("_", " ");
  const safe = escapeHTML(label);
  return `<span class="pill pill--${escapeHTML(status || "neutral")}">${safe}</span>`;
};

export const empty = message => `
  <div class="empty">
    <div aria-hidden="true" style="font-size:2rem">🍱</div>
    <p>${escapeHTML(message)}</p>
  </div>`;

export const table = (headers, rows) => `
  <div class="tbl-wrap">
    <table class="tbl">
      <thead><tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map((cell, i) =>
        `<td data-l="${escapeHTML(headers[i] ?? "")}">${cell ?? ""}</td>`
      ).join("")}</tr>`).join("")}</tbody>
    </table>
  </div>`;

export function busy(button, task) {
  if (!button || button.disabled) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.innerHTML = `<span class="spin" aria-hidden="true"></span><span>Working…</span>`;
  Promise.resolve(task())
    .catch(error => toast(error?.message || "Something went wrong.", "err"))
    .finally(() => {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.innerHTML = original;
    });
}

export function toast(message, type = "info") {
  let host = $("#toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const item = document.createElement("div");
  item.className = `toast toast--${type}`;
  item.innerHTML = `<i aria-hidden="true">${type === "ok" ? "✓" : type === "err" ? "!" : "i"}</i><span>${escapeHTML(message)}</span>`;
  host.appendChild(item);
  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateY(4px)";
    item.style.transition = "opacity .2s, transform .2s";
    setTimeout(() => item.remove(), 220);
  }, 3200);
}

export function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let sheet = document.getElementById("ck-confetti-css");
  if (!sheet) {
    sheet = document.createElement("style");
    sheet.id = "ck-confetti-css";
    sheet.textContent = `
      .confetti-holder{position:fixed;inset:0;pointer-events:none;z-index:9999}
      .confetti-piece{position:absolute;top:-16px;will-change:transform,opacity}
      @keyframes confetti-fall{to{transform:translateY(112vh) rotate(760deg);opacity:.85}}`;
    document.head.appendChild(sheet);
  }
  const colors = ["#E6A23C", "#7AC74F", "#F0544F", "#3A86FF", "#C77DFF", "#FFC300"];
  if ($$(".confetti-holder").length > 2) return;
  const holder = document.createElement("div");
  holder.className = "confetti-holder";
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const size = 6 + Math.random() * 6;
    piece.style.cssText = `left:${Math.random() * 100}vw;width:${size}px;height:${size * 0.6}px;` +
      `background:${colors[i % colors.length]};border-radius:${Math.random() > .5 ? "50%" : "2px"};` +
      `animation:confetti-fall ${1.6 + Math.random() * 1.4}s cubic-bezier(.2,.6,.4,1) ${Math.random() * .6}s both`;
    holder.appendChild(piece);
  }
  document.body.appendChild(holder);
  setTimeout(() => holder.remove(), 4000);
}

export function modal(title, content, setup) {
  document.querySelector(".modal.open")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "modal open";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.innerHTML = `
    <div class="modal__veil" data-close></div>
    <section class="modal__box" aria-label="${escapeHTML(title)}">
      <div class="modal__grip" aria-hidden="true"></div>
      <div class="between" style="margin-bottom:16px">
        <h2>${escapeHTML(title)}</h2>
        <button class="btn btn--quiet" data-close aria-label="Close dialog">✕</button>
      </div>
      <div class="modal__content">${content}</div>
    </section>`;
  document.body.appendChild(wrap);

  const focusable = wrap.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  const close = () => {
    wrap.classList.remove("open");
    setTimeout(() => wrap.remove(), 160);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      close();
    } else if (event.key === "Tab") {
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  $$("[data-close]", wrap).forEach(el => el.addEventListener("click", close));
  document.addEventListener("keydown", onKeyDown);

  const cleanup = () => {
    document.removeEventListener("keydown", onKeyDown);
  };

  setup?.(wrap, close);
  first?.focus();

  return () => {
    close();
    cleanup();
  };
}
