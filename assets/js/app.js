import { api, session, logout, setSession } from "./api.js";
import { CONFIG } from "./config.js";
import { $, $$, escapeHTML as e, money, date, pill, toast, busy, modal, empty, table, confetti } from "./ui.js";

const auth = session();
const isAdmin = location.pathname.includes("/admin/");
const base = isAdmin ? "../" : "../";

if (!auth?.user) location.replace("../login.html");
else if (isAdmin && auth.user.role !== "ADMIN") location.replace("../app/dashboard.html");
else initialize();

const KITCHENS = [
  ["all","All items"],
  ["thali","Shri Shyam Rasoi"]
];
const brandLabel = key => KITCHENS.find(([k]) => k === key)?.[1] ?? "Shri Shyam Rasoi";

function initialize() {
  const page = document.body.dataset.page;
  const root = isAdmin ? "" : "";
  const links = isAdmin
    ? [["dashboard","Overview","◫"],["menu","Menu","☷"],["orders","Orders","▣"],["customers","Customers","♙"]]
    : [["dashboard","Home","⌂"],["menu","Menu","☷"],["orders","Orders","▣"],["subscriptions","Plans","◇"],["profile","Profile","○"]];
  const title = links.find(([key]) => key === page)?.[1] || "Rasoi";
  const pageUrl = key => `${key}.html`;
  const link = ([key,label,icon], mobile=false) =>
    `<a class="${mobile ? "tab" : "navlink"} ${key === page ? "on" : ""}" ${key === page ? 'aria-current="page"' : ""} href="${pageUrl(key)}"><span aria-hidden="true">${icon}</span><span>${label}</span></a>`;

  $("#app").innerHTML = `
    <div class="shell">
      <aside class="rail">
        <a class="rail__brand" href="dashboard.html"><span class="dot"></span> Shyam Rasoi</a>
        <nav aria-label="Main navigation">${links.map(l => link(l)).join("")}</nav>
        <div class="rail__foot"><p class="small muted">${isAdmin ? "Tiffin service workspace" : "Shri Shyam Rasoi · Pure veg tiffins"}</p></div>
      </aside>
      <div>
        <header class="topbar">
          <span class="topbar__t">${e(title)}</span>
          <div class="row">
            <button class="btn btn--quiet" data-theme-toggle aria-label="Toggle color theme">◐</button>
            <span class="avatar" aria-label="${e(auth.user.name)}">${e(auth.user.name.slice(0,2).toUpperCase())}</span>
            <button class="btn btn--quiet" id="logout">Sign out</button>
          </div>
        </header>
        <main id="content" class="page stack" tabindex="-1"></main>
      </div>
      <nav class="tabbar" aria-label="Mobile navigation">${links.map(l => link(l,true)).join("")}</nav>
    </div>
    <div id="toasts" aria-live="polite"></div>`;

  $("#logout").onclick = () => { logout(); location.replace("../index.html"); };
  const views = {dashboard,menu,orders,subscriptions,profile,customers};
  render();

  async function render() {
    const content = $("#content");
    content.innerHTML = `<div class="grid grid--stats">${Array.from({length:4},() => `<div class="card sk sk--card"></div>`).join("")}</div>`;
    content.classList.remove("page-enter");
    void content.offsetWidth;
    content.classList.add("page-enter");
    try {
      await (views[page] || dashboard)();
      if (CONFIG.MOCK_MODE) content.insertAdjacentHTML("afterbegin",
        `<div class="notice">Demo mode — data is stored in this browser. No real payments, OTP messages, or deliveries.</div>`);
    } catch (error) {
      content.innerHTML = `<div class="empty"><p>${e(error.message)}</p><button class="btn btn--primary" id="retry">Try again</button></div>`;
      $("#retry").onclick = render;
    }
  }

  function heading(title, subtitle, action="") {
    return `<div class="page-head"><div class="stack-sm"><h1>${e(title)}</h1><p class="muted">${e(subtitle)}</p></div>${action}</div>`;
  }
  function stat(label,value) {
    return `<div class="card"><p class="small muted">${e(label)}</p><div class="stat__value">${e(value)}</div></div>`;
  }

  async function dashboard() {
    const list = await api.orders();
    const active = list.filter(o => !["delivered","cancelled"].includes(o.status));
    const total = list.filter(o => o.status !== "cancelled").reduce((sum,o) => sum + o.total,0);
    const week = await api.week(), today = week.find(w => w.day === api.today());
    $("#content").innerHTML =
      heading(isAdmin ? "Kitchen overview" : `Hello, ${auth.user.name.split(" ")[0]}`,
        isAdmin ? "Keep today's tiffins moving and customers happy." : "A fresh tiffin, one less thing to worry about.",
        `<a class="btn btn--primary" href="menu.html">${isAdmin ? "Manage menu" : "Order today"}</a>`) +
      (isAdmin ? "" : `<div class="wk-today">
        <div><span class="eyebrow">Today's tiffin · ${e(today.dayName)}</span>
        <h2>${e(today.title)}</h2>
        <p class="muted small">${e(today.items.join(" · "))}</p></div>
        <a class="btn btn--primary" href="menu.html">See this week →</a></div>`) +
      `<div class="grid grid--stats">${stat("Total orders",list.length)}${stat("In progress",active.length)}${stat("Delivered",list.filter(o => o.status==="delivered").length)}${stat(isAdmin ? "Order value · excluding cancelled" : "Order total · excluding cancelled",money(total))}</div>
       <div class="between"><h2>Recent orders</h2><a class="btn btn--quiet" href="orders.html">View all →</a></div>` +
      orderTable(list.slice(0,5),false);
  }

  let meals = [];
  async function menu() {
    meals = await api.menu();
    const week = await api.week();
    const todayNo = api.today();
    const searchBlock = `<div class="row wrap"><div class="field" style="flex:1"><label for="search">Search add-ons</label><input class="input" id="search" type="search" placeholder="Try lassi, gulab jamun or fries"></div>
       ${isAdmin ? `<div class="field"><label for="category">Kitchen</label><select class="select" id="category">${KITCHENS.map(([key,label]) => `<option value="${key}">${label}</option>`).join("")}</select></div>` : ""}</div>`;
    $("#content").innerHTML = heading(isAdmin ? "Menu management" : "This week's tiffin menu",
      isAdmin ? "Update add-ons, prices and availability." : "A fixed 7-day rotation, delivered fresh daily.",
      isAdmin ? `<button class="btn btn--primary" id="add-meal">+ Add dish</button>` : "") +
      (isAdmin ? "" : `<div class="wk-week">
        <div class="between" style="margin-bottom:14px"><h2>Your week at a glance</h2></div>
        <div class="hscroll">${week.map(w => `
          <article class="day-card ${w.day === todayNo ? "day-card--today" : ""}">
            <span class="day-card__badge">${w.day === todayNo ? "● Today" : e(w.dayName)}</span>
            <span class="day-card__emoji" aria-hidden="true">${e(w.emoji)}</span>
            <h3>${e(w.title)}</h3>
            <p class="small muted">${e(w.items.slice(0,2).join(" · "))}…</p>
            <div class="between"><span class="price small" style="font-size:1rem">${money(w.price)}</span>
            <button class="btn btn--primary btn--sm" data-day="${w.day}">Order</button></div>
          </article>`).join("")}</div></div>
        <div class="between" style="margin:22px 0 12px"><h2>Add-ons & extras</h2></div>` + searchBlock) +
      (isAdmin ? searchBlock : "") +
      `<div id="meal-list" class="meal-grid"></div>`;
    const draw = () => {
      const query = $("#search").value.toLowerCase().trim(), brand = isAdmin ? $("#category").value : "all";
      const filtered = meals.filter(m => (isAdmin || m.available) && (brand==="all" || m.brand===brand) &&
        `${m.name} ${m.description} ${brandLabel(m.brand)}`.toLowerCase().includes(query));
      $("#meal-list").innerHTML = filtered.length ? filtered.map(m => `
        <article class="card card--hover stack-sm">
          <div class="meal__art" aria-hidden="true">${e(m.emoji || "🍱")}</div>
          <div class="between"><span class="eyebrow">${e(brandLabel(m.brand))}</span><span class="row" style="gap:8px">${m.tag ? `<span class="pill">${e(m.tag)}</span>` : ""}<button type="button" class="heart-btn" data-favorite="${e(m.id)}" aria-label="Favorite ${e(m.name)}" aria-pressed="false">♡</button></span></div>
          <h2>${e(m.name)}</h2><p class="muted small">${e(m.description)}</p>
          <div class="between"><span class="price">${money(m.price)}</span><button class="btn btn--${isAdmin ? "ghost" : "primary"}" data-meal="${e(m.id)}">${isAdmin ? "Edit" : "Order"}</button></div>
        </article>`).join("") : empty("No add-ons match your search.");
      $$("[data-meal]").forEach(button => button.onclick = () => {
        const meal = meals.find(m => m.id === button.dataset.meal);
        isAdmin ? editMeal(meal) : checkout(meal);
      });
    };
    $$("[data-day]").forEach(button => button.onclick = () => {
      const w = week.find(x => x.day === +button.dataset.day);
      checkout({ id:`week-${w.day}`, dayRef:w.day, name:`${w.title} (${w.dayName})`, description:w.items.join(" · "), price:w.price, brand:"Shri Shyam Rasoi" });
    });
    if (isAdmin) { $("#add-meal").onclick = () => editMeal(); $("#category").onchange = draw; $("#search").oninput = draw; }
    else $("#search").oninput = draw;
    draw();
  }

  function checkout(meal) {
    modal("Place your order", `<form id="checkout" class="stack">
      <div><h3>${e(meal.name)}</h3><p class="muted">${money(meal.price)} · from <b>${e(brandLabel(meal.brand))}</b></p></div>
      <div class="field"><label for="quantity">Quantity</label><input class="input" id="quantity" type="number" min="1" max="20" step="1" value="1" required></div>
      <div class="field"><label for="address">Delivery address</label><textarea class="textarea" id="address" maxlength="500" required placeholder="Flat, street, landmark and PIN code">${e(session().user.address)}</textarea></div>
      <div class="between"><span>Total</span><strong id="order-total">${money(meal.price)}</strong></div>
      <p class="hint">${CONFIG.MOCK_MODE ? "Demo order only. No payment is collected." : "Payment and delivery terms are determined by the service."}</p>
      <button class="btn btn--primary btn--block" type="submit">Confirm order</button>
    </form>`, (dialog,close) => {
      $("#quantity",dialog).oninput = () => {
        const quantity = Number($("#quantity",dialog).value);
        $("#order-total",dialog).textContent = Number.isInteger(quantity) && quantity>=1 && quantity<=20 ? money(quantity*meal.price) : "—";
      };
      $("#checkout",dialog).onsubmit = event => {
        event.preventDefault();
        busy($('[type="submit"]',dialog), async () => {
          const quantity=Number($("#quantity",dialog).value), address=$("#address",dialog).value;
          await api.placeOrder(meal.dayRef ? {day:meal.dayRef,quantity,address} : {menuId:meal.id,quantity,address});
          close(); toast("Order placed.","ok"); confetti(); await render();
        });
      };
    });
  }

  function editMeal(meal={}) {
    const kitchenOptions = KITCHENS.slice(1).map(([key,label]) => `<option value="${key}">${label}</option>`).join("");
    const emojiOptions = ["🍱","🍛","🍗","🧀","🥗","🫘","🔥","🥘","🫓","🍟","🍨","🥤","🍲"];
    modal(meal.id ? "Edit dish" : "Add dish", `<form id="meal-form" class="stack">
      <div class="field"><label for="meal-name">Name</label><input id="meal-name" class="input" maxlength="100" value="${e(meal.name)}" required></div>
      <div class="field"><label for="meal-description">Description</label><textarea id="meal-description" class="textarea" maxlength="500" required>${e(meal.description)}</textarea></div>
      <div class="form-grid"><div class="field"><label for="meal-price">Price (₹)</label><input id="meal-price" class="input" type="number" min="1" step="0.01" value="${e(meal.price)}" required></div>
      <div class="field"><label for="meal-category">Meal time</label><select id="meal-category" class="select"><option>Lunch</option><option>Dinner</option><option>Snack</option><option>Dessert</option><option>Beverage</option></select></div>
      <div class="field"><label for="meal-brand">Cloud kitchen</label><select id="meal-brand" class="select">${kitchenOptions}</select></div>
      <div class="field"><label for="meal-emoji">Artwork</label><select id="meal-emoji" class="select">${emojiOptions.map(x => `<option value="${x}">${x}</option>`).join("")}</select></div></div>
      <div class="field"><label for="meal-tag">Badge (optional)</label><input id="meal-tag" class="input" maxlength="24" placeholder="Bestseller, Chef's pick…" value="${e(meal.tag)}"></div>
      <label class="row"><input id="meal-available" type="checkbox" ${meal.available !== false ? "checked" : ""}>Available to order</label>
      <button type="submit" class="btn btn--primary btn--block">Save dish</button></form>`, (dialog,close) => {
      $("#meal-category",dialog).value = meal.category || "Lunch";
      $("#meal-brand",dialog).value = meal.brand || "thali";
      $("#meal-emoji",dialog).value = meal.emoji || "🍱";
      $("#meal-form",dialog).onsubmit = event => {
        event.preventDefault();
        busy($('[type="submit"]',dialog), async () => {
          await api.saveMeal({...(meal.id ? {id:meal.id}:{}),name:$("#meal-name",dialog).value,description:$("#meal-description",dialog).value,price:Number($("#meal-price",dialog).value),category:$("#meal-category",dialog).value,brand:$("#meal-brand",dialog).value,emoji:$("#meal-emoji",dialog).value,tag:$("#meal-tag",dialog).value.trim(),available:$("#meal-available",dialog).checked});
          close(); toast("Menu updated.","ok"); await render();
        });
      };
    });
  }

  function orderTable(list,actions=true) {
    if (!list.length) return empty("No orders yet.");
    return table(["Order","Meal","Total","Status",...(actions ? ["Action"] : [])], list.map(o => [
      `<div><strong>${e(o.id.slice(-8).toUpperCase())}</strong><div class="small muted">${e(date(o.createdAt))}</div>${isAdmin ? `<div class="small muted">${e(o.customer)}</div>` : ""}</div>`,
      `${e(o.meal)} × ${o.quantity}`, money(o.total), pill(o.status),
      ...(actions ? [`<button class="btn btn--ghost btn--sm" data-order="${e(o.id)}">Details</button>`] : [])
    ]));
  }

  async function orders() {
    const list = await api.orders();
    $("#content").innerHTML = heading("Orders","Hot, sealed and on its way. Track every step live.",
      `<button class="btn btn--ghost" id="refresh">Refresh</button>`) +
      `<div class="field"><label for="order-filter">Filter by status</label><select class="select" id="order-filter" style="max-width:300px">
      <option value="all">All orders</option>${["confirmed","preparing","out_for_delivery","delivered","cancelled"].map(s => `<option value="${s}">${e(s.replaceAll("_"," "))}</option>`).join("")}</select></div><div id="orders-list"></div>`;
    $("#refresh").onclick = render;
    const draw = () => {
      const filter = $("#order-filter").value;
      $("#orders-list").innerHTML = orderTable(list.filter(o => filter==="all" || o.status===filter));
      $$("[data-order]").forEach(button => button.onclick = () => orderDetails(list.find(o => o.id===button.dataset.order)));
    };
    $("#order-filter").onchange = draw; draw();
  }

  function orderDetails(order) {
    const stages=["confirmed","preparing","out_for_delivery","delivered"];
    const index=stages.indexOf(order.status);
    const next=index>=0 && index<3 ? stages[index+1] : null;
    modal("Order details", `<div class="stack">
      <div class="between"><h3>${e(order.meal)}</h3>${pill(order.status)}</div>
      <p>${order.quantity} meal(s) · ${money(order.total)}</p><p class="small muted">${e(order.address)}</p>
      ${order.status==="cancelled" ? "<p>This order was cancelled.</p>" : `<ol class="tl">${stages.map((stage,i) => `<li class="${i<=index ? "done":""} ${i===index && index<3 ? "now":""}"><span class="tl__dot" aria-hidden="true"></span><span>${e(stage.replaceAll("_"," "))}${i===index ? " · current":""}</span></li>`).join("")}</ol>`}
      ${isAdmin && next ? `<button class="btn btn--primary btn--block" data-status="${next}">Mark ${e(next.replaceAll("_"," "))}</button>` : ""}
      ${order.status==="confirmed" ? '<button class="btn btn--danger btn--block" data-status="cancelled">Cancel order</button>' : ""}
    </div>`, (dialog,close) => {
      $$("[data-status]",dialog).forEach(button => button.onclick = () => {
        if (button.dataset.status==="cancelled" && !confirm("Cancel this order?")) return;
        busy(button,async()=>{ await api.updateOrder(order.id,button.dataset.status); close(); toast("Order updated.","ok"); await render(); });
      });
    });
  }

  async function subscriptions() {
    const list=await api.subscriptions(), active=list.find(s=>s.status==="active");
    const plans=[["weekly","Weekly comfort",490,"7 tiffins · one per day"],["monthly","Monthly routine",2100,"30 tiffins · one per day"]];
    $("#content").innerHTML=heading("Plans that keep you sorted","Pure veg tiffins on repeat — weekly or monthly, skip any day.") +
      (active ? `<div class="card between"><div><h2>${e(active.plan)} plan</h2><p class="muted">${money(active.price)} · Started ${e(date(active.createdAt))}</p></div>${pill(active.status)}</div>` : "") +
      `<div class="meal-grid">${plans.map(([key,title,price,description]) => `<article class="card stack-sm"><span class="eyebrow">${e(key)} plan</span><h2>${e(title)}</h2><div class="price">${money(price)}</div><p class="muted">${e(description)}</p><p class="small">₹70 per tiffin · Full 7-day pure veg menu. Plan price is for the full term.</p><button class="btn btn--primary btn--block" data-plan="${key}" ${active ? "disabled":""}>${active ? "Plan already active" : CONFIG.MOCK_MODE ? "Activate demo plan" : "Choose plan"}</button></article>`).join("")}</div>
      <p class="hint">This prototype records plan selection only. Recurring meal scheduling, renewals, and payment processing are not implemented.</p>`;
    $$("[data-plan]").forEach(button => button.onclick=()=>busy(button,async()=>{await api.subscribe(button.dataset.plan);toast("Plan activated.","ok");await render();}));
  }

  async function profile() {
    const user=await api.profile();
    $("#content").innerHTML=heading("Your profile","Keep your delivery details up to date.") +
      `<form id="profile-form" class="card stack" style="max-width:640px"><div class="field"><label for="profile-name">Full name</label><input class="input" id="profile-name" autocomplete="name" maxlength="100" value="${e(user.name)}" required></div>
      <div class="field"><label for="profile-phone">Mobile number</label><input class="input" id="profile-phone" value="${e(user.phone)}" readonly></div>
      <div class="field"><label for="profile-address">Default delivery address</label><textarea class="textarea" id="profile-address" autocomplete="street-address" maxlength="500">${e(user.address)}</textarea></div>
      <button class="btn btn--primary" type="submit">Save changes</button></form>`;
    $("#profile-form").onsubmit=event=>{event.preventDefault();busy($('[type="submit"]',event.currentTarget),async()=>{const updated=await api.saveProfile({name:$("#profile-name").value,address:$("#profile-address").value});auth.user=updated;setSession({...session(),user:updated});$(".avatar").textContent=updated.name.slice(0,2).toUpperCase();$(".avatar").setAttribute("aria-label",updated.name);toast("Profile saved.","ok");});};
  }

  async function customers() {
    const users=await api.customers();
    $("#content").innerHTML=heading("Customers","People enjoying your homestyle meals.") +
      `<div class="field"><label for="customer-search">Search customers</label><input class="input" type="search" id="customer-search" placeholder="Name or phone number"></div><div id="customer-list"></div>`;
    const draw=()=>{const query=$("#customer-search").value.toLowerCase().trim();const filtered=users.filter(u=>`${u.name} ${u.phone}`.toLowerCase().includes(query));$("#customer-list").innerHTML=filtered.length?table(["Name","Phone","Address"],filtered.map(u=>[e(u.name),e(u.phone),e(u.address||"Not added")])):empty("No matching customers.");};
    $("#customer-search").oninput=draw; draw();
  }
}
