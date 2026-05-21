import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

const pdfjsUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const state = {
  fileName: "edited.pdf",
  originalBytes: null,
  pdf: null,
  scale: 1.25,
  pages: [],
  edits: new Map(),
  activePage: 1,
  selectedBox: null,
  mode: "edit",
  mergeFiles: [],
  mergePageOrder: [],
  splitFile: null,
  photoFiles: [],
  user: null,
};

const els = {
  fileInput: document.querySelector("#file-input"),
  emptyFileInput: document.querySelector("#empty-file-input"),
  saveButton: document.querySelector("#save-button"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomLevel: document.querySelector("#zoom-level"),
  pageCount: document.querySelector("#page-count"),
  activePage: document.querySelector("#active-page"),
  editCount: document.querySelector("#edit-count"),
  pageList: document.querySelector("#page-list"),
  pageStage: document.querySelector("#page-stage"),
  emptyState: document.querySelector("#empty-state"),
  fontSize: document.querySelector("#font-size"),
  textColor: document.querySelector("#text-color"),
  coverColor: document.querySelector("#cover-color"),
  loginButton: document.querySelector("#login-button"),
  userMenu: document.querySelector("#user-menu"),
  userChip: document.querySelector("#user-chip"),
  userAvatar: document.querySelector("#user-avatar"),
  userName: document.querySelector("#user-name"),
  logoutButton: document.querySelector("#logout-button"),
  loginDialog: document.querySelector("#login-dialog"),
  loginForm: document.querySelector("#login-form"),
  closeLogin: document.querySelector("#close-login"),
  loginEmail: document.querySelector("#login-email"),
  loginName: document.querySelector("#login-name"),
  socialButtons: document.querySelectorAll(".social-button"),
  modeTabs: document.querySelectorAll(".mode-tab"),
  modeActions: document.querySelectorAll(".mode-action"),
  sidebarPanels: document.querySelectorAll(".sidebar-panel"),
  toolViews: document.querySelectorAll(".tool-view"),
  mergeInput: document.querySelector("#merge-input"),
  mergeEmptyInput: document.querySelector("#merge-empty-input"),
  mergeButton: document.querySelector("#merge-button"),
  mergeCount: document.querySelector("#merge-count"),
  mergeSelectedCount: document.querySelector("#merge-selected-count"),
  mergePreviewCount: document.querySelector("#merge-preview-count"),
  mergeList: document.querySelector("#merge-list"),
  mergePreview: document.querySelector("#merge-preview"),
  mergeDropzone: document.querySelector("#merge-dropzone"),
  splitInput: document.querySelector("#split-input"),
  splitEmptyInput: document.querySelector("#split-empty-input"),
  splitButton: document.querySelector("#split-button"),
  splitCount: document.querySelector("#split-count"),
  splitSelectedCount: document.querySelector("#split-selected-count"),
  splitPreviewCount: document.querySelector("#split-preview-count"),
  splitPreview: document.querySelector("#split-preview"),
  splitDropzone: document.querySelector("#split-dropzone"),
  splitSelectAll: document.querySelector("#split-select-all"),
  splitSelectNone: document.querySelector("#split-select-none"),
  photoInput: document.querySelector("#photo-input"),
  photoEmptyInput: document.querySelector("#photo-empty-input"),
  photosButton: document.querySelector("#photos-button"),
  photoCount: document.querySelector("#photo-count"),
  photoList: document.querySelector("#photo-list"),
  photoDropzone: document.querySelector("#photo-dropzone"),
  photoPageSize: document.querySelector("#photo-page-size"),
  toast: document.querySelector("#toast"),
};

let toastTimer;
let mergePreviewRun = 0;
const userStorageKey = "pdf-studio-user";

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove("visible"), 3200);
}

function normalizeFileName(name) {
  return name.replace(/\.pdf$/i, "") + "-edited.pdf";
}

