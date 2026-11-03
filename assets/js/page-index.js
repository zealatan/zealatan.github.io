import {
  profile,
  nav,
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
  renderProjects,
  renderExperience,
  renderSkillGrid,
  renderEducationAndPublications,
} from "./render.js";

renderNav(document.getElementById("nav"), { siteTitle: profile.name, items: nav });
renderProjects(document.getElementById("projects"), projects);
renderExperience(document.getElementById("experience"), experience);
renderSkillGrid(document.getElementById("skills"), skills);
renderEducationAndPublications(document.getElementById("education"), {
  education,
  educationNote,
  publications,
});
renderFooter(document.getElementById("footer"), footerText);
