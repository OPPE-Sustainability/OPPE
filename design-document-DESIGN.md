# Design Document
## Sistem Informasi Manajemen & Administrasi Terpadu IPNU-IPPNU

Versi: 0.1 (draft awal, turunan dari `architecture.md` & PRD)
Cakupan: Technical Design (skema database, kontrak API, struktur folder) + UI/UX Design (alur layar, komponen, style guide)

---

# BAGIAN A — TECHNICAL DESIGN

## A.1 Skema Database (Entity Overview)

Skema disederhanakan per modul. Semua tabel operasional punya `unit_id` (FK ke `units`) untuk tenant scoping, kecuali tabel global (`users`, `roles`, `units` sendiri).

### A.1.1 Inti Organisasi

```
units
 - id, name, type (PAC/RANTING/KOMISARIAT), parent_unit_id (nullable, FK units)
 - address, contact_wa, status (active/inactive)

user_profiles
 - id, user_id (FK users), unit_id, nia (nomor induk anggota)
 - full_name, birth_date, gender, wa_number
 - status (active/non_active), joined_at

users
 - id, email, wa_number, password_hash
 - role_id (FK roles), unit_id (FK units, nullable utk Super Admin)
 - is_minor (bool), guardian_consent_at (nullable)
 - email_verified_at, wa_verified_at

roles
 - id, name (ketua, wakil_ketua, sekretaris, wasek, bendahara,
   wk_bendahara, anggota, super_admin)
 - scope_level (pac / ranting / global)

structures  -- masa khidmat kepengurusan
 - id, unit_id, user_id, role_id
 - period_start, period_end, is_active
```

### A.1.2 Modul B — Surat-Menyurat (E-Office)

> **Catatan:** skema Modul B sudah cukup kompleks (alur approval, TTD digital, Surat Sendiri/Bersama, **format nomor surat resmi PD/PRT yang berbeda per organisasi IPNU/IPPNU**) sehingga detail lengkapnya dipindah ke `schema.md` §2 agar tidak ada dua sumber kebenaran yang bisa tidak sinkron. Ringkasan tabel: `organization_profiles`, `user_signatures`, `letter_types` (kode indeks per organisasi), `letter_number_sequences` (counter terpisah reguler/bersama, reset per pergantian pengurus), `letters_out` (dengan `letter_mode`, `content_mode`, `status` alur, `letter_number` yang terisi belakangan), `letter_out_partners`, `letter_approval_steps`, `letters_in`, `dispositions`, `library_documents`. Lihat juga alur bisnisnya di `rules.md` §4 (termasuk tabel kode indeks §4.4a yang diturunkan langsung dari Peraturan Administrasi hasil Konbes IPNU & IPPNU) dan alur layarnya di §B.4.2–B.4.4 dokumen ini.

### A.1.3 Modul C — Keuangan

```
cashbook_entries
 - id, unit_id, type (in/out), amount, description
 - receipt_photo_path, running_balance, created_by, entry_date
 - approved_by (nullable), approved_at (nullable)
```

### A.1.4 Modul D — Agenda & Presensi

```
agendas
 - id, unit_id, title, description, location_name
 - latitude, longitude, geofence_radius_m
 - visibility (internal/public), start_time, end_time

attendances
 - id, agenda_id, user_id (nullable utk tamu eksternal)
 - guest_name (nullable), method (gps/qr/manual)
 - lat, lng, distance_m (nullable), recorded_at (server timestamp)
```

### A.1.5 Modul E — Kaderisasi & Evaluasi

```
training_programs
 - id, unit_id, name (MAKESTA/LAKMUD), start_date, end_date

training_registrations
 - id, program_id, full_name, wa_number, email (nullable)
 - status (registered/attended/graduated/failed)
 - user_id (nullable, terisi setelah lulus & akun dibuat)

assessment_tokens  -- magic link asesor eksternal
 - id, registration_id, assessor_name, token, expires_at, used_at

assessment_scores
 - id, registration_id, token_id (nullable), score_type (cognitive/feedback)
 - score_value, submitted_at

certificates
 - id, registration_id, qr_code, pdf_path, issued_at
```

