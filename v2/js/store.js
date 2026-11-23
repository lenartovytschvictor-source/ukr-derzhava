// Дані сайту в пам'яті + хто зараз увійшов і що йому дозволено.
// Справжній захист — у правилах Firebase (firestore.rules); тут лише показуємо кнопки тим, кому можна.
export const OWNERS = ["lenartovytsch.victor@gmail.com"];   // адміністрація проєкту, як і на старому сайті
export const DEMO = new URLSearchParams(location.search).has("demo");

export let B;   // бекенд
export const S = {
  ready: false, user: null,
  players: [], positions: [], links: [], apps: [],
  admins: [], lands: null, texts: {}, history: null, site: {},
  bills: [], elections: [], states: [], treaties: [], chamber: {}, places: [],
  myLink: null, myApp: null, err: "",
};
let renderCb = () => {};
let raf = 0;
export function onChange(cb) { renderCb = cb; }
export function changed() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; renderCb(); }); }

const unsub = [];
function stopUserWatches() { while (unsub.length) { try { unsub.pop()(); } catch (_) {} } }

export async function initStore() {
  B = DEMO ? await import("./backend-demo.js") : await import("./backend-fb.js");
  await B.init();
  // загальнодоступні дані
  B.watch("ud_players", r => { S.players = r; changed(); }, e => fail(e));
  B.watch("ud_positions", r => { S.positions = r.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)); changed(); }, e => fail(e));
  B.watch("ud_texts", r => { S.texts = Object.fromEntries(r.map(x => [x.id, x])); changed(); }, e => fail(e));
  B.watchDoc("ud_config", "lands", d => { S.lands = d && Array.isArray(d.list) ? d.list : null; changed(); });
  B.watchDoc("ud_config", "site", d => { S.site = d || {}; changed(); });
  B.watchDoc("ud_history", "main", d => { S.history = d; changed(); });
  B.watch("ud_bills", r => { S.bills = r; changed(); }, e => fail(e));
  B.watch("ud_elections", r => { S.elections = r; changed(); }, e => fail(e));
  B.watch("ud_states", r => { S.states = r; changed(); }, e => fail(e));
  B.watch("ud_treaties", r => { S.treaties = r; changed(); }, e => fail(e));
  B.watchDoc("ud_config", "chamber", d => { S.chamber = d || {}; changed(); });
  B.watch("ud_places", r => { S.places = r.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "uk")); changed(); }, e => fail(e));
  B.onAuth(u => { S.user = u; S.ready = true; userWatches(); changed(); });
}
function fail(e) { console.warn(e); S.err = String(e && e.message || e); changed(); }

// дані, які залежать від того, хто увійшов
function userWatches() {
  stopUserWatches();
  S.myLink = null; S.myApp = null; S.links = []; S.apps = []; S.admins = [];
  const u = S.user;
  if (!u) return;
  unsub.push(B.watchDoc("ud_links", u.email, d => { S.myLink = d; changed(); }, () => {}));
  unsub.push(B.watchDoc("ud_apps", u.email, d => { S.myApp = d; changed(); }, () => {}));
  unsub.push(B.watchDoc("ud_config", "admins", d => { S.admins = (d && d.emails) || []; changed(); }, () => { S.admins = []; }));
  // реєстр пошт і заявки бачать лише ті, хто веде реєстр (правила не віддадуть іншим)
  unsub.push(B.watch("ud_links", r => { S.links = r; changed(); }, () => { S.links = []; }));
  unsub.push(B.watch("ud_apps", r => { S.apps = r; changed(); }, () => { S.apps = []; }));
}

// ---------- хто є хто ----------
export const player = id => S.players.find(p => p.id === id) || null;
export const me = () => (S.myLink && player(S.myLink.pid)) || null;
export const pos = id => S.positions.find(p => p.id === id) || null;
export const holds = id => { const m = me(), p = pos(id); return !!(m && p && p.holder === m.id); };
export const isOwner = () => !!(S.user && OWNERS.includes(S.user.email));
export const isAdmin = () => isOwner() || !!(S.user && S.admins.includes(S.user.email));
export const isHetman = () => holds("hetman");
export const isCitizen = () => { const m = me(); return !!(m && m.status === "cit"); };
export const canPlayers = () => isAdmin() || isHetman() || holds("interior");
export const canAppoint = p => isAdmin() || (isHetman() && p && p.appointBy === "hetman")
  || (!!p && p.appointBy === "osavul" && !!p.land && holds("osavul_" + p.land));   // Осавул призначає джур і війтів своєї землі
// Крайовий Осавул землі — посада osavul_<land>; уділи й міста землі ведуть адмін, Писар і Осавул цієї землі
export const isOsavul = landId => holds("osavul_" + landId);
export const canPlaces = landId => isAdmin() || holds("pysar") || isOsavul(landId);
export const canLands = () => isAdmin() || holds("pysar");
export const canTexts = () => isAdmin();
export const canHistory = () => isAdmin();
export const canDiplo = () => isAdmin() || isHetman() || holds("foreign");
export const isChair = () => holds("chair");
export const canChamber = () => isAdmin() || isChair();          // керує порядком роботи Палати й виборами
export const canEditAnything = () => isAdmin() || canPlayers() || isHetman() || canLands() || canDiplo() || isChair() || lands().some(l => isOsavul(l.id));
// Палата Земель: місця — це посади з полем chamber (chair / zemska / sotenna)
export const seats = () => S.positions.filter(p => p.chamber);
export const mySeat = () => { const m = me(); return m ? seats().find(p => p.holder === m.id) || null : null; };
export const CH = () => ({ hours: 24, quorum: 50, petition: 5, nomHours: 48, voteHours: 48, ...S.chamber });
export const positionsOf = pid => S.positions.filter(p => p.holder && p.holder === pid);
export const emailOf = pid => { const l = S.links.find(x => x.pid === pid); return l ? l.id : ""; };

// землі: з бази, а поки їх не збережено — з плану (data/lands-default.json)
let LANDS_DEFAULT = [];
export async function loadDefaults() {
  try { LANDS_DEFAULT = await (await fetch("data/lands-default.json")).json(); } catch (_) {}
}
export const lands = () => S.lands || LANDS_DEFAULT;
export const landsFromPlan = () => LANDS_DEFAULT;
export const land = id => lands().find(l => l.id === id) || null;

// час: Firestore Timestamp / Date / число / рядок → мілісекунди
export const ms = v => !v ? 0 : v.toMillis ? v.toMillis() : v.seconds ? v.seconds * 1000 : typeof v === "number" ? v : Date.parse(v) || 0;

// ---------- журнал дій ----------
export async function log(act, text) {
  if (!S.user) return;
  try { await B.add("ud_log", { act, text: String(text).slice(0, 500), by: S.user.email, at: B.now() }); } catch (e) { console.warn("log", e); }
}