function updateControls() {
  const hasPdf = Boolean(state.pdf);
  const selectedMergePages = getSelectedMergePages().length;
  const selectedSplitPages = state.splitFile ? state.splitFile.selectedPages.size : 0;
  els.saveButton.disabled = !hasPdf;
  els.zoomIn.disabled = !hasPdf;
  els.zoomOut.disabled = !hasPdf;
  els.mergeButton.disabled = selectedMergePages === 0;
  els.splitButton.disabled = selectedSplitPages === 0;
  els.splitSelectAll.disabled = !state.splitFile;
  els.splitSelectNone.disabled = !state.splitFile;
  els.photosButton.disabled = state.photoFiles.length === 0;
  els.zoomLevel.value = `${Math.round((state.scale / 1.25) * 100)}%`;
  els.pageCount.textContent = hasPdf ? `${state.pages.length} page${state.pages.length === 1 ? "" : "s"}` : "No file";
  els.activePage.textContent = hasPdf ? `Page ${state.activePage}` : "-";
  els.editCount.textContent = `${state.edits.size} edit${state.edits.size === 1 ? "" : "s"}`;
  els.mergeCount.textContent = `${state.mergeFiles.length} file${state.mergeFiles.length === 1 ? "" : "s"}`;
  els.mergeSelectedCount.textContent = String(selectedMergePages);
  els.mergePreviewCount.textContent = `${selectedMergePages} page${selectedMergePages === 1 ? "" : "s"}`;
  els.splitCount.textContent = state.splitFile
    ? `${state.splitFile.pageCount} page${state.splitFile.pageCount === 1 ? "" : "s"}`
    : "No file";
  els.splitSelectedCount.textContent = String(selectedSplitPages);
  els.splitPreviewCount.textContent = state.splitFile
    ? `${selectedSplitPages} of ${state.splitFile.pageCount} selected`
    : "0 pages";
  els.photoCount.textContent = `${state.photoFiles.length} photo${state.photoFiles.length === 1 ? "" : "s"}`;
}

function setBusy(isBusy) {
  document.body.style.cursor = isBusy ? "progress" : "";
  els.saveButton.disabled = isBusy || !state.pdf;
  els.mergeButton.disabled = isBusy || getSelectedMergePages().length === 0;
  els.splitButton.disabled = isBusy || !state.splitFile || state.splitFile.selectedPages.size === 0;
  els.photosButton.disabled = isBusy || state.photoFiles.length === 0;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(bytes / 1024, 1).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function downloadBytes(bytes, fileName, type = "application/pdf") {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function switchMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  els.modeTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  els.modeActions.forEach((action) => action.classList.toggle("hidden", action.dataset.actionMode !== mode));
  els.sidebarPanels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.sidebarMode !== mode));
  els.toolViews.forEach((view) => view.classList.toggle("active", view.id === `${mode}-view`));
  updateControls();
}

function getInitials(nameOrEmail) {
  const clean = nameOrEmail.trim();
  if (!clean) return "U";
  const parts = clean.includes("@") ? clean.split("@")[0].split(/[._-]/) : clean.split(/\s+/);
  return parts
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function saveUser(user) {
  state.user = user;
  localStorage.setItem(userStorageKey, JSON.stringify(user));
  renderUser();
}

function renderUser() {
  const isSignedIn = Boolean(state.user);
  els.loginButton.classList.toggle("hidden", isSignedIn);
  els.userMenu.classList.toggle("hidden", !isSignedIn);

  if (!state.user) return;
  els.userName.textContent = state.user.name || state.user.email || state.user.provider;
  els.userAvatar.textContent = getInitials(state.user.name || state.user.email || state.user.provider);
}

function loadSavedUser() {
  try {
    const saved = localStorage.getItem(userStorageKey);
    state.user = saved ? JSON.parse(saved) : null;
  } catch {
    state.user = null;
  }
  renderUser();
}

function openLoginDialog() {
  if (typeof els.loginDialog.showModal === "function") {
    els.loginDialog.showModal();
  } else {
    els.loginDialog.setAttribute("open", "");
  }
  els.loginEmail.focus();
}

function closeLoginDialog() {
  els.loginDialog.close();
}

function getPdfJs() {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsUrl;
  return pdfjsLib;
}

async function loadPdf(file) {
  if (!file) return;

  setBusy(true);
  try {
    state.fileName = normalizeFileName(file.name || "document.pdf");
    state.originalBytes = await file.arrayBuffer();
    state.edits.clear();
    state.pages = [];
    state.selectedBox = null;

    const pdfjsLib = getPdfJs();
    state.pdf = await pdfjsLib.getDocument({ data: state.originalBytes.slice(0) }).promise;

    els.emptyState.style.display = "none";
    els.pageStage.innerHTML = "";
    els.pageList.innerHTML = "";

    for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
      await renderPage(pageNumber);
      addPageButton(pageNumber);
    }

    state.activePage = 1;
    updateActivePage();
    showToast("PDF loaded. Click any text to edit it.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not load that PDF.");
  } finally {
    setBusy(false);
    updateControls();
  }
}

