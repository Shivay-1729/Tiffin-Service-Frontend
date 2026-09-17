import { CONFIG } from "./config.js";

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const initial = () => ({
  users: [
    { id:"u1", username:"customer", password:"customer123", phone:"9876543210", name:"Aarav", role:"CUSTOMER", address:"" },
    { id:"a1", username:"admin", password:"admin123", phone:"9000000000", name:"Kitchen Admin", role:"ADMIN", address:"" }
  ],
  menu: [
    { id:"m1", name:"Extra Rotis (4 pc)", description:"Freshly roasted whole-wheat rotis on the side.", price:20, category:"Lunch", brand:"thali", emoji:"🫓", tag:"", available:true },
    { id:"m2", name:"Steamed Rice", description:"A generous portion of plain steamed rice.", price:30, category:"Lunch", brand:"thali", emoji:"🍚", tag:"", available:true },
    { id:"m3", name:"Curd Bowl", description:"Fresh set curd in a sealed bowl.", price:25, category:"Lunch", brand:"thali", emoji:"🥣", tag:"", available:true },
    { id:"m4", name:"Pickle & Papad", description:"Homemade mango pickle with crispy papad.", price:15, category:"Snack", brand:"thali", emoji:"🥒", tag:"", available:true },
    { id:"m5", name:"Gulab Jamun Duo", description:"Two warm gulab jamuns, straight from the kadhai.", price:40, category:"Dessert", brand:"thali", emoji:"🍨", tag:"Sweet fix", available:true },
    { id:"m6", name:"Mango Lassi", description:"Thick and creamy mango lassi, served chilled.", price:45, category:"Beverage", brand:"thali", emoji:"🥤", tag:"Refresher", available:true },
    { id:"m7", name:"Paneer Pakora (4 pc)", description:"Crispy paneer pakoras with mint chutney.", price:60, category:"Snack", brand:"thali", emoji:"🧀", tag:"Chef's pick", available:true },
    { id:"m8", name:"Buttermilk (Chaas)", description:"Spiced, salted buttermilk — the perfect finish.", price:20, category:"Beverage", brand:"thali", emoji:"🥛", tag:"", available:true }
  ],
  week: [
    { day:1, dayName:"Monday", title:"Aloo Gobi Special", items:["Aloo gobi","Dal tadka","4 rotis","Jeera rice","Salad"], price:70, emoji:"🍛" },
    { day:2, dayName:"Tuesday", title:"Rajma", items:["Rajma","4 rotis","Steamed rice","Salad"], price:70, emoji:"🫘" },
    { day:3, dayName:"Wednesday", title:"Mix Veg", items:["Mix veg","Dal fry","4 rotis","Jeera rice","Salad"], price:70, emoji:"🥗" },
    { day:4, dayName:"Thursday", title:"Bhindi Masala", items:["Bhindi masala","4 rotis","Steamed rice","Salad"], price:70, emoji:"🍲" },
    { day:5, dayName:"Friday", title:"Aloo Matar Pulao", items:["Aloo matar","Dal tadka","4 rotis","Veg pulao","Salad"], price:70, emoji:"🥔" },
    { day:6, dayName:"Saturday", title:"Palak Paneer", items:["Palak paneer","4 rotis","Jeera rice","Salad"], price:70, emoji:"🧀" },
    { day:7, dayName:"Sunday", title:"Kadhi Pakoda", items:["Kadhi pakoda","4 rotis","Salad"], price:70, emoji:"🍱" }
  ],
  orders: [],
  subscriptions: []
});

const save = () => localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(db));
let db = read(CONFIG.STORAGE_KEY, null) || initial();
// Migrate demo data created by older builds (including the previous phone/OTP version).
if (!Array.isArray(db.users)) db.users = initial().users;
db.users = db.users.map((u, i) => ({
  ...u,
  username: String(u.username || (u.role === "ADMIN" ? "admin" : i === 0 ? "customer" : `customer${i + 1}`)).trim(),
  password: String(u.password || (u.role === "ADMIN" ? "admin123" : "customer123")),
  name: String(u.name || (u.role === "ADMIN" ? "Kitchen Admin" : "Customer")),
  role: u.role || "CUSTOMER",
  address: String(u.address || "")
}));
if (!Array.isArray(db.menu)) db.menu = initial().menu;
if (!Array.isArray(db.week)) db.week = initial().week;
if (!Array.isArray(db.orders)) db.orders = [];
if (!Array.isArray(db.subscriptions)) db.subscriptions = [];
save();
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const uString = value => String(value ?? "");
export const session = () => read(CONFIG.SESSION_KEY, null);
export const setSession = value => localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(value));
export const logout = () => localStorage.removeItem(CONFIG.SESSION_KEY);

