# AutoSlice — 5-Day Sprint Tasks
_File ini di-exclude dari git. Hanya untuk referensi lokal._

---

## ✅ Day 1 — UI Polish & Bug Fixes (22 Feb) — SELESAI
- [x] `chore: remove debug console.log`
- [x] `fix: remove duplicate state reset in loadFile`
- [x] `feat: contextual empty state message in tracklist`
- [x] `feat: add tooltips to toolbar buttons`
- [x] `style: add zebra stripe and hover accent border to tracklist`
- [x] `fix: formatDuration handles hours and null/NaN input`
- [x] `feat: Delete key removes nearest marker to cursor`
- [x] `feat: toast notification system with CSS animations`
- [x] `feat: export success triggers toast notification`
- [x] `style: animate tracklist row entry with fade-in slide`

---

## ✅ Day 2 — Waveform Interactions (23 Feb) — SELESAI

- [x] `feat: click track row to seek waveform` — Klik row tracklist → wavesurfer.setTime(start)
- [x] `feat: time tooltip on waveform hover` — Hover waveform tampilkan waktu
- [x] `feat: highlight active track region on waveform` — Highlight region track yang aktif
- [x] `feat: highlight playing track region in waveform` — Saat preview, highlight region di waveform
- [x] `feat: add Zoom Fit button` — Fit semua ke layar
- [x] `feat: Ctrl+scroll to zoom waveform` — Mouse wheel zoom
- [x] `feat: add EXCLUDED label on red regions` — Label "EXCLUDED" di region merah
- [x] `fix: improve double-click region detection tolerance` — Toleransi double-click
- [x] `feat: confirm before removing excluded region` — Konfirmasi hapus
- [x] `feat: show total excluded duration summary` — Summary total durasi yang di-exclude
- [x] `feat: E key toggles exclude drag mode` — Shortcut toggle mode exclude
- [x] `feat: show exclusion mode indicator badge` — Indikator visual mode exclude
- [x] `fix: detect overlapping excluded regions on drag` — Cegah overlap region
- [x] `feat: add Clear All Exclusions button` — Tombol hapus semua exclusion
- [x] `fix: clear excluded regions on new file load` — Reset saat file baru
- [x] `feat: Home/End shortcut to seek start/end` — Home/End key
- [x] `feat: sync playback position to tracklist highlight` — Highlight row sesuai posisi play
- [x] `feat: add waveform overview/minimap` — _Implemented using local minimap.esm.js_

---

## ✅ Day 3 — Smart Import & Parser (24 Feb) — SELESAI

- [x] `feat: parser support bracket timestamp format`
- [x] `feat: parser support trailing duration format`
- [x] `fix: strip BOM from pasted text`
- [x] `feat: show track count preview before import`
- [x] `feat: add append-mode option in Smart Import`
- [x] `feat: warn if imported tracks exceed audio duration`
- [x] `fix: trim whitespace from imported track names`
- [x] `feat: Ctrl+I shortcut for Smart Import`
- [x] `feat: copy tracklist to clipboard`
- [x] `feat: drag txt/cue file into Smart Import`
- [x] `feat: basic CUE sheet parser`
- [x] `fix: improve Smart Import error messages`
- [x] `feat: Smart Import history / recent imports`
- [x] `style: fix Smart Import modal responsive layout`
- [x] `feat: loading spinner on Parse button`
- [x] `feat: persist Smart Import textarea content`

---

## ✅ Day 4 — Export Engine & Backend (25 Feb) — SELESAI

- [x] `feat: per-track export progress via IPC`
- [x] `feat: export progress bar UI`
- [x] `feat: show ETA during export`
- [x] `feat: copy output path to clipboard`
- [x] `fix: track artist not passed correctly to export`
- [x] `feat: export option split by excluded regions`
- [x] `feat: validate output dir writable before export`
- [x] `feat: auto-retry on single track export failure`
- [x] `feat: write export log to file`
- [x] `feat: optional audio normalization on export`
- [x] `fix: write genre and comment tags for FLAC`
- [x] `feat: open individual exported track from result`
- [x] `feat: show total export duration summary`
- [x] `feat: support AlbumArtist tag in export`
- [x] `feat: add output sample rate selector`
- [x] `feat: embed cover art from local image file`
- [x] `feat: persist export settings to localStorage`

---

## ✅ Day 5 — Settings, Packaging & QA (26 Feb) — SELESAI

- [x] `feat: add Settings panel`
- [x] `feat: setting for default export format`
- [x] `feat: setting for default output directory`
- [x] `feat: setting for waveform color theme`
- [x] `feat: persist settings with electron-store`
- [x] `feat: add About dialog`
- [x] `feat: keyboard shortcut reference`
- [x] `feat: add electron-updater stub`
- [x] `docs: update README with screenshots`
- [x] `test: manual QA full flow WAV`
- [x] `test: manual QA CUE import`
- [x] `test: manual QA excluded regions export`
- [x] `fix: [QA] bug dari test flow`
- [x] `fix: [QA] bug dari CUE import`
- [x] `fix: [QA] excluded region edge case`
- [x] `feat: set app icon`
- [x] `build: configure Windows installer`
- [x] `build: first successful Windows build`
- [x] `release: v0.1.0`
- [x] `docs: update CHANGELOG for v0.1.0`