async function renderPage(pageNumber) {
  const page = await state.pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: state.scale });
  const baseViewport = page.getViewport({ scale: 1 });

  const wrapper = document.createElement("article");
  wrapper.className = "pdf-page";
  wrapper.id = `page-${pageNumber}`;
  wrapper.dataset.pageNumber = String(pageNumber);
  wrapper.style.width = `${viewport.width}px`;
  wrapper.style.height = `${viewport.height}px`;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * pixelRatio);
  canvas.height = Math.floor(viewport.height * pixelRatio);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const layer = document.createElement("div");
  layer.className = "text-layer";

  wrapper.append(canvas, layer);
  els.pageStage.append(wrapper);

  await page.render({ canvasContext: context, viewport }).promise;

  const textContent = await page.getTextContent();
  const pageInfo = {
    pageNumber,
    width: baseViewport.width,
    height: baseViewport.height,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    wrapper,
    layer,
    items: [],
  };

  textContent.items.forEach((item, itemIndex) => {
    const text = item.str || "";
    if (!text.trim()) return;

    const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(transform[2], transform[3]) || Math.abs(transform[3]) || 12;
    const width = Math.max(item.width * state.scale, 10);
    const left = transform[4];
    const top = transform[5] - fontHeight;
    const height = Math.max(fontHeight * 1.18, 12);
    const id = `${pageNumber}-${itemIndex}`;

    const box = document.createElement("textarea");
    box.className = "text-box";
    box.value = text;
    box.dataset.id = id;
    box.dataset.pageNumber = String(pageNumber);
    box.dataset.original = text;
    box.spellcheck = false;
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width + 6}px`;
    box.style.height = `${height}px`;
    box.style.fontSize = `${fontHeight}px`;
    box.style.fontFamily = "Arial, sans-serif";
    box.style.setProperty("--box-cover", els.coverColor.value);
    box.style.setProperty("--box-color", els.textColor.value);

    const pdfRect = {
      x: item.transform[4],
      y: item.transform[5] - Math.abs(item.transform[3] || fontHeight / state.scale) * 0.25,
      width: item.width,
      height: Math.max(Math.abs(item.transform[3] || fontHeight / state.scale) * 1.15, 8),
    };

    pageInfo.items.push({
      id,
      original: text,
      rect: pdfRect,
      fontSize: Math.max(Math.abs(item.transform[3] || fontHeight / state.scale), 8),
    });

    box.addEventListener("focus", () => {
      state.selectedBox = box;
      els.fontSize.value = String(Math.round(Number.parseFloat(box.style.fontSize) / state.scale));
    });

    box.addEventListener("input", () => {
      trackEdit(box);
      box.style.height = `${Math.max(box.scrollHeight, height)}px`;
    });

    layer.append(box);
  });

  state.pages.push(pageInfo);
}

function addPageButton(pageNumber) {
  const button = document.createElement("button");
  button.className = "page-button";
  button.type = "button";
  button.dataset.pageNumber = String(pageNumber);
  button.innerHTML = `<span>Page ${pageNumber}</span><span>Open</span>`;
  button.addEventListener("click", () => {
    document.querySelector(`#page-${pageNumber}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    state.activePage = pageNumber;
    updateActivePage();
  });
  els.pageList.append(button);
}

function updateActivePage() {
  document.querySelectorAll(".page-button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.pageNumber) === state.activePage);
  });
  updateControls();
}

function trackEdit(box) {
  const id = box.dataset.id;
  const value = box.value;
  const original = box.dataset.original;
  const fontSize = Number(els.fontSize.value) || 14;
  const textColor = els.textColor.value;
  const coverColor = els.coverColor.value;

  box.style.setProperty("--box-cover", coverColor);
  box.style.setProperty("--box-color", textColor);

  if (value === original) {
    state.edits.delete(id);
    box.classList.remove("changed");
  } else {
    state.edits.set(id, {
      id,
      pageNumber: Number(box.dataset.pageNumber),
      text: value,
      fontSize,
      textColor,
      coverColor,
    });
    box.classList.add("changed");
  }
  updateControls();
}

