# Notion UI reference (dark mode Library page)

Sumber: tangkapan layar `app.notion.com/library/teamspaces?...` (Notion dark mode).
Semua ukuran adalah estimasi dari layar 1920×1080. Teks UI ditulis asli (bahasa Inggris).

## Palet dan tipografi
- Latar konten: `#191919` (paling gelap)
- Latar sidebar: `#202020` (sedikit lebih terang)
- Popup menu: `#252525`, border `rgba(255,255,255,0.1)`, radius ±8–10px, shadow lembut
- Teks utama: putih (`#ffffffcf`–`#fff`)
- Teks sekunder / ikon: abu `#9b9b9b`
- Hover / aktif: `rgba(255,255,255,0.055)`
- Pill tab aktif: ±`#2f2f2f`
- Aksen biru: `#2383e2` (tombol New teamspace)
- Badge notifikasi: merah kecil berisi "4" di ikon inbox
- Font: Inter / `ui-sans-serif` / Segoe UI
- Ukuran: item 14px, label section 12px abu, judul "Library" ±32px bold

## Sidebar (lebar ±270px)
Baris atas (±y 143): toggle sidebar (x≈26), inbox + badge merah "4" (x≈213), compose (x≈244).
- Search "Search or ask" + chip `Ctrl+K` (y≈181)
- Nav cepat: pill **Home** (aktif), ikon chat, ikon kalender (y≈225)
- **New chat** (y≈269)
- **Library** — aktif, latar sorot penuh (y≈300)
- Label `Upcoming events` + `Connect your calendar` (y≈342/373)
- **Teamspaces** label (y≈419); item `Team 6 HQ` + anak berindentasi 31px tiap:
  - Tasks, Tasks, Projects, Wiki, Meetings, Docs, TEAM ROLES (y≈449–667)
- **Private** label (y≈714); `Getting Started`, `TEAM 7`, `+ Add new` (y≈745–807)
- Footer (±y 1012–1057): `Customize sidebar`, switcher `T Team 6`, ikon bantuan, ikon grid (popup)

## Popup menu (dari ikon grid footer)
Lebar ±240px, tinggi ±182px: `Library`, `AI Meeting Notes`, `Skills`, `My Tasks`, `Marketplace` (hover), `Trash`.

## Konten utama (Latar #191919)
- Judul **Library** (~32px bold, kiri); tombol biru **New teamspace** (kanan atas)
- Tab filter: `Teamspaces` (aktif, pill), `Recents`, `Favorites`, `Shared`, `Private`, `AI Meeting Notes`, `Skills`, ikon kaca pembesar kanan
- Tabel: kolom `Name`, `Description`, `Access`, `Members`; satu baris `Team 6 HQ` | kosong | `Default` | `2`

## Elemen melayang
Tombol bulat kanan bawah (Notion AI, dekoratif).

## Rencana implementasi Juvio
1. Sidebar Notion (section, label, indentasi, ikon, footer, popup menu)
2. Halaman Library (`#/library`) dengan tab filter + tabel
3. Perbaiki routing hash agar `#/library` bekerja di samping `#/<pageId>` dan `#/trash`
