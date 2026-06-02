(function () {
  "use strict";

  const FT = window.QR_FILE;
  const $ = (sel) => document.querySelector(sel);

  let activeTab = "text";
  let uploadFile = null;
  let lastResult = null;

  const toastEl = $("#toast");
  const qrImage = $("#qrImage");
  const qrPlaceholder = $("#qrPlaceholder");
  const qrActions = $("#qrActions");
  const scanLink = $("#scanLink");
  const btnGenerate = $("#btnGenerate");

  function showToast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (type ? " " + type : "");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove("show"), 3200);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function setTab(name) {
    activeTab = name;
    document.querySelectorAll(".tab").forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelectorAll(".panel").forEach((p) => {
      const on = p.id === "panel-" + name;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
  }

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  const textBody = $("#textBody");
  const charCount = $("#charCount");
  textBody.addEventListener("input", () => {
    charCount.textContent = textBody.value.length;
  });

  function setupDropzone(zone, input, onFile) {
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => {
      if (input.files[0]) onFile(input.files[0]);
    });
    ["dragenter", "dragover"].forEach((ev) => {
      zone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      zone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove("dragover");
      });
    });
    zone.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    });
  }

  function setFilePreview(file) {
    if (!FT.isAllowed(file)) {
      showToast(
        "File type not allowed. Try PNG, PDF, MP4, MP3, DOCX, TXT, ZIP, etc. Programs (.exe, .js) are blocked.",
        "error"
      );
      return;
    }
    if (file.size > FT.maxBytes) {
      showToast("File must be " + FT.maxBytes / (1024 * 1024) + " MB or smaller.", "error");
      return;
    }

    uploadFile = file;
    const cat = FT.category(file);
    const ext = FT.ext(file.name).toUpperCase() || "?";

    $("#fileIcon").textContent = FT.icons[cat] || "📎";
    $("#fileName").textContent = file.name;
    $("#fileSize").textContent = formatSize(file.size);
    $("#fileTypeTag").textContent = (FT.labels[cat] || "File") + " · ." + ext.toLowerCase();
    $("#fileExtBadge").textContent = ext;

    const thumb = $("#fileThumb");
    if (cat === "image") {
      thumb.src = URL.createObjectURL(file);
      thumb.hidden = false;
      $("#fileThumbWrap").classList.add("has-image");
    } else {
      thumb.hidden = true;
      thumb.removeAttribute("src");
      $("#fileThumbWrap").classList.remove("has-image");
    }

    $("#filePreview").classList.add("visible");
  }

  setupDropzone($("#dropFile"), $("#fileInput"), setFilePreview);

  $("#clearFile").addEventListener("click", (e) => {
    e.stopPropagation();
    uploadFile = null;
    $("#fileInput").value = "";
    $("#filePreview").classList.remove("visible");
    $("#fileThumb").hidden = true;
  });

  function showQr(id, payload, scanUrl, embedInQr, fileLabel, opensDirectly) {
    const qrUrl =
      "/api/qr/" + encodeURIComponent(id) + ".png?payload=" + encodeURIComponent(payload);
    qrImage.src = qrUrl;
    qrImage.hidden = false;
    qrPlaceholder.hidden = true;
    qrActions.classList.add("visible");
    scanLink.value = scanUrl;
    if (embedInQr) {
      $("#qrHint").textContent = "QR contains your text directly (works offline).";
    } else if (opensDirectly) {
      $("#qrHint").textContent =
        "Scan opens your " +
        (fileLabel || "image").toLowerCase() +
        " directly. Phone must be on the same Wi‑Fi as this PC.";
    } else {
      $("#qrHint").textContent =
        "Scan opens your file. Phone must be on the same Wi‑Fi as this PC.";
    }
    lastResult = { id, payload, scanUrl, qrUrl };
  }

  async function apiJson(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
    return data;
  }

  btnGenerate.addEventListener("click", async () => {
    btnGenerate.disabled = true;
    const oldHtml = btnGenerate.innerHTML;
    btnGenerate.innerHTML = '<span class="spinner"></span> Generating…';

    try {
      if (activeTab === "text") {
        const text = textBody.value.trim();
        if (!text) {
          showToast("Enter some text first.", "error");
          return;
        }
        const data = await apiJson("/api/create/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, title: $("#textTitle").value.trim() }),
        });
        showQr(data.id, data.qrPayload, data.viewUrl || data.scanUrl, data.embedInQr);
        showToast("QR code ready!", "success");
      } else {
        if (!uploadFile) {
          showToast("Add a file first (drag & drop or browse).", "error");
          return;
        }
        const fd = new FormData();
        fd.append("file", uploadFile);
        fd.append("title", $("#fileTitle").value.trim());
        const data = await apiJson("/api/create/file", { method: "POST", body: fd });
        const cat = FT.category(uploadFile);
        showQr(
          data.id,
          data.qrPayload,
          data.scanUrl || data.qrPayload,
          false,
          FT.labels[cat] || "File",
          data.opensDirectly
        );
        showToast("QR ready for " + (data.originalName || "your file") + "!", "success");
      }
    } catch (err) {
      showToast(err.message || "Something went wrong.", "error");
    } finally {
      btnGenerate.disabled = false;
      btnGenerate.innerHTML = oldHtml;
    }
  });

  $("#btnDownload").addEventListener("click", () => {
    if (!lastResult) return;
    const a = document.createElement("a");
    a.href = lastResult.qrUrl;
    a.download = "qr-" + lastResult.id + ".png";
    a.click();
    showToast("Download started.", "success");
  });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard.", "success");
    } catch {
      showToast("Could not copy — select the link manually.", "error");
    }
  }

  $("#btnCopyLink").addEventListener("click", () => {
    if (lastResult) copyText(lastResult.scanUrl);
  });
  $("#btnCopyInput").addEventListener("click", () => copyText(scanLink.value));

  fetch("/api/formats")
    .then((r) => r.json())
    .then((d) => {
      if (d.maxFileMb) $("#maxMb").textContent = d.maxFileMb;
      const sample = "PNG, JPG, PDF, MP4, MP3, DOCX, XLSX, TXT, CSV, ZIP, and more";
      $("#formatsHint").textContent = "Supported: " + sample + " (max " + (d.maxFileMb || 25) + " MB). No .exe or .js.";
    })
    .catch(() => {
      $("#formatsHint").textContent =
        "Supported: PNG, JPG, PDF, MP4, MP3, DOCX, TXT, ZIP, and more (max 25 MB).";
    });

  fetch("/api/health")
    .then((r) => r.json())
    .then((d) => {
      const el = $("#urlBadge");
      const alert = $("#scanAlert");
      if (d.maxFileMb) $("#maxMb").textContent = d.maxFileMb;
      if (d.usesLocalhost) {
        el.innerHTML = "Scan URL: <strong>localhost (won’t work on phone)</strong>";
        alert.hidden = false;
      } else {
        el.innerHTML =
          "Scan from phone uses: <strong>" + d.publicUrl + "</strong> (same Wi‑Fi)";
        alert.hidden = true;
      }
    })
    .catch(() => {
      $("#urlBadge").textContent = "Start server with: npm start";
    });
})();
