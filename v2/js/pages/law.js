// ⚖️ Закон: Конституція · Кодекси · Закони й укази · Суд (етап 4)
import { t } from "../i18n.js";
import { esc } from "../ui.js";
import { tabs, soon } from "./common.js";

const TABS = [["konstytutsiya", "📜", "law.tab.const"], ["kodeksy", "📚", "law.tab.codes"], ["zakony", "🧾", "law.tab.laws"], ["sud", "⚖️", "law.tab.court"]];
const WHAT = { konstytutsiya: "soon.const", kodeksy: "soon.codes", zakony: "soon.laws", sud: "soon.court" };

export function render(parts) {
  const cur = TABS.some(x => x[0] === parts[0]) ? parts[0] : "konstytutsiya";
  return `<h1 class="ptitle">⚖️ ${esc(t("nav.law"))}</h1>${tabs("zakon", TABS, cur)}${soon(4, t(WHAT[cur]))}`;
}
