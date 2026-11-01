# Notion UI reference (dark mode Library page)

Sumber: tangkapan layar `app.notion.com/library/teamspaces?...` (Notion dark mode).
Semua ukuran adalah estimasi dari layar 1920×1080. Teks UI ditulis asli (bahasa Inggris).

> Status: implementasi Juvio mengikuti spesifikasi ini (lihat `src/styles.css`,
> `src/components/Sidebar.tsx`, `src/components/LibraryView.tsx`). Nilai yang
> harus berasal dari data nyata ditandai di bawah.

## Palet dan tipografi
- Latar konten: `#191919` (paling gelap)
- Latar sidebar: `#202020` (sedikit lebih terang)
- Popup menu: `#252525`, border `rgba(255,255,255,0.1)`, radius ±8–10px, shadow lembut
- Teks utama: putih (`#ffffffcf`–`#fff`)
- Teks sekunder / ikon: abu `#9b9b9b`
- Hover / aktif: `rgba(255,255,255,0.055)`
- Pill tab aktif: ±`#2f2f2f`
- Aksen biru: `#2383e2` (tombol New teamspace)
- Badge notifikasi: merah kecil berisi angka unread (data nyata, lihat "Data nyata")
- Font: Inter / `ui-sans-serif` / Segoe UI
- Ukuran: item 14px, label section 12px abu, judul "Library" ±32px bold

## Sidebar (lebar ±270px)
Baris atas (±y 143): toggle sidebar (x≈26), inbox + badge merah unread, compose (x≈244).
- Search "Search or ask" + chip `Ctrl+K` (y≈181)
- Nav cepat: pill **Home**, ikon chat, ikon kalender (y≈225)
- **New chat** (y≈269)
- **Library** — aktif hanya pada route `#/library`, latar sorot penuh (y≈300)
- Label `Upcoming events` + `Connect your calendar` (y≈342/373)
- **Teamspaces** label (y≈419); item `Team 6 HQ` + anak berindentasi 31px tiap:
  - Tasks, Tasks, Projects, Wiki, Meetings, Docs, TEAM ROLES (y≈449–667)
- **Private** label (y≈714); `Getting Started`, `TEAM 7`, `+ Add new` (y≈745–807)
- Footer (±y 1012–1057): `Customize sidebar`, switcher `T Team 6` (nama workspace),
  ikon hadiah/biru, ikon bantuan, ikon grid (popup)

## Popup menu (dari ikon grid footer)
Lebar ±240px, tinggi ±182px: `Library`, `AI Meeting Notes`, `Skills`, `My Tasks`,
`Marketplace`, `Trash`. Tertutup saat klik di luar atau tekan `Esc`.

## Konten utama (Latar #191919)
- Judul **Library** (~32px bold, kiri); tombol biru **New teamspace** (kanan atas)
- Tab filter: `Teamspaces` (aktif, pill), `Recents`, `Favorites`, `Shared`, `Private`,
  `AI Meeting Notes`, `Skills`, ikon kaca pembesar kanan
- Tabel: kolom `Name`, `Description`, `Access`, `Members`; baris `Team 6 HQ` |
  kosong | `Default` | jumlah anggota workspace; panah `▶` meng-expand anak teamspace

## Elemen melayang
Tombol bulat kanan bawah (Notion AI) membuka panel placeholder.

## Data nyata (bukan placeholder)
- **Members** di tabel Library: jumlah anggota workspace dari tabel `workspace_members`
  (Supabase). Mode lokal memakai 1 (pengguna tunggal).
- **Badge inbox**: jumlah halaman yang diubah anggota lain yang belum dibuka.
  Sumber: `pages.updated_by` + `updated_at`; state "sudah dibaca" disimpan per
  workspace di `localStorage` (`juvio.inbox.seen.v1.<scope>`).
- **Nama workspace** di footer: `workspaces.name` (default "Team 6" saat offline).
- **Teamspaces / Private**: diturunkan dari `rootOrder` — root dengan anak =
  teamspace, root tanpa anak = private.

## Migrasi seed
`src/lib/migration.ts` berjalan sekali per workspace (`juvio.seed.migration.v2.<scope>`):
menambah Team 6 HQ + 7 anak bila belum ada, menormalkan ikon lama ke ikon bernama
(`check-circle`, `checkbox`, `target`, `book-open`, `file-lines`, `file`), memindahkan
`Welcome to Juvio` dan `Ideas` ke bawah `Docs`, serta menambah `Getting Started` dan
`TEAM 7`. Tidak ada data pengguna yang dihapus.

## Rencana implementasi Juvio
1. Sidebar Notion (section, label, indentasi, ikon, footer, popup menu) — selesai
2. Halaman Library (`#/library`) dengan tab filter + tabel — selesai
3. Routing hash: `#/library` (default), `#/trash`, `#/<pageId>` — selesai

