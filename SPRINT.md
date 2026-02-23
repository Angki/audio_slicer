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
- [ ] `feat: add waveform overview/minimap` — _Deferred: WaveSurfer 7 MinimapPlugin API belum stabil_

---

## 🔲 Day 3 — Smart Import & Parser (24 Feb)

- [ ] `feat: parser support bracket timestamp format` — `[0:00] Track Name`
- [ ] `feat: parser support trailing duration format` — `Track 01 - Name - 3:45`
- [ ] `fix: strip BOM from pasted text` — Bersihkan BOM di clipboard
- [ ] `feat: show track count preview before import` — Tampilkan jumlah track sebelum apply
- [ ] `feat: add append-mode option in Smart Import` — Tambahkan ke marker (bukan ganti)
- [ ] `feat: warn if imported tracks exceed audio duration` — Warning jika melebihi durasi
- [ ] `fix: trim whitespace from imported track names` — Trim whitespace nama track
- [ ] `feat: Ctrl+I shortcut for Smart Import` — Shortcut buka Smart Import
- [ ] `feat: copy tracklist to clipboard` — Tombol copy tracklist
- [ ] `feat: drag txt/cue file into Smart Import` — Drag file txt/cue
- [ ] `feat: basic CUE sheet parser` — Parser CUE sederhana
- [ ] `fix: improve Smart Import error messages` — Pesan error lebih deskriptif
- [ ] `feat: Smart Import history / recent imports` — History 5 import terakhir
- [ ] `style: fix Smart Import modal responsive layout` — Responsive layout modal
- [ ] `feat: loading spinner on Parse button` — Spinner saat parsing
- [ ] `feat: persist Smart Import textarea content` — Simpan isi textarea ke localStorage

---

## 🔲 Day 4 — Export Engine & Backend (25 Feb)

- [ ] `feat: per-track export progress via IPC` — Progress per-track via IPC event
- [ ] `feat: export progress bar UI` — Progress bar di UI saat export
- [ ] `feat: show ETA during export` — Estimasi waktu export
- [ ] `feat: copy output path to clipboard` — Salin path output
- [ ] `fix: track artist not passed correctly to export` — Fix track artist bug
- [ ] `feat: export option split by excluded regions` — Export per exclusion region
- [ ] `feat: validate output dir writable before export` — Validasi output path sebelum mulai
- [ ] `feat: auto-retry on single track export failure` — Retry otomatis jika 1 track gagal
- [ ] `feat: write export log to file` — Log export ke file
- [ ] `feat: optional audio normalization on export` — Normalisasi volume
- [ ] `fix: write genre and comment tags for FLAC` — Fix genre/comment di FLAC
- [ ] `feat: open individual exported track from result` — Buka track dari hasil export
- [ ] `feat: show total export duration summary` — Total durasi yang di-export
- [ ] `feat: support AlbumArtist tag in export` — Tag Album Artist
- [ ] `feat: add output sample rate selector` — Pilihan sample rate output
- [ ] `feat: embed cover art from local image file` — Embed cover art dari file gambar
- [ ] `feat: persist export settings to localStorage` — Simpan setting export

---

## 🔲 Day 5 — Settings, Packaging & QA (26 Feb)

- [ ] `feat: add Settings panel` — Halaman/panel Settings
- [ ] `feat: setting for default export format` — Default format export
- [ ] `feat: setting for default output directory` — Default direktori output
- [ ] `feat: setting for waveform color theme` — Tema warna waveform
- [ ] `feat: persist settings with electron-store` — Simpan ke electron-store
- [ ] `feat: add About dialog` — Halaman About (versi, lisensi)
- [ ] `feat: keyboard shortcut reference` — Referensi keyboard shortcut
- [ ] `feat: add electron-updater stub` — Stub auto-updater
- [ ] `docs: update README with screenshots` — README lengkap dengan screenshot
- [ ] `test: manual QA full flow WAV` — QA flow lengkap drag → detect → export
- [ ] `test: manual QA CUE import` — QA Smart Import dari CUE file
- [ ] `test: manual QA excluded regions export` — QA excluded regions export
- [ ] `fix: [QA] bug dari test flow` — Bug dari QA #1
- [ ] `fix: [QA] bug dari CUE import` — Bug dari QA #2
- [ ] `fix: [QA] excluded region edge case` — Bug dari QA #3
- [ ] `feat: set app icon` — Icon .ico untuk Electron
- [ ] `build: configure Windows installer` — Konfigurasi electron-builder
- [ ] `build: first successful Windows build` — Build pertama
- [ ] `release: v0.1.0` — Tag release
- [ ] `docs: update CHANGELOG for v0.1.0` — Update CHANGELOG
