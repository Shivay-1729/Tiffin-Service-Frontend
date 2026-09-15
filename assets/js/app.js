import { api, session, logout, setSession } from "./api.js";
import { CONFIG } from "./config.js";
import { $, $$, escapeHTML as e, money, date, pill, toast, busy, modal, empty, table } from "./ui.js";

const auth = session();
const isAdmin = location.pathname.includes("/admin/");
const base = isAdmin ? "../" : "../";

if (!auth?.user) location.replace("../login.html");
else if (isAdmin && auth.user.role !== "ADMIN") location.replace("../app/dashboard.html");
else initialize();

function initialize() {
  const page = document.body.dataset.page;
  const root = isAdmin ? "" : "";
  const links = isAdmin
    ? [["dashboard","Overview","◫"],["menu","Menu","☷"],["orders","Orders","▣"],["customers","Customers","♙"]]
    : [["dashboard","Home","⌂"],["menu","Menu","☷"],["orders","Orders","▣"],["subscriptions","Plans","◇"],["profile","Profile","○"]];
  const title = links.find(([key]) => key === page)?.[1] || "Tiffin";
  const pageUrl = key => `${key}.html`;
  const link = ([key,label,icon], mobile=false) =>
    `<a class="${mobile ? "tab" : "navlink"} ${key === page ? "on" : ""}" ${key === page ? 'aria-current="page"' : ""} href="${pageUrl(key)}"><span aria-hidden="true">${icon}</span><span>${label}</span></a>`;

  $("#app").innerHTML = `
    <div class="shell">
      <aside class="rail">
        <a class="rail__brand" href="dashboard.html"><span class="dot"></span> Daily Tiffin</a>
        <nav aria-label="Main navigation">${links.map(l => link(l)).join("")}</nav>
        <div class="rail__foot"><p class="small muted">${isAdmin ? "Kitchen workspace" : "Made fresh. Delivered daily."}</p></div>
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

  $("#logout").onclick = () => { logout(); location.replace("../login.html"); };
  const views = {dashboard,menu,orders,subscriptions,profile,customers};
  render();

  async function render() {
    $("#content").innerHTML = `<div class="grid grid--stats">${Array.from({length:4},() => `<div class="card sk sk--card"></div>`).join("")}</div>`;
    try {
      await (views[page] || dashboard)();
      if (CONFIG.MOCK_MODE) $("#content").insertAdjacentHTML("afterbegin",
        `<div class="notice">Demo mode — data is stored in this browser. No real payments, OTP messages, or deliveries.</div>`);
    } catch (error) {
      $("#content").innerHTML = `<div class="empty"><p>${e(error.message)}</p><button class="btn btn--primary" id="retry">Try again</button></div>`;
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
    $("#content").innerHTML =
      heading(isAdmin ? "Kitchen overview" : `Hello, ${auth.user.name.split(" ")[0]}`,
        isAdmin ? "Keep meals moving and customers happy." : "A fresh meal. One less thing to worry about.",
        `<a class="btn btn--primary" href="menu.html">${isAdmin ? "Manage menu" : "Explore menu"}</a>`) +
      `<div class="grid grid--stats">${stat("Total orders",list.length)}${stat("In progress",active.length)}${stat("Delivered",list.filter(o => o.status==="delivered").length)}${stat(isAdmin ? "Order value · excluding cancelled" : "Order total · excluding cancelled",money(total))}</div>
       <div class="between"><h2>Recent orders</h2><a class="btn btn--quiet" href="orders.html">View all →</a></div>` +
      orderTable(list.slice(0,5),false);
  }

  let meals = [];
  async function menu() {
    meals = await api.menu();
    $("#content").innerHTML = heading(isAdmin ? "Menu management" : "Fresh from our kitchen",
      isAdmin ? "Update meals, prices and availability." : "Simple ingredients. Comforting flavors.",
      isAdmin ? `<button class="btn btn--primary" id="add-meal">+ Add meal</button>` : "") +
      `<div class="row wrap"><div class="field" style="flex:1"><label for="search">Search meals</label><input class="input" id="search" type="search" placeholder="Try paneer or dal"></div>
       <div class="field"><label for="category">Meal time</label><select class="select" id="category"><option>All</option><option>Lunch</option><option>Dinner</option></select></div></div>
       <div id="meal-list" class="meal-grid"></div>`;
    const draw = () => {
      const query = $("#search").value.toLowerCase().trim(), category = $("#category").value;
      const filtered = meals.filter(m => (isAdmin || m.available) && (category==="All" || m.category===category) &&
        `${m.name} ${m.description}`.toLowerCase().includes(query));
      $("#meal-list").innerHTML = filtered.length ? filtered.map(m => `
        <article class="card card--hover stack-sm">
          <div class="meal__art" aria-hidden="true">🍱</div>
          <div class="between"><span class="eyebrow">${e(m.category)}</span><button type="button" class="heart-btn" data-favorite="${e(m.id)}" aria-label="Favorite ${e(m.name)}" aria-pressed="false">♡</button></div>
          <h2>${e(m.name)}</h2><p class="muted small">${e(m.description)}</p>
          <div class="between"><span class="price">${money(m.price)}</span><button class="btn btn--${isAdmin ? "ghost" : "primary"}" data-meal="${e(m.id)}">${isAdmin ? "Edit" : "Order"}</button></div>
        </article>`).join("") : empty("No meals match your search.");
      $$("[data-meal]").forEach(button => button.onclick = () => {
        const meal = meals.find(m => m.id === button.dataset.meal);
        isAdmin ? editMeal(meal) : checkout(meal);
      });
    };
    $("#search").oninput = draw; $("#category").onchange = draw;
    if (isAdmin) $("#add-meal").onclick = () => editMeal();
    draw();
  }

  function checkout(meal) {
    modal("Place your order", `<form id="checkout" class="stack">
      <div><h3>${e(meal.name)}</h3><p class="muted">${money(meal.price)} per meal</p></div>
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
          await api.placeOrder({menuId:meal.id,quantity:Number($("#quantity",dialog).value),address:$("#address",dialog).value});
          close(); toast("Order placed.","ok"); await render();
        });
      };
    });
  }

  function editMeal(meal={}) {
    modal(meal.id ? "Edit meal" : "Add meal", `<form id="meal-form" class="stack">
      <div class="field"><label for="meal-name">Name</label><input id="meal-name" class="input" maxlength="100" value="${e(meal.name)}" required></div>
      <div class="field"><label for="meal-description">Description</label><textarea id="meal-description" class="textarea" maxlength="500" required>${e(meal.description)}</textarea></div>
      <div class="form-grid"><div class="field"><label for="meal-price">Price (₹)</label><input id="meal-price" class="input" type="number" min="1" step="0.01" value="${e(meal.price)}" required></div>
      <div class="field"><label for="meal-category">Meal time</label><select id="meal-category" class="select"><option>Lunch</option><option>Dinner</option></select></div></div>
      <label class="row"><input id="meal-available" type="checkbox" ${meal.available !== false ? "checked" : ""}>Available to order</label>
      <button type="submit" class="btn btn--primary btn--block">Save meal</button></form>`, (dialog,close) => {
      $("#meal-category",dialog).value = meal.category || "Lunch";
      $("#meal-form",dialog).onsubmit = event => {
        event.preventDefault();
        busy($('[type="submit"]',dialog), async () => {
          await api.saveMeal({...(meal.id ? {id:meal.id}:{}),name:$("#meal-name",dialog).value,description:$("#meal-description",dialog).value,price:Number($("#meal-price",dialog).value),category:$("#meal-category",dialog).value,available:$("#meal-available",dialog).checked});
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
    $("#content").innerHTML = heading("Orders","Track your meals from kitchen to doorstep.",
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
    const plans=[["weekly","Weekly comfort",770,"7 meals · one meal per day"],["monthly","Monthly routine",3000,"30 meals · one meal per day"]];
    $("#content").innerHTML=heading("Your daily routine, simplified","Choose a plan for regular homestyle meals.") +
      (active ? `<div class="card between"><div><h2>${e(active.plan)} plan</h2><p class="muted">${money(active.price)} · Started ${e(date(active.createdAt))}</p></div>${pill(active.status)}</div>` : "") +
      `<div class="meal-grid">${plans.map(([key,title,price,description]) => `<article class="card stack-sm"><span class="eyebrow">${e(key)} plan</span><h2>${e(title)}</h2><div class="price">${money(price)}</div><p class="muted">${e(description)}</p><p class="small">Standard vegetarian thali. Plan price is for the full term.</p><button class="btn btn--primary btn--block" data-plan="${key}" ${active ? "disabled":""}>${active ? "Plan already active" : CONFIG.MOCK_MODE ? "Activate demo plan" : "Choose plan"}</button></article>`).join("")}</div>
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
