# Chupi Chat

Website chat untuk ngobrol dengan **ChupiGpt 2.0** ("Phoebe chupi") dan **GugugagaGpt 2** ("Gugu gaga").
Dibuat untuk mereka yang tidak mengerti coding dan cuma ingin langsung chat: buka, ketik, kirim.

- Tidak perlu daftar, tidak ada API, tidak ada server. Semua jalan di browser.
- Riwayat chat tersimpan di browser pengunjung (localStorage), tidak dikirim ke mana pun.
- Ganti model kapan saja lewat tombol di bagian atas.
- Tema terang dan gelap, tampilan nyaman di HP maupun desktop.

## Deploy ke Netlify

Website ini statis murni, tidak ada build step.

**Cara tercepat (drag & drop):**
1. Buka https://app.netlify.com/drop
2. Seret seluruh folder `chupi-chat` ke halaman itu.
3. Selesai, Netlify langsung memberi link.

**Lewat Git:** push folder ini ke GitHub, lalu di Netlify pilih *Add new site → Import an existing project*.
Kosongkan *Build command* dan isi *Publish directory* dengan `.` (sudah diatur di `netlify.toml`).

## Coba di komputer sendiri

Karena memakai file terpisah, sebaiknya dijalankan lewat server lokal, bukan klik dua kali:

```bash
npx serve .
```

## Struktur

```
index.html          halaman utama
css/style.css       tema kuning-putih + mode gelap
js/engine.js        engine ChupiGpt/GugugagaGpt versi browser (hasil port dari core.js)
js/icons.js         ikon SVG Lucide yang di-inline
js/app.js           logika chat, riwayat, ganti model, tema
js/theme-init.js    mencegah layar berkedip saat memuat tema
assets/             avatar Chupi dan Gugugaga, favicon
netlify.toml        header keamanan dan cache
test/engine.test.js node test/engine.test.js
```

## Kustomisasi cepat

- **Warna:** ubah variabel di bagian atas `css/style.css` (`--accent`, `--bg`, dan seterusnya).
- **Avatar:** ganti `assets/chupi.webp` dan `assets/gugugaga.webp` (gambar persegi, 256x256 sudah cukup).
- **Contoh pertanyaan di halaman awal:** edit daftar `SUGGESTIONS` di `js/app.js`.
- **Ikon:** semua ikon dari [Lucide](https://lucide.dev); tambah ikon baru di `js/icons.js`.

## Catatan

`js/engine.js` dibuat dari `ChupiGpt/src/core.js` dengan logika yang sama persis. Satu-satunya perbedaan:
`node:crypto` diganti SHA-256 buatan sendiri supaya bisa jalan di browser. Kalau `core.js` di project ChupiGpt
berubah, port ulang file ini.

Chupi dan Gugugaga adalah persona meme dari komunitas fandom (Phoebe dari Wuthering Waves dan Endmin dari
Arknights: Endfield), bukan karakter resmi.
