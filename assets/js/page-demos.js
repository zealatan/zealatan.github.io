import { profile, nav, demos, footerText } from "./data.js";
import { renderNav, renderFooter, renderDemos } from "./render.js";

renderNav(document.getElementById("nav"), { siteTitle: profile.name, items: nav });
renderDemos(document.getElementById("demos"), demos);
renderFooter(document.getElementById("footer"), footerText);
