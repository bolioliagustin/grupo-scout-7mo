const GITHUB_OWNER = "bolioliagustin";   // ← reemplazar
const GITHUB_REPO = "grupo-scout-7mo"; // ← reemplazar
const BRANCH = "main";

/* Estado de paginación */
const paginationState = { noticias: { page: 0 }, blog: { page: 0 } };
const PAGE_SIZE = 6;

document.addEventListener("DOMContentLoaded", () => {
  // Año footer
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // Menú móvil
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  toggle?.addEventListener("click", () => nav.classList.toggle("open"));

  // Cargar colecciones iniciales
  loadCollection("noticias", "#news-list");
  loadCollection("blog", "#blog-list");

  // FIX: botones "Cargar más" usan la MISMA clave de colección
  document.querySelectorAll("[data-more]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const collection = btn.dataset.more; // ahora "noticias" o "blog"
      await loadCollection(collection, collection === "noticias" ? "#news-list" : "#blog-list", { append: true });
    });
  });
});

/* Listar directorio del repo en GitHub */
async function listRepoDir(path) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${BRANCH}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub ${res.status} en ${path}: ${txt}`);
  }
  return res.json();
}

/* Cargar colección y renderizar tarjetas */
async function loadCollection(collection, targetSelector, { append = false } = {}) {
  const target = document.querySelector(targetSelector);
  if (!target) return;

  if (!append) target.innerHTML = ""; // reset si no es append

  try {
    console.log(`[${collection}] listando…`);
    const state = paginationState[collection];
    const list = await listRepoDir(`content/${collection}`);

    const mdFiles = list
      .filter(item => item.type === "file" && item.name.endsWith(".md"));

    if (mdFiles.length === 0) {
      target.innerHTML = `<div>No hay publicaciones en <strong>${collection}</strong> todavía.</div>`;
      hideLoadMore(collection);
      return;
    }

    // Descargamos todas y ordenamos por fecha del frontmatter (desc)
    const all = await Promise.all(mdFiles.map(async f => {
      const { content, metadata } = await fetchMarkdownWithFrontmatter(f.download_url);
      return { content, metadata };
    }));

    all.sort((a, b) => {
      const da = new Date(a.metadata.date || 0).getTime();
      const db = new Date(b.metadata.date || 0).getTime();
      return db - da;
    });

    // Paginación
    const start = state.page * PAGE_SIZE;
    const slice = all.slice(start, start + PAGE_SIZE);
    state.page += 1;

    slice.forEach(item => {
      const card = buildCard(item.content, item.metadata, collection);
      target.appendChild(card);
    });

    // Botón cargar más
    const remaining = all.length - (state.page * PAGE_SIZE);
    if (remaining <= 0) hideLoadMore(collection);

    console.log(`[${collection}] renderizadas ${slice.length} / total ${all.length}`);
  } catch (err) {
    console.error(err);
    target.innerHTML = `
      <div style="padding:12px;border:1px solid #0001;border-radius:10px;background:#fff">
        Ocurrió un error al cargar <strong>${collection}</strong>.<br/>
        <small>${err.message}</small>
      </div>`;
    hideLoadMore(collection);
  }
}

function hideLoadMore(collection) {
  const key = collection; // "noticias" | "blog"
  const btn = document.querySelector(`[data-more="${key}"]`);
  if (btn) btn.style.display = "none";
}

/* Descargar Markdown y extraer frontmatter */
async function fetchMarkdownWithFrontmatter(rawUrl) {
  const res = await fetch(rawUrl);
  if (!res.ok) throw new Error(`No se pudo descargar MD: ${rawUrl}`);
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

/* YAML simple (clave: valor) */
function parseYAML(yaml) {
  const meta = {};
  yaml.split("\n").forEach(line => {
    const idx = line.indexOf(":");
    if (idx > -1) {
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      meta[key] = value;
    }
  });
  return meta;
}

/* Construir tarjeta */
function buildCard(md, meta, collection) {
  const div = document.createElement("article");
  div.className = "card";

  const img = document.createElement("img");
  img.className = "media";
  img.alt = meta.title || "Imagen";
  img.src = meta.cover || placeholderFromCollection(collection);

  const content = document.createElement("div");
  content.className = "content";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = collection === "noticias" ? "Noticia" : "Blog";

  const title = document.createElement("a");
  title.className = "title";
  title.textContent = meta.title || "Sin título";
  const slug = fileNameToSlug(meta.title || "post"); // función para limpiar
  title.href = `post.html?type=${collection}&slug=${slug}`;

  const metaLine = document.createElement("div");
  metaLine.className = "meta";
  metaLine.innerHTML = [
    meta.date ? `📅 ${formatDate(meta.date)}` : "",
    meta.author ? `👤 ${meta.author}` : ""
  ].filter(Boolean).join(" · ");

  const excerpt = document.createElement("p");
  excerpt.className = "excerpt";
  const summary = meta.excerpt && meta.excerpt.trim().length ? meta.excerpt : md.slice(0, 180) + "…";
  const html = (window.marked ? marked.parse(summary) : summary);
  excerpt.innerHTML = html;

  content.append(badge, title, metaLine, excerpt);
  div.append(img, content);
  return div;
}

function fileNameToSlug(str){
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function placeholderFromCollection(coll) {
  return coll === "noticias"
    ? "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&q=70"
    : "https://images.unsplash.com/photo-1493244040629-496f6d136cc3?w=1200&q=70";
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("es-UY", { year: "numeric", month: "short", day: "2-digit" });
}
