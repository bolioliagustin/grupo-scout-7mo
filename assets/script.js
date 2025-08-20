/* Configuración — CAMBIÁ ESTO por tu repo público de GitHub */
const GITHUB_OWNER = "bolioliagustin";   // ← reemplazar
const GITHUB_REPO  = "grupo-scout-7mo"; // ← reemplazar
const BRANCH = "main";

/**
 * Este script:
 * 1) Alterna menú mobile
 * 2) Inserta año en footer
 * 3) Carga Noticias y Blog desde /content usando la GitHub API pública
 *    y renderiza Markdown con Marked
 */

document.addEventListener("DOMContentLoaded", () => {
  // Año
  document.getElementById("year").textContent = new Date().getFullYear();

  // Menú móvil
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  toggle?.addEventListener("click", () => nav.classList.toggle("open"));

  // Cargar contenidos
  loadCollection("noticias", "#news-list");
  loadCollection("blog", "#blog-list");

  // Botón "Cargar más"
  document.querySelectorAll("[data-more]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const type = btn.dataset.more;
      await loadCollection(type, type === "news" ? "#news-list" : "#blog-list", { append: true });
    });
  });
});

/**
 * Lista archivos de un directorio del repo vía GitHub API (público).
 */
async function listRepoDir(path) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${BRANCH}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo listar: " + path);
  return res.json(); // array de archivos
}

/** Cache simple de paginación por colección */
const paginationState = { noticias: { page: 0 }, blog: { page: 0 } };
const PAGE_SIZE = 6;

/**
 * Carga y renderiza una colección (noticias/blog)
 */
async function loadCollection(collection, targetSelector, { append = false } = {}) {
  const target = document.querySelector(targetSelector);
  if (!append) target.innerHTML = ""; // reset si no es append

  try {
    const state = paginationState[collection];
    const list = await listRepoDir(`content/${collection}`);
    // Filtrar .md y ordenar por fecha si el filename incluye ISO en el front (opcional)
    const mdFiles = list
      .filter(item => item.type === "file" && item.name.endsWith(".md"))
      .sort((a, b) => a.name < b.name ? 1 : -1); // inverso aprox por nombre

    // Paginar
    const start = state.page * PAGE_SIZE;
    const slice = mdFiles.slice(start, start + PAGE_SIZE);
    state.page += 1;

    for (const file of slice) {
      const { content, metadata } = await fetchMarkdownWithFrontmatter(file.download_url);
      const card = buildCard(content, metadata, collection);
      target.appendChild(card);
    }

    // ocultar botón si no hay más
    const remaining = mdFiles.length - (state.page * PAGE_SIZE);
    const btn = document.querySelector(`[data-more="${collection === "noticias" ? "news" : "blog"}"]`);
    if (remaining <= 0 && btn) btn.style.display = "none";
  } catch (err) {
    console.error(err);
    const div = document.createElement("div");
    div.textContent = "No pudimos cargar " + collection + ". Verificá la configuración del repo.";
    target.appendChild(div);
  }
}

/**
 * Descarga Markdown y separa Frontmatter YAML si existe
 */
async function fetchMarkdownWithFrontmatter(rawUrl) {
  const res = await fetch(rawUrl);
  if (!res.ok) throw new Error("Error descargando MD");
  const text = await res.text();
  let metadata = {};
  let md = text;

  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) {
      const yamlText = text.slice(3, end).trim();
      metadata = parseYAML(yamlText);
      md = text.slice(end + 4).trim();
    }
  }
  return { content: md, metadata };
}

/**
 * Parser YAML mini (clave: valor por línea) — suficiente para título/fecha/autor/excerpt/cover
 */
function parseYAML(yaml) {
  const meta = {};
  yaml.split("\n").forEach(line => {
    const idx = line.indexOf(":");
    if (idx > -1) {
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      // quitar comillas si las hay
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      meta[key] = value;
    }
  });
  return meta;
}

/**
 * Crea una tarjeta de contenido
 */
function buildCard(md, meta, collection) {
  const div = document.createElement("article");
  div.className = "card";

  const img = document.createElement("img");
  img.className = "media";
  img.alt = meta.title || "Imagen de la publicación";
  img.src = meta.cover || placeholderFromCollection(collection);

  const content = document.createElement("div");
  content.className = "content";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = collection === "noticias" ? "Noticia" : "Blog";

  const title = document.createElement("h3");
  title.className = "title";
  title.textContent = meta.title || "Sin título";

  const metaLine = document.createElement("div");
  metaLine.className = "meta";
  metaLine.innerHTML = [
    meta.date ? `📅 ${formatDate(meta.date)}` : "",
    meta.author ? `👤 ${meta.author}` : ""
  ].filter(Boolean).join(" · ");

  const excerpt = document.createElement("p");
  excerpt.className = "excerpt";
  const html = marked.parse(meta.excerpt || md.slice(0, 180) + "…");
  excerpt.innerHTML = html;

  content.append(badge, title, metaLine, excerpt);
  div.append(img, content);
  return div;
}

function placeholderFromCollection(coll){
  return coll === "noticias"
    ? "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&q=70"
    : "https://images.unsplash.com/photo-1493244040629-496f6d136cc3?w=1200&q=70";
}

function formatDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { year:"numeric", month:"short", day:"2-digit" });
}