---
## 🚀 v1.0.0: The Next 10-Day Sprint (Batch Processing & Advanced Audio Features)

Berikut adalah ide terstruktur untuk sprint pengembangan AutoSlice selanjutnya (versi 1.0.0), yang difokuskan pada pemrosesan batch, kualitas audio tingkat lanjut, dan automasi.

### 📅 Week 1: Core Audio Advancements & Integrations
**Day 6 — Percission Audio & Navigation**
- [ ] `feat: snap to zero-crossing` — secara otomatis menggeser marker yang diletakkan pengguna ke titik zero-crossing terdekat pada buffer audio untuk mencegah *clipping/clicking* saat diekspor.
- [ ] `feat: zoom-to-marker` — klik ganda pada area marker untuk langsung melakukan *deep zoom* ke titik pemotongan.
- [ ] `perf: large file optimization` — optimasi rendering WaveSurfer untuk file yang durasinya sangat panjang (>2 jam).

**Day 7 — Excluded Region Crossfading & Transcoding**
- [ ] `feat: crossfade generator for excluded regions` — alih-alih melakukan *hard-cut* menggunakan `atrim`, terapkan *smooth crossfade* (10-50ms) menggunakan filter FFmpeg `afade` / `acrossfade` untuk menyembunyikan transisi yang dipotong.
- [ ] `feat: transcode-only / format-shift mode` — mode baru di UI yang memungkinkan pengguna mengekspor keseluruhan file ke format berbeda (misal: FLAC ke MP3 320kbps plus *Loudness Normalization*) tanpa memotong (*slicing*).

**Day 8 — Advanced Metadata & API Integrations**
- [ ] `feat: MusicBrainz API integration` — tambahkan opsi pencarian database dari MusicBrainz sebagai alternatif yang terkadang lebih akurat daripada Discogs untuk rilis spesifik.
- [ ] `feat: Auto-fetch cover art` — API untuk mengambil *cover art* spesifik secara otomatis dari Discogs/MusicBrainz dan memasukkannya ke kolom gambar cover.

**Day 9 — BPM Detection for DJ Tagging**
- [ ] `feat: auto-bpm calculation module` — hitung estimasi Tempo/BPM setiap *slice* menggunakan algoritma lokal atau `web-audio-beat-detector`.
- [ ] `feat: burn BPM tag to ID3` — integrasi hasil perhitungan BPM ke argumen FFmpeg/NodeId3 untuk di-*burn* ke meta-tag MP3/FLAC saat diekspor.

**Day 10 — Save/Load Projects & Session Persistence**
- [ ] `feat: save .slice project files` — buat opsi "Save Project" untuk menyimpan *path* file audio, posisi marker, metadata track, dan region yang di-*exclude* ke format JSON `.slice`.
- [ ] `feat: load .slice project files` — izinkan drag-n-drop file proyek `.slice` untuk melanjutkan pekerjaan yang belum selesai.

---
### 📅 Week 2: Batch Operations & Deep Automations
**Day 11 — The Batch Processing UI**
- [ ] `feat: bulk folder import mode` — tambahkan tab/tombol baru untuk "Process Folder" yang memungkinkan _import_ massal file-file panjang (mis. 10 *side* piringan hitam sekaligus).
- [ ] `feat: batch queue UI & state` — buat *grid layout* (tabel) yang menampilkan status dari seluruh file yang mengantri (*Pending*, *Detecting*, *Exporting*, *Done*).

**Day 12 — Headless Silence Detection Engine**
- [ ] `feat: recursive silence detection` — buat mesin *headless* (tanpa WaveSurfer) yang menggunakan `ffmpeg silendedetect` di latar belakang untuk men-*scan* setiap file di *Batch Queue* berdasarkan parameter Threshold yang disetel sebelumnya secara berurutan.
- [ ] `feat: batch export orchestration` — integrasikan pemanggilan `ExportService.exportTracks` agar berjalan secara otomatis mengikuti hasil deteksi.

**Day 13 — Fuzzy Logic Tracklist Mapping (The AI Touch)**
- [ ] `feat: fuzzy length ratio matcher` — saat meng-import dari CUE/Teks ke sejumlah marker otomatis, sesuaikan secara proporsional posisi penanda jika terjadi ketidakkonsistenan durasi dengan rasio kecocokan jarak.
- [ ] `feat: OCR / image-to-text integration` — izinkan pengguna untuk *paste* gambar sampul belakang kaset/vinyl, lalu terjemahkan teksnya menggunakan `tesseract.js` lokal menjadi teks daftar lagu.

**Day 14 — i18n Translation & Accessibility**
- [ ] `i18n: system integration` — susun *mapping* kamus bahasa (ID, EN).
- [ ] `i18n: context menus and UI switch` — tambahkan *dropdown* bahasa di menu pengaturan, otomatis terapkan di seluruh UI tanpa perlu *reload*.

**Day 15 — Final v1.0.0 Quality Tests & Automation**
- [ ] `test: E2E batch folder testing` — pastikan komputer tetap responsif saat mengonversi/memotong berjam-jam file audio di *background*.
- [ ] `release: build and ship v1.0.0 executables` — pembaruan mayor v1.0.0 dengan fitur Batch yang utuh.