### A.1.6 Modul F — Akreditasi & Klasterisasi

```
accreditation_submissions
 - id, unit_id, period, status (draft/submitted/assessed/plenary/certified)
 - linked_letter_ids, linked_cashbook_ids, linked_agenda_ids (json refs)

assessor_scores
 - id, submission_id, assessor_id, criterion, rating (TL/KL/L), note
 - attachment_preview_path

plenary_results
 - id, submission_id, final_score, grade (A/B/C), decided_at, decided_by

grading_scales  -- dinamis per PAC
 - id, unit_id (PAC), grade_label, min_score, max_score
```

### A.1.7 Modul G — Eksternal & Pendukung

```
alumni
 - id, full_name, wa_number, graduation_year, current_activity

donation_campaigns
 - id, title, target_amount, collected_amount, status

donations
 - id, campaign_id, donor_name, amount, midtrans_ref, status

stakeholders  -- MoU
 - id, name, mou_start, mou_end, reminder_sent_at

public_events
 - id, title, event_date, location, quota

event_registrations
 - id, event_id, name, wa_number, ticket_code, checked_in_at (nullable)
```

### A.1.8 Modul H — Aset

```
assets
 - id, unit_id, name, category, condition, acquired_at

asset_loans
 - id, asset_id, borrowed_by, due_date, returned_at (nullable)
```

### A.1.9 Logging (append-only)

```
audit_logs
 - id, user_id, unit_id, action, entity, entity_id
 - before_value (json), after_value (json), ip_address, created_at

access_logs
 - id, user_id, event (login_success/login_fail/lockout/logout), ip, created_at

integration_logs
 - id, type (wa/midtrans/pdf_job), reference_id, status, retry_count, created_at
```

> Semua tabel modul A–H wajib kena Global Scope `unit_id` kecuali dinyatakan lain. Diagram relasi detail (ERD visual) disarankan dibuat terpisah di tahap sprint planning bila diperlukan.

---

## A.2 Kontrak API (Ringkasan Endpoint)

Standar: REST, prefix `/api/v1/`, auth via Bearer Token (Laravel Sanctum), response JSON konsisten:

```json
{
  "success": true,
  "data": { },
  "message": "OK"
}
```

Error:
```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "details": { } },
  "message": "..."
}
```

| Domain | Endpoint contoh | Method | Akses |
|---|---|---|---|
| Auth | `/auth/login`, `/auth/otp/verify`, `/auth/password/forgot` | POST | Publik |
| Anggota | `/members`, `/members/{id}` | GET/POST/PUT | RBAC per matriks §4.I.2 |
| Surat Keluar (E-Office) | `/letters-out`, `/letters-out/{id}/submit`, `/letters-out/{id}/steps/{stepId}/validate`, `/letters-out/{id}/steps/{stepId}/sign` | GET/POST | Buat: Wasek; Validasi: Wasek lain/Sekretaris; TTD: Sekretaris/Ketua — lihat alur lengkap di `rules.md` §4 |
| Verifikasi Surat (publik) | `/letters-out/verify/{token}` | GET | Publik, tanpa login |
| Disposisi | `/letters-in/{id}/dispositions` | POST | Sekretaris |
| Kas | `/cashbook`, `/cashbook/{id}/approve` | GET/POST/PATCH | Bendahara input, Ketua approve LPJ |
| Agenda | `/agendas`, `/agendas/{id}/attendance` | GET/POST | Kelola: Wasek, Presensi: Anggota |
| Pendaftaran Kaderisasi | `/training/registrations` | POST | Publik (tanpa akun) |
| Form Asesor (token) | `/assessment/{token}` | GET/POST | Magic link, tanpa akun |
| Akreditasi | `/accreditation/submissions`, `/accreditation/{id}/plenary` | GET/POST | Susun: Ranting, Sahkan: Ketua PAC |
| Donasi | `/donations`, `/donations/webhook/midtrans` | POST | Publik + webhook |
| Event | `/events`, `/events/{id}/check-in` | GET/POST | Publik daftar, Panitia check-in |
| Aset | `/assets`, `/assets/{id}/loans` | GET/POST | Kelola: Wasek/Sekretaris |
| RBAC/Admin | `/admin/roles`, `/admin/audit-logs` | GET/POST | Super Admin only |

