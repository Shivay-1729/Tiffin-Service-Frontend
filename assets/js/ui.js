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

  const close = () => {
    wrap.classList.remove("open");
    setTimeout(() => wrap.remove(), 160);
  };
  $$("[data-close]", wrap).forEach(el => el.addEventListener("click", close));
  document.addEventListener("keydown", function esc(event) {
    if (event.key === "Escape") {
      close();
      document.removeEventListener("keydown", esc);
    }
  }, { once:false });

  setup?.(wrap, close);
  return close;
}
