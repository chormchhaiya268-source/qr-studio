/** Client-side file rules (keep in sync with server FILE_TYPES) */
window.QR_FILE = {
  maxBytes: 25 * 1024 * 1024,
  blocked: new Set([
    "exe", "bat", "cmd", "com", "msi", "dll", "scr", "vbs", "ps1", "sh",
    "js", "mjs", "cjs", "html", "htm", "php", "asp", "aspx", "jar", "apk",
  ]),
  icons: {
    image: "🖼️",
    pdf: "📄",
    video: "🎬",
    audio: "🎵",
    document: "📝",
    archive: "📦",
    file: "📎",
  },
  labels: {
    image: "Image",
    pdf: "PDF",
    video: "Video",
    audio: "Audio",
    document: "Document",
    archive: "Archive",
    file: "File",
  },

  ext(name) {
    const i = name.lastIndexOf(".");
    return i < 0 ? "" : name.slice(i + 1).toLowerCase();
  },

  category(file) {
    const ext = this.ext(file.name);
    if (!ext || this.blocked.has(ext)) return null;
    const t = file.type || "";
    if (t.startsWith("image/")) return "image";
    if (t === "application/pdf" || ext === "pdf") return "pdf";
    if (t.startsWith("video/")) return "video";
    if (t.startsWith("audio/")) return "audio";
    if (t.startsWith("text/")) return "document";
    const docExt = ["txt", "csv", "json", "xml", "md", "rtf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "epub"];
    if (docExt.includes(ext)) return "document";
    const imgExt = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "heic", "heif"];
    if (imgExt.includes(ext)) return "image";
    const vidExt = ["mp4", "webm", "mov", "avi", "mkv", "m4v"];
    if (vidExt.includes(ext)) return "video";
    const audExt = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];
    if (audExt.includes(ext)) return "audio";
    const arcExt = ["zip", "rar", "7z"];
    if (arcExt.includes(ext)) return "archive";
    return "file";
  },

  isAllowed(file) {
    return this.category(file) !== null;
  },
};
