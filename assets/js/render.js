function externalAttrs(href) {
  return href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
}

export function renderNav(container, { siteTitle, items }) {
  const links = items
    .map((item) => `<a href="${item.href}"${externalAttrs(item.href)}>${item.label}</a>`)
    .join("\n");

  container.innerHTML = `
    <nav class="site-nav">
      <a class="site-title" href="index.html">${siteTitle}</a>
      <div class="site-nav-links">${links}</div>
    </nav>
  `;
}

export function renderFooter(container, text) {
  container.innerHTML = `<footer><p>${text}</p></footer>`;
}

export function renderHero(container, profile) {
  container.innerHTML = `
    <h1>${profile.name}</h1>
    <p class="subtitle">${profile.subtitle}</p>
    <p class="tagline">${profile.tagline}</p>
    <p class="intro">${profile.intro}</p>
    <div class="links">
      <a href="#projects">↓ View Projects</a>
      <a href="mailto:${profile.email}">✉ ${profile.email}</a>
      <a href="${profile.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      <a href="${profile.github}" target="_blank" rel="noopener noreferrer">GitHub</a>
    </div>
  `;
}

function renderCardLinks(links) {
  if (!links || !links.length) return "";
  const items = links
    .map((link) => `<a class="card-link" href="${link.href}"${externalAttrs(link.href)}>${link.label}</a>`)
    .join("\n");
  return `<div class="card-link-row">${items}</div>`;
}

function renderMetrics(metrics) {
  if (!metrics || !metrics.length) return "";
  return `<div class="metric-row">${metrics.map((m) => `<span class="metric">${m}</span>`).join("")}</div>`;
}

function renderCard(card, { feature = false } = {}) {
  const classes = ["card", "portfolio-card"];
  if (feature) classes.push("portfolio-card-feature");
  if (card.image) classes.push("card-with-image");
  if (card.svg) classes.push("card-with-svg");

  const media = card.image
    ? `<img class="portfolio-card-image" src="${card.image}" alt="${card.imageAlt || card.title}" />`
    : card.svg
    ? `<div class="portfolio-card-svg">${card.svg}</div>`
    : "";

  return `
    <article class="${classes.join(" ")}">
      <div class="portfolio-card-body">
        ${card.badge ? `<span class="badge">${card.badge}</span>` : ""}
        <h3>${card.title}</h3>
        ${card.result ? `<p class="card-result">${card.result}</p>` : ""}
        ${renderMetrics(card.metrics)}
        ${card.diff ? `<p class="card-diff">${card.diff}</p>` : ""}
        ${card.verify ? `<p class="card-verify"><span class="card-verify-label">Verified</span> ${card.verify}</p>` : ""}
        ${card.note ? `<p class="card-note">${card.note}</p>` : ""}
        ${renderCardLinks(card.links)}
      </div>
      ${media}
    </article>
  `;
}

function renderSimListItem(item) {
  return `
    <div class="sim-list-item">
      <h4>${item.title}</h4>
      ${item.diff ? `<p class="card-diff">${item.diff}</p>` : ""}
      ${renderCardLinks(item.links)}
    </div>
  `;
}

function renderSection(section) {
  const intro = section.intro ? `<p class="section-intro">${section.intro}</p>` : "";

  let body;
  if (section.layout === "feature-list") {
    const feature = section.cards.map((card) => renderCard(card, { feature: true })).join("\n");
    const list =
      section.listItems && section.listItems.length
        ? `<div class="sim-list">${section.listItems.map(renderSimListItem).join("\n")}</div>`
        : "";
    body = feature + list;
  } else {
    const single = section.cards.length === 1 ? " single" : "";
    body = `<div class="portfolio-grid${single}">${section.cards.map((card) => renderCard(card)).join("\n")}</div>`;
  }

  return `
    <div class="portfolio-section" id="${section.id}">
      <h2 class="section-title">${section.title}</h2>
      ${intro}
      ${body}
    </div>
  `;
}

export function renderSections(container, sections) {
  container.innerHTML = sections.map(renderSection).join("\n");
}

function renderRole(role) {
  return `
    <div class="compact-role">
      <div class="compact-role-header">
        <strong>${role.title}</strong>
        <span>${role.dateRange}</span>
      </div>
      <p>${role.description}</p>
    </div>
  `;
}

function renderExperienceItem(item) {
  const dateHtml = item.dateRange ? `<span class="experience-date">${item.dateRange}</span>` : "";
  const descriptionHtml = item.description ? `<p class="experience-meta">${item.description}</p>` : "";
  const highlightsHtml = item.highlights
    ? `<ul class="experience-highlights">${item.highlights.map((h) => `<li>${h}</li>`).join("\n")}</ul>`
    : "";
  const rolesHtml = item.roles
    ? `<div class="compact-role-list">${item.roles.map(renderRole).join("\n")}</div>`
    : "";

  return `
    <div class="card experience-item">
      <div class="experience-header">
        <div>
          <h3>${item.org}</h3>
          <p class="experience-meta">${item.location} | ${item.roleLine}</p>
        </div>
        ${dateHtml}
      </div>
      ${descriptionHtml}
      ${highlightsHtml}
      ${rolesHtml}
    </div>
  `;
}

export function renderExperience(container, experience) {
  container.innerHTML = `
    <h2 class="section-title">Experience</h2>
    <div class="experience-list">${experience.map(renderExperienceItem).join("\n")}</div>
  `;
}

export function renderSkillGrid(container, skills) {
  container.innerHTML = `
    <h2 class="section-title">Skills</h2>
    <div class="skill-grid">
      ${skills.map((skill) => `<span>${skill}</span>`).join("\n")}
    </div>
  `;
}

function renderEducationItem(item) {
  const noteHtml = item.note ? `<p class="education-note">${item.note}</p>` : "";
  return `
    <p>
      <strong>${item.degree}</strong><br />
      ${item.school}<br />
      ${item.detail ? `${item.detail}<br />` : ""}
      <span class="small-text">${item.dateRange}</span>
    </p>
    ${noteHtml}
  `;
}

function renderPublicationItem(item) {
  const links = item.links
    .map((link) => `<a href="${link.href}"${externalAttrs(link.href)}>${link.label}</a>`)
    .join("\n");

  return `
    <p>
      <strong>${item.title}</strong><br />
      ${item.authorLine}
    </p>
    <p class="publication-links">${links}</p>
  `;
}

export function renderEducationAndPublications(container, { education, educationNote, publications }) {
  container.innerHTML = `
    <h2 class="section-title">Education &amp; Publications</h2>
    <div class="education-publication-grid">
      <div>
        <h3 class="subsection-title">Education</h3>
        ${education.map(renderEducationItem).join("\n")}
        <p>${educationNote}</p>
      </div>
      <div>
        <h3 class="subsection-title">Publications</h3>
        ${publications.map(renderPublicationItem).join("\n")}
      </div>
    </div>
  `;
}

function renderDemoCard(demo) {
  const links = demo.links
    .map((link) => `<a class="card-link" href="${link.href}"${externalAttrs(link.href)}>${link.label}</a>`)
    .join("\n");

  return `
    <div class="card demo-video-card">
      <video controls preload="metadata" poster="${demo.poster}">
        <source src="${demo.video}" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div class="demo-video-text">
        <h3>${demo.title}</h3>
        <p>${demo.description}</p>
        <p class="tags">${demo.tags.join(" · ")}</p>
        ${links}
      </div>
    </div>
  `;
}

export function renderDemos(container, demos) {
  container.innerHTML = demos.map(renderDemoCard).join("\n");
}
