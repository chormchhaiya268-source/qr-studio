# QR Studio

HTML/CSS/JavaScript front end with a small Node server for uploads and QR images.

## Features

- **Text** — up to 2000 characters; short text embeds directly in the QR
- **Any file** — one drop zone for PNG, JPG, PDF, MP4, MP3, DOCX, XLSX, TXT, ZIP, and more (max 25 MB)
- **Scan page** — mobile-friendly viewer at `/v/{id}`
- **No API keys** — runs locally on your PC

## Run

```bash
cd qr-studio
npm install
npm start
```

Open **http://localhost:3847**

## Host online (GitHub + Render)

GitHub stores the code, but **GitHub Pages cannot run this app** (it needs Node for uploads + QR generation).

### Deploy on Render (recommended)

- **Step 1**: Create a GitHub repo and push this `qr-studio` folder.
- **Step 2**: On Render, create a **New Web Service** from your GitHub repo.
  - Render will auto-detect `Dockerfile`.
- **Step 3**: After Render gives you a URL like `https://your-app.onrender.com`, set this environment variable in Render:
  - **PUBLIC_URL** = `https://your-app.onrender.com`
- **Step 4**: Re-deploy (or restart) the service.

Now every QR will point to your online domain, so scanning works anywhere.

### Important note about uploads

Most free hosts use **ephemeral disk**, meaning uploaded files may be deleted on redeploy/restart.
If you want uploads to be permanent, tell me what host you’ll use and I’ll add:
- **persistent disk/volume** configuration (if supported), or
- cloud storage (S3/R2/Cloudinary) for uploads.

## Scan from your phone

Phones must reach your PC over the network. Find your PC’s IP (e.g. `192.168.1.5`), then:

**Windows PowerShell:**

```powershell
$env:PUBLIC_URL="http://192.168.1.5:3847"
npm start
```

Use the same Wi‑Fi on phone and PC. Generate a photo/PDF QR, scan it, and the link should open.

## Stack

- HTML5, CSS3, vanilla JavaScript
- Node.js, Express, Multer, qrcode
