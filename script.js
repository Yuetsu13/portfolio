/**
 * Loads work entries from JSON files listed in content/works-manifest.json.
 * Static servers cannot list directories; add each new work filename to the manifest.
 */
const MANIFEST_URL = "./content/works-manifest.json";

const gridEl = document.getElementById("grid");
const statusEl = document.getElementById("status");

const modalEl = document.getElementById("modal");
const modalTitleEl = document.getElementById("modalTitle");
const modalDateEl = document.getElementById("modalDate");
const modalDescEl = document.getElementById("modalDesc");
const modalMediaEl = document.getElementById("modalMedia");
const prevBtn = document.querySelector("[data-prev]");
const nextBtn = document.querySelector("[data-next]");

let works = [];
let isModalOpen = false;
let currentWorkId = null;

function setStatus(message) {
  statusEl.textContent = message || "";
}

function getQueryWorkId() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("work");
  return id ? String(id) : null;
}

function setQueryWorkId(id, { replace = false } = {}) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("work", id);
  else url.searchParams.delete("work");
  const next = url.pathname + url.search + url.hash;
  if (replace) history.replaceState(null, "", next);
  else history.pushState(null, "", next);
}

function parseDateMs(value) {
  if (!value) return 0;
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : 0;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildCard(work) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "card";
  btn.setAttribute("data-work-id", work.id);
  btn.setAttribute("aria-label", work.title);

  const img = document.createElement("img");
  img.className = "thumb";
  img.alt = work.title;
  img.loading = "lazy";
  img.src = work.thumbnail || "";

  const cap = document.createElement("div");
  cap.className = "card__caption";
  cap.textContent = work.title;

  btn.appendChild(img);
  btn.appendChild(cap);

  btn.addEventListener("click", () => openWork(work.id));
  return btn;
}

function renderGrid() {
  gridEl.innerHTML = "";
  for (const work of works) gridEl.appendChild(buildCard(work));
  setStatus("");
}

function findWork(id) {
  return works.find((w) => w.id === id) || null;
}

function getCurrentIndex() {
  if (!currentWorkId) return -1;
  return works.findIndex((w) => w.id === currentWorkId);
}

function openPrev() {
  const idx = getCurrentIndex();
  if (idx < 0) return;
  const prev = works[(idx - 1 + works.length) % works.length];
  openWork(prev.id);
}

function openNext() {
  const idx = getCurrentIndex();
  if (idx < 0) return;
  const next = works[(idx + 1) % works.length];
  openWork(next.id);
}

function openWork(id, { pushUrl = true } = {}) {
  const work = findWork(id);
  if (!work) {
    setStatus(`Work not found: ${id}`);
    return;
  }

  currentWorkId = work.id;
  isModalOpen = true;

  modalTitleEl.textContent = work.title;
  modalDateEl.textContent = formatDate(work.date);
  modalDescEl.textContent = work.description || "";

  modalMediaEl.innerHTML = "";
  modalMediaEl.classList.remove("is-video");

if (work.video_url) {
  // 视频：转换为embed链接
  let embedUrl = work.video_url;
  const vimeoMatch = work.video_url.match(/vimeo\.com\/(\d+)/);
  const youtubeMatch = work.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  if (youtubeMatch) embedUrl = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  const iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.allowFullscreen = true;
  iframe.allow = "autoplay; fullscreen";
  modalMediaEl.appendChild(iframe);
  modalMediaEl.classList.add("is-video");
} else {
  const img = document.createElement("img");
  img.alt = work.title;
  img.src = work.image || work.thumbnail || "";
  modalMediaEl.appendChild(img);
}

  modalEl.classList.add("is-open");
  modalEl.setAttribute("aria-hidden", "false");
  document.documentElement.style.overflow = "hidden";

  if (pushUrl) setQueryWorkId(work.id);
  setStatus("");
}

function closeModal({ pushUrl = true } = {}) {
  if (!isModalOpen) return;

  isModalOpen = false;
  currentWorkId = null;

  modalEl.classList.remove("is-open");
  modalEl.setAttribute("aria-hidden", "true");
  modalTitleEl.textContent = "";
  modalDateEl.textContent = "";
  modalDescEl.textContent = "";
  modalMediaEl.innerHTML = "";
  modalMediaEl.classList.remove("is-video");
  document.documentElement.style.overflow = "";

  if (pushUrl) setQueryWorkId(null);
}

function wireModalEvents() {
  modalEl.addEventListener("click", (e) => {
    const target = e.target;
    if (target && target.hasAttribute && target.hasAttribute("data-close")) {
      closeModal();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    if (!isModalOpen) return;
    if (e.key === "ArrowLeft") openPrev();
    if (e.key === "ArrowRight") openNext();
  });

  if (prevBtn) prevBtn.addEventListener("click", openPrev);
  if (nextBtn) nextBtn.addEventListener("click", openNext);

  window.addEventListener("popstate", () => {
    const id = getQueryWorkId();
    if (id) openWork(id, { pushUrl: false });
    else closeModal({ pushUrl: false });
  });
}

async function loadManifest() {
  const res = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Missing ${MANIFEST_URL} (${res.status})`);
  const data = await res.json();
  const files = Array.isArray(data.files) ? data.files : [];
  return files.filter((f) => typeof f === "string" && f.endsWith(".json"));
}

function slugFromFilename(name) {
  return name.replace(/\.json$/i, "");
}

async function loadWorkJson(filename) {
  const url = `./content/works/${filename}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed ${url} (${res.status})`);
  return res.json();
}

function normalizeWork(slug, raw) {
  const thumbnail = raw.thumbnail || raw.image || raw.cover || "";
  const image = raw.image || raw.thumbnail || raw.cover || "";
  return {
    id: slug,
    title: raw.title ? String(raw.title) : "Untitled",
    thumbnail: String(thumbnail),
    image: String(image),
    video_url: raw.video_url ? String(raw.video_url) : "",
    description: raw.description != null ? String(raw.description) : "",
    date: raw.date != null ? String(raw.date) : "",
  };
}

async function init() {
  wireModalEvents();

  try {
    const files = await loadManifest();
    if (files.length === 0) {
      setStatus("No works listed in content/works-manifest.json.");
      return;
    }

    const loaded = await Promise.all(
      files.map(async (file) => {
        const slug = slugFromFilename(file);
        const raw = await loadWorkJson(file);
        return normalizeWork(slug, raw);
      })
    );

    loaded.sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date));
    works = loaded;
    renderGrid();
  } catch (err) {
    console.error(err);
    setStatus(
      "Could not load works. Run a static server from the project root and check content/works-manifest.json."
    );
    return;
  }

  const initialId = getQueryWorkId();
  if (initialId) openWork(initialId, { pushUrl: false });
}

init();