Dokumentasi lengkap (parameter, schema request/response, status code) tersedia di `api-spec.yaml` — juga dihasilkan otomatis lewat anotasi L5-Swagger di `/api/documentation` pada environment staging/dev.

---

## A.3 Struktur Folder (Usulan)

### Backend (Laravel) — domain-first, bukan MVC datar

```
app/
 ├─ Domains/
 │   ├─ Member/          (Models, Services, Policies, Http/Controllers)
 │   ├─ Letter/
 │   ├─ Cashbook/
 │   ├─ Agenda/
 │   ├─ Training/
 │   ├─ Accreditation/
 │   ├─ External/        (Donation, Stakeholder, Event)
 │   ├─ Asset/
 │   └─ Rbac/            (Roles, Policies, AuditLog)
 ├─ Support/
 │   ├─ TenantScope/      (Global Scope unit_id)
 │   ├─ Integrations/
 │   │   ├─ WhatsApp/     (interface + driver Fonnte/Meta)
 │   │   ├─ Midtrans/
 │   │   └─ PdfGenerator/
 │   └─ Logging/
 ├─ Jobs/                 (SendWhatsAppJob, GenerateCertificateJob, dll)
 └─ Http/Middleware/      (TenantScopeMiddleware, RoleMiddleware)
routes/
 └─ api_v1.php
```

### Frontend (Vue.js)

```
src/
 ├─ modules/
 │   ├─ member/
 │   ├─ letter/
 │   ├─ cashbook/
 │   ├─ agenda/
 │   ├─ training/
 │   ├─ accreditation/
 │   ├─ external/
 │   └─ asset/
 │       each: views/, components/, store/ (Pinia), api.js
 ├─ shared/
 │   ├─ components/       (CardBase, DataTable, StatusBadge, dll)
 │   ├─ layouts/          (AppShell, AuthLayout)
 │   └─ composables/      (useAuth, useTenant, useOfflineSync)
 ├─ service-worker/       (cache strategy, background sync queue)
 └─ router/
```

---

# BAGIAN B — UI/UX DESIGN

## B.0 Arah Desain: "Senja di Serambi Pesantren"

> Alih-alih tema hijau-putih NU yang generik atau palet "AI-app default" (krem+terracotta, dashboard biru korporat), arah visual ini digali dari dunia nyata pelajar NU: **cahaya senja di serambi pesantren menjelang Maghrib** — hijau dedaunan/songkok yang dalam, keemasan lampu petromaks, dan kehangatan kumpul bersama. Ini yang membuat aplikasi terasa **"punya kita"**, bukan software korporat yang dipakai terpaksa — sekaligus tetap terasa modern dan enak dipakai anak muda.

**Prinsip inti:**
- **Ramah, bukan kaku** — tone hangat, rounded, mengundang, tapi tetap rapi & bisa dipercaya untuk urusan administrasi (surat, kas, akreditasi).
- **Gamifikasi yang jujur, bukan tempelan** — sistem lencana untuk jenjang kaderisasi (MAKESTA→LAKMUD→LAKUT) itu SUDAH sistem rank/level di dunia nyata — desainnya tinggal mengangkat itu, bukan menambah elemen game palsu yang tidak nyambung ke konten.
- **Family friendly** — warna hangat & aman, tidak ada elemen gelap/agresif, microcopy yang encouraging bukan menghakimi (lihat B.3a Tone of Voice).
- **Card-based layout**: setiap unit informasi (surat, entri kas, agenda) ditampilkan sebagai kartu rounded, bukan tabel padat — lebih ramah dibaca di layar HP.
- **Dark mode default-aware**: ikuti preferensi sistem perangkat, dengan toggle manual di pengaturan akun.
- **Mobile-first, PWA-installable**: semua alur utama nyaman dioperasikan satu tangan; bottom tab bar (bukan hamburger menu) — sesuai kebiasaan Gen Z di Instagram/TikTok/Shopee.
- **Feedback instan**: aksi async (kirim WA, generate PDF) menampilkan status loading + toast sukses/gagal, tidak membuat pengguna menebak-nebak.
- **Aksesibel**: kontras warna cukup di kedua mode, ukuran tap-target minimal 44×44px, reduced-motion dihormati.

