# Supabase database schema for Juvio

## File
- `schema.sql` — lengkap: tabel, RLS policy, dan index.

## Cara pakai
1. Buka [Supabase dashboard](https://app.supabase.com) → pilih project kamu
2. Masuk ke **SQL Editor**
3. Salin isi `schema.sql` lalu jalankan (Run)
4. Pastikan tidak ada error sebelum mencoba login di Juvio

## Tabel
- `workspaces` — tim/workspace
- `workspace_members` — anggota dan peran (owner/admin/member)
- `pages` — halaman, bisa bersarang (parent_id)
- `blocks` — blok dalam halaman

## Keamanan
Row Level Security (RLS) diaktifkan di semua tabel. User hanya bisa baca/tulis data di workspace yang diikutinya.

## Kuota gratis Supabase
- Database: 500 MB
- Bandwidth: 2 GB / bulan
- Cukup untuk pengembangan awal dan tim kecil.