function applyStyleToSelected() {
  if (!state.selectedBox) return;
  const fontSize = Number(els.fontSize.value) || 14;
  state.selectedBox.style.fontSize = `${fontSize * state.scale}px`;
  state.selectedBox.style.setProperty("--box-color", els.textColor.value);
  state.selectedBox.style.setProperty("--box-cover", els.coverColor.value);
  trackEdit(state.selectedBox);
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value, 16);
  return {
    r: ((number >> 16) & 255) / 255,
    g: ((number >> 8) & 255) / 255,
    b: (number & 255) / 255,
  };
}

async function savePdf() {
  if (!state.originalBytes || !window.PDFLib) return;

  setBusy(true);
  try {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const doc = await PDFDocument.load(state.originalBytes.slice(0));
    const font = await doc.embedFont(StandardFonts.Helvetica);

    for (const edit of state.edits.values()) {
      const pageInfo = state.pages[edit.pageNumber - 1];
      const source = pageInfo.items.find((item) => item.id === edit.id);
      if (!source) continue;

      const page = doc.getPage(edit.pageNumber - 1);
      const cover = hexToRgb(edit.coverColor);
      const text = hexToRgb(edit.textColor);
      const fontSize = Math.max(Number(edit.fontSize) || source.fontSize, 6);
      const lines = edit.text.split(/\r?\n/);
      const lineHeight = fontSize * 1.15;
      const rectHeight = Math.max(source.rect.height, lineHeight * lines.length);

      page.drawRectangle({
        x: source.rect.x - 1,
        y: source.rect.y - 2,
        width: Math.max(source.rect.width + 6, 12),
        height: rectHeight + 4,
        color: rgb(cover.r, cover.g, cover.b),
      });

      lines.forEach((line, index) => {
        page.drawText(line || " ", {
          x: source.rect.x,
          y: source.rect.y + rectHeight - fontSize - index * lineHeight,
          size: fontSize,
          font,
          color: rgb(text.r, text.g, text.b),
          maxWidth: Math.max(source.rect.width + 40, 40),
        });
      });
    }

    const bytes = await doc.save();
    downloadBytes(bytes, state.fileName);
    showToast("Edited PDF saved.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save the edited PDF.");
  } finally {
    setBusy(false);
    updateControls();
  }
}

function makeFileId(file) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
}

function getSelectedMergePages() {
  syncMergePageOrder();
  return state.mergePageOrder
    .map((entry) => {
      const item = state.mergeFiles.find((fileItem) => fileItem.id === entry.fileId);
      return item && item.selectedPages.has(entry.pageNumber) ? { item, pageNumber: entry.pageNumber } : null;
    })
    .filter(Boolean);
}

function getPageKey(fileId, pageNumber) {
  return `${fileId}:${pageNumber}`;
}

function getNaturalSelectedMergePages() {
  return state.mergeFiles.flatMap((item) =>
    Array.from(item.selectedPages)
      .sort((a, b) => a - b)
      .map((pageNumber) => ({ fileId: item.id, pageNumber })),
  );
}

function syncMergePageOrder() {
  const naturalOrder = getNaturalSelectedMergePages();
  const selectedKeys = new Set(naturalOrder.map((entry) => getPageKey(entry.fileId, entry.pageNumber)));
  const existingKeys = new Set();

  state.mergePageOrder = state.mergePageOrder.filter((entry) => {
    const key = getPageKey(entry.fileId, entry.pageNumber);
    if (!selectedKeys.has(key) || existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });

  naturalOrder.forEach((entry) => {
    const key = getPageKey(entry.fileId, entry.pageNumber);
    if (!existingKeys.has(key)) {
      state.mergePageOrder.push(entry);
      existingKeys.add(key);
    }
  });
}

async function addMergeFiles(files) {
  const pdfs = Array.from(files || []).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!pdfs.length) {
    showToast("Choose PDF files to merge.");
    return;
  }

  setBusy(true);
  try {
    const pdfjs = getPdfJs();
    for (const file of pdfs) {
      const bytes = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
      const selectedPages = new Set(Array.from({ length: pdf.numPages }, (_, index) => index + 1));
      state.mergeFiles.push({
        id: makeFileId(file),
        file,
        bytes,
        pdf,
        pageCount: pdf.numPages,
        selectedPages,
      });
    }

    renderMergeList();
    await renderMergePreview();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not read one of those PDFs.");
  } finally {
    setBusy(false);
    updateControls();
  }
}

function addPhotoFiles(files) {
  const photos = Array.from(files || []).filter((file) => /^image\/(png|jpeg)$/.test(file.type));
  if (!photos.length) {
    showToast("Choose JPG or PNG photos.");
    return;
  }

  state.photoFiles.push(
    ...photos.map((file) => ({
      id: makeFileId(file),
      file,
      url: URL.createObjectURL(file),
    })),
  );
  renderPhotoList();
  updateControls();
}

