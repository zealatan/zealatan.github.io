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
    <a class="resume-button" href="${profile.resumeUrl}" target="_blank" rel="noopener noreferrer">
      ↓ Download Resume PDF
    </a>
  `;
}

export function renderProjects(container, projects) {
  const cards = projects
    .map((project) => {
      const detailLink = project.detailUrl
        ? `<a class="card-link" href="${project.detailUrl}">View Details →</a>`
        : "";
      const otherLinks = (project.links || [])
        .map((link) => `<a class="card-link" href="${link.href}"${externalAttrs(link.href)}>${link.label}</a>`)
        .join("\n");

      return `
      <article class="card project-card">
        <div class="project-card-body">
          <span class="badge">${project.badge}</span>
          <h3>${project.title}</h3>
          <p class="project-card-summary">${project.summary}</p>
          <div class="tag-list">
            ${project.tags.map((tag) => `<span>${tag}</span>`).join("\n")}
          </div>
          <div class="card-link-row">
            ${detailLink}
            ${otherLinks}
          </div>
        </div>
        ${project.image ? `<img class="project-card-image" src="${project.image}" alt="${project.title}" />` : ""}
      </article>
    `;
    })
    .join("\n");

  container.innerHTML = `
    <h2 class="section-title">Projects</h2>
    <div class="project-grid">${cards}</div>
  `;
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
