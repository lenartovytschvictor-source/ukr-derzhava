// 💬 Чат: загальний · чат землі · чат уряду · особисті (етап 6)
import { t } from "../i18n.js";
import { esc } from "../ui.js";
import { soon } from "./common.js";

export function render() {
  return `<h1 class="ptitle">💬 ${esc(t("nav.chat"))}</h1>${soon(6, t("soon.chat"))}`;
}