async function loadSplitPdf(file) {
  if (!file) return;
  if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) {
    showToast("Choose one PDF to split.");
    return;
  }

  setBusy(true);
  try {
    const bytes = await file.arrayBuffer();
    const pdf = await getPdfJs().getDocument({ data: bytes.slice(0) }).promise;
    state.splitFile = {
      id: makeFileId(file),
      file,
      bytes,
      pdf,
      pageCount: pdf.numPages,
      selectedPages: new Set(Array.from({ length: pdf.numPages }, (_, index) => index + 1)),
    };
    await renderSplitPreview();
    showToast("PDF loaded. Select the pages you want to export.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not read that PDF.");
  } finally {
    setBusy(false);
    updateControls();
  }
}

function moveItem(list, index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(nextIndex, 0, item);
}

function moveArrayItem(list, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) return;
  const [item] = list.splice(fromIndex, 1);
  list.splice(toIndex, 0, item);
}

function renderMergeList() {
  els.mergeList.innerHTML = "";
  if (!state.mergeFiles.length) {
    renderMergePreview();
    return;
  }

  state.mergeFiles.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "file-item with-pages";
    row.draggable = true;
    row.dataset.index = String(index);
    row.innerHTML = `
      <span class="file-icon">PDF</span>
      <div class="file-meta">
        <strong>${escapeHtml(item.file.name)}</strong>
        <span>${formatBytes(item.file.size)} | ${item.pageCount} pages | ${item.selectedPages.size} selected | Drag to reorder</span>
      </div>
      <div class="file-actions">
        <button class="mini-button" type="button" data-action="up" title="Move up">Up</button>
        <button class="mini-button" type="button" data-action="down" title="Move down">Down</button>
        <button class="mini-button" type="button" data-action="remove" title="Remove">X</button>
      </div>
      <div class="page-picker">
        <div class="page-picker-header">
          <span>Select pages from this PDF</span>
          <div class="page-picker-actions">
            <button class="mini-button" type="button" data-action="all">All</button>
            <button class="mini-button" type="button" data-action="none">None</button>
          </div>
        </div>
        <div class="page-chip-grid"></div>
      </div>
    `;

    row.querySelector('[data-action="up"]').disabled = index === 0;
    row.querySelector('[data-action="down"]').disabled = index === state.mergeFiles.length - 1;
    row.querySelector('[data-action="up"]').addEventListener("click", async () => {
      moveItem(state.mergeFiles, index, -1);
      state.mergePageOrder = getNaturalSelectedMergePages();
      renderMergeList();
      await renderMergePreview();
    });
    row.querySelector('[data-action="down"]').addEventListener("click", async () => {
      moveItem(state.mergeFiles, index, 1);
      state.mergePageOrder = getNaturalSelectedMergePages();
      renderMergeList();
      await renderMergePreview();
    });
    row.querySelector('[data-action="remove"]').addEventListener("click", async () => {
      state.mergeFiles.splice(index, 1);
      renderMergeList();
      await renderMergePreview();
      updateControls();
    });
    row.querySelector('[data-action="all"]').addEventListener("click", async () => {
      item.selectedPages = new Set(Array.from({ length: item.pageCount }, (_, pageIndex) => pageIndex + 1));
      renderMergeList();
      await renderMergePreview();
      updateControls();
    });
    row.querySelector('[data-action="none"]').addEventListener("click", async () => {
      item.selectedPages.clear();
      renderMergeList();
      await renderMergePreview();
      updateControls();
    });

    const pageGrid = row.querySelector(".page-chip-grid");
    for (let pageNumber = 1; pageNumber <= item.pageCount; pageNumber += 1) {
      const pageButton = document.createElement("button");
      pageButton.className = "page-chip";
      pageButton.type = "button";
      pageButton.textContent = String(pageNumber);
      pageButton.classList.toggle("selected", item.selectedPages.has(pageNumber));
      pageButton.addEventListener("click", async () => {
        if (item.selectedPages.has(pageNumber)) {
          item.selectedPages.delete(pageNumber);
        } else {
          item.selectedPages.add(pageNumber);
        }
        renderMergeList();
        await renderMergePreview();
        updateControls();
      });
      pageGrid.append(pageButton);
    }

    row.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/merge-file-index", String(index));
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", async (event) => {
      event.preventDefault();
      row.classList.remove("drag-over");
      const fromIndex = Number(event.dataTransfer.getData("text/merge-file-index"));
      if (Number.isNaN(fromIndex)) return;
      moveArrayItem(state.mergeFiles, fromIndex, index);
      state.mergePageOrder = getNaturalSelectedMergePages();
      renderMergeList();
      await renderMergePreview();
      updateControls();
    });

    els.mergeList.append(row);
  });
  updateControls();
}

