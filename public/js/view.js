(function () {
  "use strict";

  const FT = window.QR_FILE || {
    icons: { image: "🖼️", pdf: "📄", video: "🎬", audio: "🎵", document: "📝", archive: "📦", file: "📎" },
  };

  const match = window.location.pathname.match(/\/v\/([^/]+)/);
  const id = match ? match[1] : null;

  const loading = document.getElementById("loading");
  const contentWrap = document.getElementById("contentWrap");
  const errorWrap = document.getElementById("errorWrap");
  const viewTitle = document.getElementById("viewTitle");
  const viewContent = document.getElementById("viewContent");
  const viewActions = document.getElementById("viewActions");

  function fileSrc(entry) {
    return "/uploads/" + encodeURIComponent(entry.filename);
  }

  function addDownload(entry, label) {
    const dl = document.createElement("a");
    dl.className = "btn btn-secondary";
    dl.href = fileSrc(entry);
    dl.download = entry.originalName || "download";
    dl.textContent = label || "Download file";
    viewActions.appendChild(dl);
    return dl;
  }

  function addOpenTab(entry) {
    const open = document.createElement("a");
    open.className = "btn btn-secondary";
    open.href = fileSrc(entry);
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Open in new tab";
    viewActions.appendChild(open);
  }

  function showFileCard(entry) {
    const card = document.createElement("div");
    card.className = "file-card";
    const icon = FT.icons[entry.type] || FT.icons.file || "📎";
    const ext = (entry.ext || "").toUpperCase();
    card.innerHTML =
      '<div class="file-card-icon">' +
      icon +
      "</div>" +
      '<div class="file-card-meta">' +
      "<strong>" +
      escape(entry.originalName || entry.title || "File") +
      "</strong>" +
      "<span>" +
      (ext ? "." + ext.toLowerCase() + " · " : "") +
      formatSize(entry.size) +
      "</span>" +
      "<p>Preview not available in browser — download to open.</p>" +
      "</div>";
    viewContent.appendChild(card);
    addDownload(entry, "Download " + (entry.originalName || "file"));
    addOpenTab(entry);
  }

  function escape(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function formatSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  if (!id) {
    loading.hidden = true;
    errorWrap.hidden = false;
    return;
  }

  fetch("/api/entry/" + encodeURIComponent(id))
    .then((r) => {
      if (!r.ok) throw new Error("not found");
      return r.json();
    })
    .then((entry) => {
      loading.hidden = true;
      contentWrap.hidden = false;
      document.title = entry.title || "QR Content";
      viewTitle.textContent = entry.title || "Content";
      viewContent.innerHTML = "";
      viewActions.innerHTML = "";

      const type = entry.type === "image" ? "image" : entry.type;

      if (type === "text") {
        const p = document.createElement("div");
        p.className = "text-body";
        p.textContent = entry.text;
        viewContent.appendChild(p);
        return;
      }

      const src = fileSrc(entry);
      const mime = entry.mime || "";

      if (type === "image" || mime.startsWith("image/")) {
        const img = document.createElement("img");
        img.className = "photo";
        img.src = src;
        img.alt = entry.originalName || "Image";
        img.loading = "lazy";
        viewContent.appendChild(img);
        addDownload(entry, "Download image");
        return;
      }

      if (type === "pdf" || mime === "application/pdf") {
        const embed = document.createElement("embed");
        embed.src = src + "#toolbar=1";
        embed.type = "application/pdf";
        viewContent.appendChild(embed);
        addDownload(entry, "Download PDF");
        addOpenTab(entry);
        return;
      }

      if (type === "video" || mime.startsWith("video/")) {
        const video = document.createElement("video");
        video.className = "media-player";
        video.src = src;
        video.controls = true;
        video.playsInline = true;
        video.setAttribute("preload", "metadata");
        viewContent.appendChild(video);
        addDownload(entry, "Download video");
        return;
      }

      if (type === "audio" || mime.startsWith("audio/")) {
        const audio = document.createElement("audio");
        audio.className = "media-player audio";
        audio.src = src;
        audio.controls = true;
        viewContent.appendChild(audio);
        addDownload(entry, "Download audio");
        return;
      }

      const textLike =
        type === "document" &&
        (mime.startsWith("text/") ||
          ["txt", "csv", "md", "json", "xml"].includes((entry.ext || "").toLowerCase()));

      if (textLike && entry.size < 512 * 1024) {
        fetch(src)
          .then((r) => r.text())
          .then((text) => {
            const pre = document.createElement("pre");
            pre.className = "text-body code-preview";
            pre.textContent = text;
            viewContent.appendChild(pre);
          })
          .catch(() => showFileCard(entry));
        addDownload(entry, "Download file");
        addOpenTab(entry);
        return;
      }

      showFileCard(entry);
    })
    .catch(() => {
      loading.hidden = true;
      errorWrap.hidden = false;
    });
})();