## B.1 Sistem Warna

| Token | Nama | Light | Dark | Dipakai untuk |
|---|---|---|---|---|
| Primary | **Hijau Songkok** | `#1F5A44` | `#3E9575` | Aksi utama, navigasi aktif, identitas brand |
| Accent Emas | **Kuning Maghrib** | `#F2A93B` | `#F4B860` | Lencana kaderisasi, badge pencapaian, highlight positif |
| Accent Hangat | **Jingga Senja** | `#FF7A59` | `#FF8F72` | Notifikasi, CTA sekunder, aksen ramah (bukan warna bahaya) |
| Background | **Putih Kertas Kitab** | `#FFF9F0` | — | Latar utama, warm bukan stark white |
| Background Dark | **Hijau Malam** | — | `#10261F` | Latar mode gelap, hijau-hitam hangat bukan pure black |
| Surface/Card | — | `#FFFFFF` | `#183B2E` | Wadah kartu |
| Text Primary | **Coklat Tinta** | `#2B2620` | `#F3EFE6` | Teks utama |
| Text Secondary | — | `#7A7264` | `#B7AE9C` | Teks sekunder/caption |
| Danger/Reject | — | `#DC2626` | `#F87171` | Penolakan, error — dipakai sesedikit mungkin agar tetap terasa aman |
| Success | — | `#2F9E64` | `#4FCB8C` | Konfirmasi berhasil |

> **Kenapa bukan hijau-putih NU polos:** warna hijau tetap jadi identitas inti (Hijau Songkok), tapi dipadukan kuning-jingga senja supaya tidak terasa seperti dokumen organisasi formal belaka — kombinasi ini terasa hangat, related ke suasana pesantren beneran (lampu, senja, kumpul bareng), dan punya kontras yang cukup untuk aksen lencana/badge tanpa perlu warna baru yang asing.

## B.2 Tipografi

| Peran | Font | Alasan |
|---|---|---|
| Display/Heading | **Plus Jakarta Sans** (Bold/ExtraBold) | Geometris, rounded, ramah — sekaligus font buatan Indonesia, koneksi lokal yang related |
| Body | **Plus Jakarta Sans** (Regular/Medium) atau **Inter** | Konsisten dengan display, sangat terbaca di layar kecil |
| Data/Kode | **JetBrains Mono** | Untuk NIA, nomor surat, kode indeks — biar rapi sejajar, bukan sekadar dekorasi |

Skala: 14–16px body, 20–28px heading kartu, 32px+ untuk angka besar (saldo kas, skor akreditasi) dengan weight 700–800 supaya terasa "achievement", bukan sekadar angka laporan.

## B.2a Elemen Signature: Lencana Kader

> Ini elemen yang bikin aplikasi ini langsung dikenali — satu ide visual yang ditata dengan disiplin, bukan ditumpuk dengan dekorasi lain.

Sistem jenjang kaderisasi (Anggota → Kader, MAKESTA/LAKMUD/LAKUT/LAKNAS, jalur instruktur LATIN I/II) pada dasarnya **sistem lencana/rank**, mirip lencana pramuka yang sudah familiar buat pelajar Indonesia. Alih-alih menampilkan status kaderisasi sebagai teks/badge kotak biasa, sistem ini divisualkan sebagai:

- **Medali bundar** dengan pita di bawahnya (motif lencana pramuka/sekolah), warna dasar **Kuning Maghrib** dengan tepi gradasi ke **Jingga Senja**.
- Ikon geometris sederhana di tengah medali, beda per jenjang (mis. tunas untuk MAKESTA, daun untuk LAKMUD, obor untuk LAKUT) — bukan foto/ilustrasi rumit, supaya tetap ringan dirender & konsisten gaya.
- Ditampilkan sebagai **strip koleksi** di header profil anggota — makin banyak lencana terkumpul, makin terlihat progres kaderisasinya, mirip koleksi lencana di sash pramuka.
- Lencana **abu-abu/outline** untuk jenjang yang belum dicapai (state "terkunci", bukan disembunyikan) — memberi arah jelas "lanjut ke jenjang berikutnya" tanpa terasa menghakimi yang belum lulus.
- Momen lencana baru terbuka (saat status `graduated`) dipakai sebagai satu-satunya animasi besar di aplikasi — confetti ringan + medali "muncul" dengan micro-interaction singkat. Ini satu-satunya tempat animasi besar dipakai; di tempat lain animasi dijaga minim (per prinsip restraint).

## B.3 Komponen UI Inti (reusable)

| Komponen | Kegunaan | Modul pemakai |
|---|---|---|
| `CardBase` | Wadah konten dasar (surat, entri kas, agenda), rounded 20px | Semua |
| `LencanaKader` | Medali jenjang kaderisasi (lihat B.2a) — mode terkumpul/terkunci | Kaderisasi, Profil |
| `StatusBadge` | Label status berwarna (pending/approved/rejected/graded) | Surat, Kas, Kaderisasi, Akreditasi |
| `BottomTabBar` | Navigasi utama mobile: Beranda, Surat, Kegiatan, Kader, Profil | Semua |
| `DataTable` (dengan mode kartu di mobile) | Daftar data dengan filter/sort | Anggota, Aset, Log |
| `OfflineIndicator` | Ikon status koneksi + jumlah data pending sync | Presensi, Kas |
| `GeofenceMap` | Peta mini + radius untuk presensi/agenda | Agenda, Presensi |
| `QrScanner` / `QrDisplay` | Scan tiket/presensi & tampilkan QR sertifikat | Presensi, Event, Sertifikat |
| `SignatureBlock` | Tanda tangan digital pada surat/sertifikat, termasuk tata letak Ketua-kiri/Sekretaris-kanan & posisi stempel | Surat |
| `SplitPreview` | Preview dokumen berdampingan dengan form penilaian | Asesor Akreditasi |
| `RadioTLKL` | Komponen radio khusus TL/KL/L | Form Asesor |
| `MagicLinkGate` | Halaman akses token tanpa login, reusable selama durasi acara | Kaderisasi (peserta/staf eksternal) |
| `BottomActionBar` | Tombol aksi utama menempel bawah layar | Semua form |
| `OnboardingTour` | Tooltip panduan fitur inti saat login pertama | Onboarding Ranting baru |
| `LetterModeToggle` | Pilih Surat Sendiri vs Surat Bersama saat membuat draft | E-Office |
| `LetterTypeFieldsForm` | Form dinamis dari `letter_types.fields_schema` (Surat Khusus) | E-Office |
| `LetterRichEditor` | Editor isi bebas untuk Surat Umum | E-Office |
| `ApprovalStepTracker` | Stepper visual progres alur (validasi → TTD → mengetahui → stempel → nomor) | E-Office, Surat Lembaga |
| `SignatureLookupButton` | Tombol "Tanda Tangani" yang menarik TTD dari `user_signatures`; nonaktif + CTA upload jika belum ada | E-Office |
| `LetterheadPreviewPane` | Preview kop+isi+footer+stempel real-time, mendukung kop lembaga semi-otonom | E-Office |
| `LetterNumberPreview` | Simulasi format nomor surat sebelum `finish` | E-Office |
| `StampBadge` | Indikator visual stempel resmi pada dokumen final | E-Office |
| `QrValidationCard` | Tampilan hasil scan/cek keaslian surat di halaman publik | E-Office (publik) |
| `EventCommitteeCard` | Daftar panitia + seksi kegiatan besar, dengan badge posisi | Kepanitiaan Kegiatan |
| `RABPlanner` | Form ajukan & approve item RAB per seksi | Kepanitiaan Kegiatan |
| `WebformQuotaBar` | Progress bar sisa kuota pendaftaran (total & kategori eksternal) | Kaderisasi (publik) |
| `GenderRoutingBadge` | Penanda "data kamu tercatat di [unit]" pada join event IPNU-IPPNU | Kaderisasi (publik) |