async function renderMergePreview() {
  const runId = (mergePreviewRun += 1);
  const selectedPages = getSelectedMergePages();
  els.mergePreview.innerHTML = "";

  if (!selectedPages.length) {
    els.mergePreview.innerHTML = '<p class="preview-empty">Select pages to see the final merge preview.</p>';
    updateControls();
    return;
  }

  for (let index = 0; index < selectedPages.length; index += 1) {
    const { item, pageNumber } = selectedPages[index];
    if (runId !== mergePreviewRun) return;
    const card = document.createElement("article");
    card.className = "preview-card";
    card.draggable = true;
    card.dataset.index = String(index);
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "preview-canvas-wrap";
    const label = document.createElement("span");
    label.textContent = `${index + 1}. ${item.file.name} | Page ${pageNumber}`;
    card.append(canvasWrap, label);
    els.mergePreview.append(card);

    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/merge-page-index", String(index));
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", async (event) => {
      event.preventDefault();
      card.classList.remove("drag-over");
      const fromIndex = Number(event.dataTransfer.getData("text/merge-page-index"));
      if (Number.isNaN(fromIndex)) return;
      syncMergePageOrder();
      moveArrayItem(state.mergePageOrder, fromIndex, index);
      await renderMergePreview();
      updateControls();
    });

    const page = await item.pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(130 / baseViewport.width, 160 / baseViewport.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    canvasWrap.append(canvas);
    await page.render({ canvasContext: context, viewport }).promise;
  }

  updateControls();
}

async function renderSplitPreview() {
  els.splitPreview.innerHTML = "";

  if (!state.splitFile) {
    els.splitPreview.innerHTML = '<p class="preview-empty">Open a PDF to preview and select pages.</p>';
    updateControls();
    return;
  }

  for (let pageNumber = 1; pageNumber <= state.splitFile.pageCount; pageNumber += 1) {
    const card = document.createElement("article");
    card.className = "preview-card selectable";
    card.classList.toggle("selected", state.splitFile.selectedPages.has(pageNumber));
    const canvasWrap = document.createElement("div");
    canvasWrap.className = "preview-canvas-wrap";
    const label = document.createElement("span");
    label.textContent = `Page ${pageNumber}`;
    card.append(canvasWrap, label);
    els.splitPreview.append(card);

    card.addEventListener("click", () => {
      if (state.splitFile.selectedPages.has(pageNumber)) {
        state.splitFile.selectedPages.delete(pageNumber);
      } else {
        state.splitFile.selectedPages.add(pageNumber);
      }
      renderSplitPreview();
      updateControls();
    });

    const page = await state.splitFile.pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(130 / baseViewport.width, 160 / baseViewport.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    canvasWrap.append(canvas);
    await page.render({ canvasContext: context, viewport }).promise;
  }

  updateControls();
}

function renderPhotoList() {
  els.photoList.innerHTML = "";
  if (!state.photoFiles.length) return;

  state.photoFiles.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "file-item";
    row.draggable = true;
    row.dataset.index = String(index);
    row.innerHTML = `
      <img class="photo-thumb" src="${item.url}" alt="" />
      <div class="file-meta">
        <strong>${escapeHtml(item.file.name)}</strong>
        <span>${formatBytes(item.file.size)} | Page ${index + 1} | Drag to reorder</span>
      </div>
      <div class="file-actions">
        <button class="mini-button" type="button" data-action="up" title="Move up">Up</button>
        <button class="mini-button" type="button" data-action="down" title="Move down">Down</button>
        <button class="mini-button" type="button" data-action="remove" title="Remove">X</button>
      </div>
    `;

    row.querySelector('[data-action="up"]').disabled = index === 0;
    row.querySelector('[data-action="down"]').disabled = index === state.photoFiles.length - 1;
    row.querySelector('[data-action="up"]').addEventListener("click", () => {
      moveItem(state.photoFiles, index, -1);
      renderPhotoList();
    });
    row.querySelector('[data-action="down"]').addEventListener("click", () => {
      moveItem(state.photoFiles, index, 1);
      renderPhotoList();
    });
    row.querySelector('[data-action="remove"]').addEventListener("click", () => {
      const [removed] = state.photoFiles.splice(index, 1);
      URL.revokeObjectURL(removed.url);
      renderPhotoList();
      updateControls();
    });

    row.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/photo-index", String(index));
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      row.classList.add("drag-over");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("drag-over");
      const fromIndex = Number(event.dataTransfer.getData("text/photo-index"));
      if (Number.isNaN(fromIndex)) return;
      moveArrayItem(state.photoFiles, fromIndex, index);
      renderPhotoList();
      updateControls();
    });

    els.photoList.append(row);
  });
}

