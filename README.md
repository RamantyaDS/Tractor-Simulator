# Tractor Simulator

Simulator 3D traktor **Massey Ferguson MF 5M.145** di blok kebun kelapa sawit. Berjalan langsung di browser.

**Coba langsung:** https://ramantyads.github.io/Tractor-Simulator/

## Traktor yang disimulasikan

| | MF 5M.145 (versi kabin, Tier 3) |
|---|---|
| Mesin | AGCO Power 4,4 L, 4 silinder, turbo, common rail. 145 hp di 2000 rpm, torsi maks 560 Nm di 1500 rpm |
| Transmisi | 12x12 Synchro (4 gigi × 3 range L/M/H) dengan power shuttle |
| PTO | Independen, elektro-hidrolik. 540 rpm di 2000 rpm mesin, 540 Eco di 1550 rpm |
| Hidrolik | 34 + 58 L/menit, 200 bar. Hitch 3-titik Cat 3, angkat 5.200 kg |
| Ukuran | Wheelbase 2.620 mm, ban belakang 420/85 R38, tinggi atap 2.730 mm, berat 4.500 kg, tangki 198 L |

## Fitur

- Model 3D yang dibangun dari kode berdasarkan foto brosur: kap merah dengan strip abu-abu, grille hitam dan lampu LED, pemberat depan, kabin 4 pilar beratap putih dengan lampu kerja dan rotator, knalpot tegak di pilar kanan, tangki dan tangga di kiri, spatbor lebar, hitch 3-titik, PTO, dan drawbar
- Fisika mesin dan transmisi: kurva torsi dari angka brosur, governor gas tangan dan gas kaki, 12 gigi maju dan 12 mundur, shuttle tanpa kopling, ganti range hanya saat berhenti, mesin mati kalau dipaksa
- Traksi: grip berbeda di jalan laterit, gawangan berumput, jalan panen, lantai beton, dan lumpur. 4WD dan diff lock membantu di lumpur, roda bisa slip
- Blok sawit: jarak tanam segitiga 9 m, jalan koleksi, jalan panen, piringan pokok, TPH bernomor dengan tumpukan janjang, dan stasiun bin TBS
- Pilihan alat:
  - **Trailer jungkit 8 ton dengan crane grabber**: ambil janjang dari TPH, bawa ke bin, jungkit. Kecepatan crane mengikuti rpm mesin (aliran oli hidrolik), dan trailer bisa jackknife saat mundur
  - **Rotary slasher 2 m**: babat rumput di gawangan dengan PTO
  - **Spreader pupuk 800 kg**: tabur pupuk ke piringan pokok di kiri-kanan
- Dashboard: takometer, kecepatan, gigi, shuttle, lampu indikator (4WD, diff lock, PTO, rem, slip), solar, suhu, beban mesin, posisi hitch
- Kamera belakang, kabin (seret untuk melihat sekeliling), bebas, atas, dan pamer
- Kontrol keyboard dan layar sentuh, plus peta blok

## Suara dari rekaman asli

Suara mesin memakai rekaman traktor diesel sungguhan. Loop idle dan loop putaran tinggi digeser pitch-nya sesuai rpm dan dicampur, lalu ditambah lapisan pembakaran sintetis yang makin keras saat mesin dibebani.

| Suara | Sumber | Lisensi |
|---|---|---|
| Mesin idle, putaran tinggi, mesin mati | [John Deere 5820 (4,5 L turbo 4 silinder)](https://commons.wikimedia.org/wiki/File:WWS_JohnDeereTractor.ogg), Work With Sounds / Werstas | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Pompa hidrolik (crane, hitch, jungkit) | [Komatsu 941 harvester](https://commons.wikimedia.org/wiki/File:WWS_Komatsu941Harvester.ogg), Work With Sounds / Werstas | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Starter dan mesin menyala | [Gillig bus, Cummins ISL9](https://commons.wikimedia.org/wiki/File:Merced_The_Bus_Gillig_engine_start.ogg), Evan0512 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

File di `public/audio/` adalah potongan rekaman tersebut yang dijadikan loop. Untuk `engine-start.wav` berlaku lisensi CC BY-SA 4.0.

Rekaman MF 5M.145 sendiri belum ada di sumber berlisensi terbuka. John Deere 5820 dipilih karena mesinnya paling mirip (diesel turbo 4 silinder, 4,5 L).

## Catatan akurasi

- Rasio gigi pabrik tidak dipublikasikan. Kecepatan tiap gigi dibuat dengan sebaran khas transmisi 12x12 berkecepatan maksimum 40 km/jam
- Brosur Eropa menyebut torsi 560 Nm, halaman Traknus 580 Nm. Simulator memakai 560
- Kapasitas trailer, laju crane, dan dosis pupuk adalah nilai tipikal, bukan dari satu produk tertentu

## Pengembangan

```bash
npm install
npm run dev
npm test
npm run build
```

Setiap push ke `main` otomatis di-deploy ke GitHub Pages lewat GitHub Actions.

Stack: Vite, React, TypeScript, React Three Fiber, drei, Zustand, Vitest. Logika traktor ada di [`src/sim/tractor.ts`](src/sim/tractor.ts), alat dan pekerjaan di [`src/sim/work.ts`](src/sim/work.ts).