## B.3a Tone of Voice & Microcopy

> Suara aplikasi ini seperti kakak kelas yang membimbing, bukan sistem birokrasi. Bahasa Indonesia santai-santun, bukan bahasa baku formal ala surat dinas.

- **Kalimat aktif, langsung ke tindakan**: "Kirim surat" bukan "Surat akan dikirimkan"; tombol dan hasil aksinya pakai kata yang sama ("Ajukan" → toast "Diajukan", bukan "Terkirim").
- **Nama sesuatu dari sudut pandang pengguna**: "Tanda tangani" bukan "trigger signature workflow"; "Kirim ke PC" bukan "submit ke unit atasan".
- **Error tidak menyalahkan, langsung kasih solusi**: "Nomor WA belum terdaftar. Coba cek lagi ya, atau hubungi Sekretaris unit kamu." — bukan "Error 422: Invalid input".
- **Layar kosong mengundang aksi**: "Belum ada surat masuk. Sekali surat masuk, langsung muncul di sini." — bukan sekadar "Tidak ada data."
- **Momen kelulusan/lencana baru dirayakan tulus**: "Selamat, kamu resmi jadi Kader! 🎉 Lencana MAKESTA sudah terkumpul." — bukan notifikasi datar "Status diperbarui: graduated".
- **Batasan tetap jujur, tidak menutupi**: kalau sertifikat resmi masih menunggu PC, bilang jelas: "Surat Keterangan ini berlaku sementara sambil menunggu sertifikat resmi dari PC" — bukan berpura-pura proses sudah lengkap.

## B.4 Alur Layar Utama (Screen Flow)

### B.4.1 Onboarding Ranting Baru
```
[Super Admin: Registrasi Unit]
   → [Kirim invite WA/email] → [Admin Ranting: Aktivasi via magic link]
   → [Lengkapi Profil Unit] → [Onboarding Tour: Surat/Kas/Agenda]
   → [Dashboard Ranting]
```

### B.4.2 E-Office — Terbit Surat Sendiri
```
[Wasek: Buat Draft Surat] → [Pilih Surat Sendiri]
   → [Pilih Surat Khusus (isi LetterTypeFieldsForm)
       atau Surat Umum (isi LetterRichEditor)]
   → [Pilih Tujuan: Internal (pilih unit) / Eksternal (isi nama)]
   → [LetterheadPreviewPane: preview kop otomatis dari organization_profiles]
   → [Submit → status in_validation]
   → [Wasek lain: buka ApprovalStepTracker → Validasi/Tolak]
       (tolak → kembali ke draft dgn catatan)
   → [Sekretaris: SignatureLookupButton → TTD]
       (belum punya TTD → diarahkan upload dulu)
   → [Ketua: SignatureLookupButton → TTD]
   → [Sistem otomatis: Stempel + Nomor Surat + Tanggal Hijriyah/Masehi
       + QR Validasi + PDF final] → [status: finish]
   → (jika tujuan internal) [Auto masuk sebagai Surat Masuk di unit tujuan]
   → (jika tujuan eksternal) [Unduh PDF final]
```

