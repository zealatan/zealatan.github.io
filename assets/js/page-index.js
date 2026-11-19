import {
  profile,
  nav,
  isacFeature,
  projects,
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
  renderIsacFeature,
  renderProjects,
  renderExperience,
  renderSkillGrid,
  renderEducationAndPublications,
} from "./render.js";

renderNav(document.getElementById("nav"), { siteTitle: profile.name, items: nav });
renderHero(document.getElementById("hero-text"), profile);
renderIsacFeature(document.getElementById("isac"), isacFeature);
renderProjects(document.getElementById("projects"), projects);
renderExperience(document.getElementById("experience"), experience);
renderSkillGrid(document.getElementById("skills"), skills);
renderEducationAndPublications(document.getElementById("education"), {
  education,
  educationNote,
  publications,
});
renderFooter(document.getElementById("footer"), footerText);
