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
    { id:"m1", name:"Homestyle Veg Thali", description:"Dal, seasonal sabzi, rice, 4 rotis and salad.", price:120, category:"Lunch", available:true },
    { id:"m2", name:"Paneer Special", description:"Paneer curry, jeera rice, 4 rotis and pickle.", price:160, category:"Dinner", available:true },
    { id:"m3", name:"Light & Fresh", description:"Moong dal khichdi, curd and fresh salad.", price:100, category:"Lunch", available:true }
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
    const meal = db.menu.find(m => m.id === payload.menuId && m.available);
    if (!meal) throw new Error("This meal is unavailable.");
    if (!Number.isInteger(payload.quantity) || payload.quantity < 1 || payload.quantity > 20) throw new Error("Quantity must be between 1 and 20.");
    if (!payload.address?.trim()) throw new Error("A delivery address is required.");
    const order = {
      id:id("ord"), userId:user.id, customer:user.name, meal:meal.name,
      quantity:payload.quantity, total:meal.price * payload.quantity,
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
    const item = {id:id("sub"),userId:user.id,plan,status:"active",price:plan === "weekly" ? 770 : 3000,createdAt:new Date().toISOString()};
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
    const meal = {name:payload.name.trim(),description:(payload.description || "").trim(),price:payload.price,category:payload.category,available:!!payload.available};
    if (payload.id) {
      const existing = db.menu.find(m => m.id === payload.id);
      if (!existing) throw new Error("Meal not found.");
      Object.assign(existing,meal);
    } else db.menu.push({id:id("m"),...meal});
    save(); return {message:"Meal saved."};
  }
};
