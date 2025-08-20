const GITHUB_OWNER = "TU-OWNER";   // cambiar
const GITHUB_REPO  = "TU-REPO";    // cambiar
const BRANCH = "main";

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const type = params.get("type"); // "noticias" o "blog"

  if (!slug || !type) {
    document.getElementById("post-content").innerHTML = "<p>No se encontró el artículo.</p>";
    return;
  }

  loadPost(type, slug);
});

async function loadPost(collection, slug){
  try {
    // 1) Listar archivos del directorio
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/content/${collection}?ref=${BRANCH}`;
    const res = await fetch(url);
    const list = await res.json();

    // 2) Buscar archivo cuyo nombre incluya el slug
    const file = list.find(f => f.name.includes(slug));
    if (!file) throw new Error("No se encontró el archivo");

    // 3) Descargar contenido
    const mdRes = await fetch(file.download_url);
    const text = await mdRes.text();

    // 4) Parsear frontmatter
    let metadata = {}, md = text;
    if (text.startsWith("---")) {
      const end = text.indexOf("\n---", 3);
      if (end !== -1) {
        metadata = parseYAML(text.slice(3, end).trim());
        md = text.slice(end + 4).trim();
      }
    }

    // 5) Render en la página
    document.getElementById("post-title").textContent = metadata.title || slug;
    document.title = (metadata.title || "Artículo") + " — Grupo Scout 7º";
    document.getElementById("post-meta").textContent = [
      metadata.date ? "📅 " + formatDate(metadata.date) : "",
      metadata.author ? "👤 " + metadata.author : ""
    ].filter(Boolean).join(" · ");

    if (metadata.cover){
      const img = document.getElementById("post-cover");
      img.src = metadata.cover;
      img.style.display = "block";
    }

    document.getElementById("post-body").innerHTML = marked.parse(md);

  } catch (err){
    console.error(err);
    document.getElementById("post-content").innerHTML = "<p>Error cargando el artículo.</p>";
  }
}

function parseYAML(yaml){
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

function formatDate(iso){
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("es-UY", { year:"numeric", month:"short", day:"2-digit" });
}