### B.4.3 E-Office — Terbit Surat Bersama
```
[Wasek Organisasi A: Buat Draft] → [Pilih Surat Bersama]
   → [Tambah Unit Mitra (Organisasi B)]
   → [Isi konten (khusus/umum) + tujuan] → [Submit]
   → [ApprovalStepTracker: 2 jalur paralel]
       [Sekretaris Org A: Validasi]   [Sekretaris Org B: Validasi]
                 (keduanya harus approved untuk lanjut)
   → [Ketua Org A: TTD]               [Ketua Org B: TTD]
                 (keduanya harus approved untuk lanjut)
   → [Sistem otomatis: Stempel kedua organisasi + Nomor Surat
       (mengikuti rangkaian Org A) + QR Validasi + PDF final]
       → [status: finish]
   → [Surat tercatat di kedua organisasi]
```

### B.4.4 Verifikasi Keaslian Surat (Publik)
```
[Pihak eksternal scan QR / buka link validasi]
   → [Halaman publik tanpa login]
   → [QrValidationCard menampilkan: nomor surat, unit penerbit,
       tanggal terbit, status "Resmi/Terverifikasi"]
   → (isi lengkap surat TIDAK ditampilkan, demi kerahasiaan)
```

### B.4.5 Presensi Hibrida
```
[Buka Agenda] → [Tombol "Presensi Sekarang"]
   → cek GPS dalam radius?
        Ya  → [Presensi tercatat, timestamp server]
        Tidak → [Tawarkan opsi: Scan QR / Catat manual oleh panitia]
   → (jika offline) [Simpan lokal + OfflineIndicator]
        → sync otomatis saat online → [Notifikasi hasil sync]
```

### B.4.6 Input Kas (dengan offline)
```
[Buka Buku Kas] → [Tambah Entri: nominal, keterangan, foto nota]
   → (online) [Submit → saldo update real-time]
   → (offline) [Simpan lokal, badge "Menunggu Sync"]
        → online kembali → [Sync] → jika bentrok →
          [Layar konfirmasi Bendahara: pilih/gabung entri]
```

### B.4.7 Pendaftaran & Evaluasi Kaderisasi
```
[Form Publik /webform/{uuid}] (isi gender, pilih kategori pendaftar)
   → [Cek kuota via WebformQuotaBar] → [Konfirmasi via WA]
   → ... pelaksanaan: check-in, presensi per materi, nilai per komponen ...
   → [Panitia sahkan nilai akhir] → job async:
        [Hitung nilai_akhir + naikkan membership_status]
        + [LencanaKader baru terbuka — animasi singkat + toast selamat]
        + [Generate draft Surat Keterangan via E-Office]
        + [Kirim WA berisi info kelulusan]
```

### B.4.8 Akreditasi & Pleno
```
[Admin Ranting: Isi Borang Akreditasi]
   → auto-tarik data Surat/Kas/Agenda (read-only)
   → [Submit ke PAC]
   → [Asesor PAC: Webform TL/KL/L + Split Preview Dokumen]
   → [Simpan nilai sementara]
   → [Rapat Pleno: Ketua PAC sahkan skor final]
   → [Grade otomatis dari Grading Scale] → [Sertifikat Akreditasi terbit]
```

## B.5 Wireframe & Mockup

Sesuai PRD §15, wireframe/mockup visual detail (Figma) disusun sebagai **lampiran terpisah per modul** sebelum development tiap modul dimulai — dokumen ini memberi kerangka alur & komponen sebagai briefing awal untuk desainer, bukan pengganti mockup high-fidelity.

## B.6 Notifikasi WhatsApp — Prinsip Template

- Bahasa konsisten, ramah, singkat; selalu sebut nama unit & konteks aksi.
- Kategori: E-Ticket, disposisi surat, pengingat MoU (H-30), kelulusan kaderisasi, OTP/reset password (tidak bisa di-opt-out).
- Sertakan opsi opt-out untuk notifikasi non-krusial di pengaturan akun.

---

## Catatan

Dokumen ini adalah draft desain awal untuk memandu sprint planning dan briefing tim desain/dev. Skema tabel & endpoint di atas perlu direview ulang saat masuk tahap pembuatan migration & OpenAPI spec aktual (detail kolom, tipe data presisi, dan validasi bisa berubah).
