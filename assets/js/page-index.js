import {
  profile,
  nav,
  sections,
  experience,
  skills,
  education,
  educationNote,
  publications,
  footerText,
} from "./data.js";
import {
  renderNav,
  renderFooter,
  renderHero,
  renderSections,
  renderExperience,
  renderSkillGrid,
  renderEducationAndPublications,
} from "./render.js";

renderNav(document.getElementById("nav"), { siteTitle: profile.name, items: nav });
renderHero(document.getElementById("hero-text"), profile);
renderSections(document.getElementById("projects"), sections);
renderExperience(document.getElementById("experience"), experience);
renderSkillGrid(document.getElementById("skills"), skills);
renderEducationAndPublications(document.getElementById("education"), {
  education,
  educationNote,
  publications,
});
renderFooter(document.getElementById("footer"), footerText);