async function mergePdfs() {
  const selectedPages = getSelectedMergePages();
  if (!window.PDFLib || selectedPages.length === 0) return;

  setBusy(true);
  try {
    const { PDFDocument } = window.PDFLib;
    const merged = await PDFDocument.create();
    const sourceDocs = new Map();

    for (const { item, pageNumber } of selectedPages) {
      if (!sourceDocs.has(item.id)) {
        sourceDocs.set(item.id, await PDFDocument.load(item.bytes.slice(0)));
      }
      const source = sourceDocs.get(item.id);
      const [copiedPage] = await merged.copyPages(source, [pageNumber - 1]);
      merged.addPage(copiedPage);
    }

    const bytes = await merged.save();
    downloadBytes(bytes, "merged-document.pdf");
    showToast("Merged PDF saved.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not merge those PDFs.");
  } finally {
    setBusy(false);
    updateControls();
  }
}

async function splitPdf() {
  if (!window.PDFLib || !state.splitFile || state.splitFile.selectedPages.size === 0) return;

  setBusy(true);
  try {
    const { PDFDocument } = window.PDFLib;
    const source = await PDFDocument.load(state.splitFile.bytes.slice(0));
    const output = await PDFDocument.create();
    const pageIndices = Array.from(state.splitFile.selectedPages)
      .sort((a, b) => a - b)
      .map((pageNumber) => pageNumber - 1);
    const copiedPages = await output.copyPages(source, pageIndices);
    copiedPages.forEach((page) => output.addPage(page));

    const bytes = await output.save();
    downloadBytes(bytes, "split-document.pdf");
    showToast("Selected pages exported.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not split that PDF.");
  } finally {
    setBusy(false);
    updateControls();
  }
}

function getPhotoPageSize(image, preset) {
  if (preset === "a4") return [595.28, 841.89];
  if (preset === "letter") return [612, 792];
  return [image.width, image.height];
}

async function photosToPdf() {
  if (!window.PDFLib || state.photoFiles.length === 0) return;

  setBusy(true);
  try {
    const { PDFDocument } = window.PDFLib;
    const doc = await PDFDocument.create();
    const preset = els.photoPageSize.value;

    for (const item of state.photoFiles) {
      const bytes = await item.file.arrayBuffer();
      const image = item.file.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const [pageWidth, pageHeight] = getPhotoPageSize(image, preset);
      const page = doc.addPage([pageWidth, pageHeight]);
      const margin = preset === "image" ? 0 : 36;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;
      const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;

      page.drawImage(image, {
        x: (pageWidth - width) / 2,
        y: (pageHeight - height) / 2,
        width,
        height,
      });
    }

    const bytes = await doc.save();
    downloadBytes(bytes, "photos.pdf");
    showToast("Photos converted to PDF.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not convert those photos.");
  } finally {
    setBusy(false);
    updateControls();
  }
}

async function rerenderWithScale(nextScale) {
  if (!state.pdf) return;
  state.scale = Math.min(2.4, Math.max(0.75, nextScale));
  const currentFile = new File([state.originalBytes], state.fileName, { type: "application/pdf" });
  const edits = new Map(state.edits);
  const activePage = state.activePage;

  await loadPdf(currentFile);

  state.edits = edits;
  state.activePage = activePage;
  for (const edit of state.edits.values()) {
    const box = document.querySelector(`[data-id="${edit.id}"]`);
    if (!box) continue;
    box.value = edit.text;
    box.classList.add("changed");
    box.style.fontSize = `${edit.fontSize * state.scale}px`;
    box.style.setProperty("--box-color", edit.textColor);
    box.style.setProperty("--box-cover", edit.coverColor);
  }
  updateActivePage();
  document.querySelector(`#page-${activePage}`)?.scrollIntoView({ block: "start" });
}