async function request(path, { method="GET", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  try {
    const token = session()?.token;
    const response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      method, signal:controller.signal,
      headers:{
        Accept:"application/json",
        ...(body !== undefined ? {"Content-Type":"application/json"} : {}),
        ...(token ? {Authorization:`Bearer ${token}`} : {})
      },
      ...(body !== undefined ? {body:JSON.stringify(body)} : {})
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = {message:text}; }
    if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`);
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Request timed out. Please retry.");
    throw error;
  } finally { clearTimeout(timer); }
}
const delay = () => new Promise(resolve => setTimeout(resolve, 250));
const currentUser = () => {
  const user = db.users.find(u => u.id === session()?.user?.id);
  if (!user) throw new Error("Please sign in again.");
  return user;
};
const admin = () => {
  if (currentUser().role !== "ADMIN") throw new Error("Administrator access required.");
};
const remote = (path, method, body) => request(path, {method, body});
let challengePhone = "";

export const api = {
  async login(username, password) {
    if (!CONFIG.MOCK_MODE) return remote("/auth/login","POST",{username,password});
    await delay();
    const normalized = String(username || "").trim().toLowerCase();
    if (!normalized || !password) throw new Error("Username and password are required.");
    const user = db.users.find(u => String(u.username || "").trim().toLowerCase() === normalized);
    if (!user || uString(user.password) !== uString(password)) {
      throw new Error("Invalid username or password.");
    }
    return {token:`demo-${user.id}`,user:{...user, password:undefined}};
  },
  async requestOtp(phone) {
    if (!CONFIG.MOCK_MODE) return remote("/auth/otp/request","POST",{phone});
    await delay();
    if (!/^[6-9]\d{9}$/.test(phone)) throw new Error("Enter a valid 10-digit Indian mobile number.");
    return {message:"OTP endpoint placeholder ready for later integration."};
  },
  async verifyOtp(phone, otp) {
    if (!CONFIG.MOCK_MODE) return remote("/auth/otp/verify","POST",{phone,otp});
    throw new Error("OTP login is intentionally disabled in this version.");
  },
  async menu() {
    if (!CONFIG.MOCK_MODE) return remote("/menu");
    await delay(); return structuredClone(db.menu);
  },
  async week() {
    if (!CONFIG.MOCK_MODE) return remote("/menu/week");
    await delay(); return structuredClone(db.week);
  },
  today() {
    return (new Date().getDay() + 6) % 7 + 1;
  },
  async orders() {
    if (!CONFIG.MOCK_MODE) return remote("/orders");
    await delay();
    const user = currentUser();
    return structuredClone(db.orders.filter(o => user.role === "ADMIN" || o.userId === user.id));
  },
  async placeOrder(payload) {
    if (!CONFIG.MOCK_MODE) return remote("/orders","POST",payload);
    await delay();
    const user = currentUser();
    let meal = null, name = "", price = 0;
    if (payload.day) {
      const w = db.week.find(x => x.day === payload.day);
      if (!w) throw new Error("That day's tiffin isn't on the menu.");
      meal = { id:`week-${w.day}`, name:`${w.title} (${w.dayName})` };
      name = meal.name; price = w.price;
    } else {
      meal = db.menu.find(m => m.id === payload.menuId && m.available);
      if (!meal) throw new Error("This dish is unavailable.");
      name = meal.name; price = meal.price;
    }
    if (!Number.isInteger(payload.quantity) || payload.quantity < 1 || payload.quantity > 20) throw new Error("Quantity must be between 1 and 20.");
    if (!payload.address?.trim()) throw new Error("A delivery address is required.");
    const order = {
      id:id("ord"), userId:user.id, customer:user.name, meal:name,
      quantity:payload.quantity, total:price * payload.quantity,
      address:payload.address.trim(), status:"confirmed", createdAt:new Date().toISOString()
    };
    db.orders.unshift(order); save(); return structuredClone(order);
  },
  async updateOrder(orderId,status) {
    if (!CONFIG.MOCK_MODE) return remote(`/orders/${encodeURIComponent(orderId)}/status`,"PATCH",{status});
    await delay();
    const user = currentUser();
    const order = db.orders.find(o => o.id === orderId);
    if (!order || (user.role !== "ADMIN" && order.userId !== user.id)) throw new Error("Order not found.");
    const transitions = {confirmed:["preparing","cancelled"],preparing:["out_for_delivery"],out_for_delivery:["delivered"],delivered:[],cancelled:[]};
    if (user.role !== "ADMIN" && !(order.status === "confirmed" && status === "cancelled")) throw new Error("This action is not allowed.");
    if (!transitions[order.status]?.includes(status)) throw new Error("Invalid status transition.");
    order.status = status; save(); return structuredClone(order);
  },
  async profile() {
    if (!CONFIG.MOCK_MODE) return remote("/users/me");
    await delay();
    const {password, ...safeUser} = currentUser();
    return {...safeUser};
  },
  async saveProfile(payload) {
    if (!CONFIG.MOCK_MODE) return remote("/users/me","PUT",payload);
    await delay();
    const user = currentUser();
    if (!payload.name?.trim()) throw new Error("Please enter your name.");
    Object.assign(user,{name:payload.name.trim(),address:(payload.address || "").trim()});
    save(); return {...user};
  },
  async subscriptions() {
    if (!CONFIG.MOCK_MODE) return remote("/subscriptions");
    await delay();
    const user = currentUser();
    return structuredClone(db.subscriptions.filter(s => s.userId === user.id));
  },
  async subscribe(plan) {
    if (!CONFIG.MOCK_MODE) return remote("/subscriptions","POST",{plan});
    await delay();
    const user = currentUser();
    if (!["weekly","monthly"].includes(plan)) throw new Error("Invalid plan.");
    if (db.subscriptions.some(s => s.userId === user.id && s.status === "active")) throw new Error("You already have an active plan.");
    const item = {id:id("sub"),userId:user.id,plan,status:"active",price:plan === "weekly" ? 490 : 2100,createdAt:new Date().toISOString()};
    db.subscriptions.push(item); save(); return structuredClone(item);
  },
  async customers() {
    if (!CONFIG.MOCK_MODE) return remote("/admin/customers");
    await delay(); admin(); return structuredClone(db.users.filter(u => u.role === "CUSTOMER"));
  },
  async saveMeal(payload) {
    if (!CONFIG.MOCK_MODE) return remote(payload.id ? `/admin/menu/${encodeURIComponent(payload.id)}` : "/admin/menu",payload.id ? "PUT" : "POST",payload);
    await delay(); admin();
    if (!payload.name?.trim() || !Number.isFinite(payload.price) || payload.price <= 0) throw new Error("Enter a meal name and a positive price.");
    const meal = {name:payload.name.trim(),description:(payload.description || "").trim(),
      price:payload.price,category:payload.category,available:!!payload.available,
      brand:payload.brand || (payload.id ? undefined : "thali"),
      emoji:payload.emoji || (payload.id ? undefined : "🍱"),
      tag:payload.tag || (payload.id ? undefined : "")};
    if (payload.id) {
      const existing = db.menu.find(m => m.id === payload.id);
      if (!existing) throw new Error("Meal not found.");
      const brand = meal.brand; delete meal.brand;
      const emoji = meal.emoji; delete meal.emoji;
      const tag = meal.tag; delete meal.tag;
      Object.assign(existing,meal);
      if (brand !== undefined) existing.brand = brand;
      if (emoji !== undefined) existing.emoji = emoji;
      if (tag !== undefined) existing.tag = tag;
    } else db.menu.push({id:id("m"),...meal});
    save(); return {message:"Meal saved."};
  }
};