function setupDropZone() {
  ["dragenter", "dragover"].forEach((eventName) => {
    els.emptyState.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.emptyState.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    els.emptyState.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.emptyState.classList.remove("dragging");
    });
  });

  els.emptyState.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    loadPdf(file);
  });
}

function setupFileDropzone(dropzone, onFiles) {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    onFiles(event.dataTransfer.files);
  });
}

function setupScrollSpy() {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      state.activePage = Number(visible.target.dataset.pageNumber);
      updateActivePage();
    },
    { root: document.querySelector(".editor"), threshold: [0.25, 0.55, 0.85] },
  );

  const watchPages = () => {
    document.querySelectorAll(".pdf-page").forEach((page) => observer.observe(page));
  };

  return watchPages;
}

const watchPages = setupScrollSpy();
setupDropZone();
setupFileDropzone(els.mergeDropzone, addMergeFiles);
setupFileDropzone(els.splitDropzone, (files) => loadSplitPdf(files[0]));
setupFileDropzone(els.photoDropzone, addPhotoFiles);
switchMode("home");
loadSavedUser();
updateControls();

els.loginButton.addEventListener("click", openLoginDialog);
els.userChip.addEventListener("click", openLoginDialog);
els.closeLogin.addEventListener("click", closeLoginDialog);
els.logoutButton.addEventListener("click", () => {
  state.user = null;
  localStorage.removeItem(userStorageKey);
  renderUser();
  showToast("Signed out.");
});
els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = els.loginEmail.value.trim();
  const name = els.loginName.value.trim() || email.split("@")[0];
  if (!email) {
    showToast("Enter your email address.");
    return;
  }
  saveUser({ provider: "Email", email, name });
  closeLoginDialog();
  showToast(`Signed in as ${name}.`);
});
els.socialButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const provider = button.dataset.provider;
    saveUser({
      provider,
      email: `${provider.toLowerCase()}-user@example.com`,
      name: `${provider} User`,
    });
    closeLoginDialog();
    showToast(`Signed in with ${provider}.`);
  });
});
els.modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => switchMode(tab.dataset.mode));
});
document.querySelectorAll("[data-open-mode]").forEach((card) => {
  card.addEventListener("click", () => switchMode(card.dataset.openMode));
});
els.fileInput.addEventListener("change", (event) => loadPdf(event.target.files[0]));
els.emptyFileInput.addEventListener("change", (event) => loadPdf(event.target.files[0]));
els.saveButton.addEventListener("click", savePdf);
els.mergeInput.addEventListener("change", (event) => addMergeFiles(event.target.files));
els.mergeEmptyInput.addEventListener("change", (event) => addMergeFiles(event.target.files));
els.mergeButton.addEventListener("click", mergePdfs);
els.splitInput.addEventListener("change", (event) => loadSplitPdf(event.target.files[0]));
els.splitEmptyInput.addEventListener("change", (event) => loadSplitPdf(event.target.files[0]));
els.splitButton.addEventListener("click", splitPdf);
els.splitSelectAll.addEventListener("click", async () => {
  if (!state.splitFile) return;
  state.splitFile.selectedPages = new Set(Array.from({ length: state.splitFile.pageCount }, (_, index) => index + 1));
  await renderSplitPreview();
});
els.splitSelectNone.addEventListener("click", async () => {
  if (!state.splitFile) return;
  state.splitFile.selectedPages.clear();
  await renderSplitPreview();
});
els.photoInput.addEventListener("change", (event) => addPhotoFiles(event.target.files));
els.photoEmptyInput.addEventListener("change", (event) => addPhotoFiles(event.target.files));
els.photosButton.addEventListener("click", photosToPdf);
els.zoomIn.addEventListener("click", () => rerenderWithScale(state.scale + 0.15));
els.zoomOut.addEventListener("click", () => rerenderWithScale(state.scale - 0.15));
els.fontSize.addEventListener("input", applyStyleToSelected);
els.textColor.addEventListener("input", applyStyleToSelected);
els.coverColor.addEventListener("input", () => {
  if (state.selectedBox) trackEdit(state.selectedBox);
});

const originalRenderPage = renderPage;
renderPage = async function renderPageAndWatch(pageNumber) {
  await originalRenderPage(pageNumber);
  watchPages();
};
