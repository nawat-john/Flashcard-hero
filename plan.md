# แผนงานพัฒนาแอป Flashcard

> แอป flashcard ที่สร้างโฟลเดอร์ซ้อนกันได้ สร้างการ์ดเอง แชร์ให้คนอื่น และโหลดของคนอื่นมาใช้ได้
>
> **Stack:** Expo (React Native + TypeScript) + Supabase (Postgres / Auth / Storage)
>
> **กลยุทธ์:** สร้างทีละ phase — local ก่อน แล้วค่อยต่อ cloud และฟีเจอร์แชร์ เพื่อให้เรียน mobile dev ได้โดยไม่ติดเรื่อง backend ตั้งแต่แรก

---

## ภาพรวมเป้าหมายแต่ละ Phase

| Phase | เป้าหมาย                     | ผลลัพธ์ที่จับต้องได้                                |
| ----- | ---------------------------- | --------------------------------------------------- |
| 0     | ตั้งค่าเครื่องมือ + โปรเจกต์ | รันแอปเปล่าบนมือถือจริงได้                          |
| 1     | Core local app               | สร้างโฟลเดอร์/deck/การ์ด + เรียนได้ (เก็บในเครื่อง) |
| 2     | Auth + Cloud sync            | login ได้ ข้อมูลอยู่บน cloud                        |
| 3     | แชร์ + Discover + โหลด       | เผยแพร่ deck และโหลดของคนอื่นได้                    |
| 4     | ขัดเงา + ปล่อยจริง           | spaced repetition, ปรับ UX, ขึ้น store              |

---

## Phase 0 — ตั้งค่าโปรเจกต์และเครื่องมือ

เป้าหมาย: ให้รันแอปเปล่าบนมือถือตัวเองได้ก่อน จะได้มั่นใจว่า toolchain พร้อม

- [x] ติดตั้ง Node.js (LTS) และตรวจ `node -v` — Node v24.16.0
- [x] ติดตั้งแอป **Expo Go** บนมือถือ (iOS / Android) — มี Expo Go SDK 54 บน iPad → โปรเจกต์ pin ที่ **Expo SDK 54** ให้ตรงกัน
- [x] สร้างโปรเจกต์: `npx create-expo-app@latest flashcard-app -t` — scaffold ที่ root ของ repo (**Expo SDK 54**)
- [x] เลือก template ที่มี **TypeScript** + **expo-router** — default template (tabs)
- [~] รัน `npx expo start` แล้วสแกน QR เปิดบนมือถือจริงได้ — dev server รันได้ + bundle export ผ่าน; _สแกน QR เองบนมือถือ_
- [x] ตั้งค่า ESLint + Prettier — `npm run lint` / `npm run format` ผ่าน
- [~] สร้าง git repo + push ขึ้น GitHub — commit แรกเสร็จแล้วในเครื่อง; _push ขึ้น GitHub เอง_
- [ ] ลองแก้ข้อความบนหน้าจอแล้วเห็น hot reload ทำงาน — _ลองเองหลังเปิดบนมือถือ_

**เช็คก่อนข้าม:** แอปเปล่ารันบนมือถือได้ และแก้โค้ดแล้วอัปเดตทันที

---

## Phase 1 — Core App (Local-only)

เป้าหมาย: ทำฟีเจอร์หลักให้ครบโดย**ยังไม่มี backend** เก็บข้อมูลในเครื่องด้วย `expo-sqlite`
นี่คือ phase ที่ใช้เวลามากที่สุดและได้เรียนรู้ mobile dev มากที่สุด

### 1.1 วางโครงสร้างและ navigation

- [x] ออกแบบ folder structure ของโปรเจกต์ (`/app`, `/components`, `/lib`, `/db`)
- [x] ตั้งค่า bottom tabs: **คลังของฉัน / เรียน / โปรไฟล์** (โปรไฟล์ placeholder ไปก่อน)
- [x] ทำ theme พื้นฐาน (สี, typography, spacing) เก็บเป็น constants — `Palette` / `Spacing` / `Radius` + hook `useAppTheme`

### 1.2 Local database

- [x] ติดตั้งและตั้งค่า `expo-sqlite` — connection เดียวร่วมกันใน `db/index.ts`
- [x] เขียน schema: ตาราง `folders`, `decks`, `cards` (เปิด foreign keys + `ON DELETE CASCADE`)
- [x] ทำระบบ migration ง่ายๆ (ไว้รัน schema ตอนเปิดแอปครั้งแรก) — append-only ตาม `PRAGMA user_version`
- [x] เขียน data layer (ฟังก์ชัน CRUD) แยกออกจาก UI — `lib/folders.ts` / `lib/decks.ts` / `lib/cards.ts` (ไม่มี React)

```
folders (id, parent_id, name, created_at)        -- parent_id ชี้กลับมาที่ folders เอง = ซ้อนได้
decks   (id, folder_id, title, description, created_at)
cards   (id, deck_id, front, back, position, created_at)
```

### 1.3 โฟลเดอร์ซ้อนกัน (หัวใจของแอป)

- [x] หน้า browse: แสดงโฟลเดอร์ย่อย + deck ในโฟลเดอร์ปัจจุบัน — `components/folder-browser.tsx`
- [x] เดินเข้า/ออกโฟลเดอร์ (push หน้าใหม่ตาม navigation stack) — `app/folder/[id].tsx`
- [x] แสดง breadcrumb หรือปุ่ม back ให้รู้ว่าอยู่ชั้นไหน — มีทั้ง back ของ stack และ breadcrumb (recursive CTE)
- [x] สร้างโฟลเดอร์ใหม่ในชั้นปัจจุบัน
- [x] เปลี่ยนชื่อ / ลบโฟลเดอร์ (ลบแล้วต้องจัดการของข้างในด้วย) — cascade ลบทั้ง subtree
- [~] ทดสอบโฟลเดอร์ซ้อนหลายๆ ชั้นว่าไม่พัง — _ทดสอบบนมือถือเอง (logic + build ผ่านแล้ว)_

### 1.4 จัดการ Deck และการ์ด

- [x] สร้าง deck ใหม่ในโฟลเดอร์
- [x] หน้า deck: แสดงรายการการ์ดทั้งหมด — `app/deck/[id].tsx`
- [x] เพิ่มการ์ด (กรอกหน้า/หลัง)
- [x] แก้ไข / ลบการ์ด
- [x] จัดลำดับการ์ด (drag to reorder — optional) — กดค้างแล้วลากได้ใน `app/deck/[id].tsx` (Reanimated + GestureDetector)
- [x] แก้ชื่อ/คำอธิบาย deck, ลบ deck

### 1.5 หน้าจอเรียน (Study)

- [x] เปิด deck แล้วเข้าโหมดเรียน — `app/study/[deckId].tsx` (เข้าได้จากหน้า deck หรือแท็บ “เรียน”)
- [x] แสดงด้านหน้า → แตะเพื่อพลิกดูด้านหลัง (ใส่ flip animation) — reanimated rotateY
- [x] ปุ่ม "จำได้ / จำไม่ได้" แล้วไปการ์ดถัดไป
- [x] สรุปผลตอนจบ (เรียนไปกี่ใบ ถูกกี่ใบ)
- [x] ปุ่มเริ่มใหม่ / สลับลำดับการ์ด (shuffle) — สลับลำดับทุกครั้งที่เริ่ม

**เช็คก่อนข้าม:** ใช้แอปสร้างโฟลเดอร์ซ้อน → สร้าง deck → ใส่การ์ด → นั่งเรียนได้จบ flow ครบ โดยไม่ต้องต่อเน็ต

---

## Phase 2 — Auth + Cloud Sync

เป้าหมาย: ย้ายข้อมูลขึ้น cloud และให้ login ได้ เพื่อปูทางไปสู่การแชร์

### 2.1 ตั้งค่า Supabase

- [x] สร้างโปรเจกต์ Supabase (free tier) — สร้างแล้ว, รัน `schema.sql`, smoke test ผ่าน 10/10
- [x] ติดตั้ง `@supabase/supabase-js` + เก็บ key ใน env (อย่า commit ลง git) — `.env` ถูก gitignore + มี `.env.example`
- [x] สร้าง schema บน Postgres (ดูตารางด้านล่าง) — `supabase/schema.sql` (รันใน SQL editor)
- [x] เพิ่มตาราง `profiles` และ `card_reviews` — + trigger สร้าง `profiles` อัตโนมัติตอนสมัคร

```
profiles      (id, display_name, created_at)
folders       (id, owner_id, parent_id, name, created_at)
decks         (id, owner_id, folder_id, title, description, is_public, created_at)
cards         (id, deck_id, front, back, position)
card_reviews  (user_id, card_id, due_date, interval, ease)   -- progress แยกของแต่ละคน
```

### 2.2 Authentication

- [x] ทำหน้า sign up / login (email + password) — `app/(auth)/login.tsx`
- [x] จัดการ session (จำ login ไว้ตอนเปิดแอปใหม่) — เก็บ session ใน AsyncStorage ผ่าน `lib/auth.tsx`
- [x] สร้าง row ใน `profiles` อัตโนมัติตอนสมัคร — Postgres trigger `on_auth_user_created`
- [x] หน้าโปรไฟล์: แสดงชื่อ + ปุ่ม logout — แก้ชื่อที่แสดงได้ด้วย

### 2.3 Row Level Security (สำคัญมาก — อย่าข้าม)

- [x] เปิด RLS ทุกตาราง — ใน `supabase/schema.sql`
- [x] policy: user เห็น/แก้ได้เฉพาะข้อมูลที่ `owner_id` เป็นของตัวเอง
- [x] policy: ใครก็อ่าน deck/card ที่ `is_public = true` ได้ แต่แก้ไม่ได้
- [x] ทดสอบว่า user A แอบแก้ข้อมูล user B ไม่ได้ — RLS isolation test ผ่าน (B มองไม่เห็น/แก้ไม่ได้ deck ส่วนตัวของ A)

### 2.4 ย้าย data layer มาใช้ Supabase

- [x] เปลี่ยนฟังก์ชัน CRUD จาก SQLite → Supabase — ถอด `expo-sqlite` ออก, `lib/*` ใช้ Supabase แล้ว
- [x] ดึงทั้งกิ่งโฟลเดอร์ด้วย recursive query (ทำเป็น Postgres function) — `folder_descendants(root)` (เตรียมไว้ใช้ Phase 3)
- [x] จัดการ loading / error state ในทุกหน้า — `LoadingScreen` + `ErrorState` (มีปุ่มลองใหม่)
- [x] (optional) offline support — `lib/store.ts` (AsyncStorage mirror + outbox queue, NetInfo-driven flush/hydrate)

**เช็คก่อนข้าม:** login จากมือถือสองเครื่องด้วยบัญชีเดียวกันแล้วเห็นข้อมูลตรงกัน

---

## Phase 3 — แชร์ + Discover + โหลด

เป้าหมาย: ให้เผยแพร่ deck ของตัวเอง และโหลดของคนอื่นมาใช้ได้
ใช้โมเดล **fork-on-copy**: โหลดแล้วได้ copy เป็นของตัวเอง ไม่ผูกกับต้นฉบับ

### 3.1 เผยแพร่ (Share)

- [x] ปุ่ม toggle `is_public` บน deck — Switch ในหน้า deck + เมนูในคลัง + ป้าย 🌐
- [x] สร้าง share link / รหัสสำหรับแชร์ deck — ปุ่ม "แชร์ลิงก์" (deep link `flashcardhero://deck-preview/<id>`)
- [x] (optional) แชร์ทั้งโฟลเดอร์ (เผยแพร่ทั้ง subtree) — `share_folder` RPC + เมนูใน `components/folder-browser.tsx`

### 3.2 หน้า Discover

- [x] tab "ค้นพบ" แสดง public deck — `app/(tabs)/discover.tsx` (ใช้ `list_public_decks`)
- [x] ช่องค้นหาตามชื่อ deck — ค้นด้วย title (ilike)
- [x] หน้า preview: ดูตัวอย่างการ์ดก่อนโหลด + ชื่อผู้สร้าง — `app/deck-preview/[id].tsx`

### 3.3 โหลดเข้าคลัง (Copy)

- [x] เขียน Postgres function "copy deck" — INSERT copy ของ deck + cards เข้าบัญชีผู้โหลด — `copy_deck()` ใน `supabase/phase3.sql`
- [x] ปุ่ม "เพิ่มเข้าคลัง" ในหน้า preview
- [x] กรณีโหลดทั้งโฟลเดอร์: copy ทั้ง subtree (folder + deck + card) — `copy_folder` RPC + `app/folder-preview/[id].tsx`
- [x] progress การเรียนของ copy เริ่มใหม่ (ไม่ติดมาจากต้นฉบับ) — copy ได้ card id ใหม่ จึงไม่มี `card_reviews` ติดมา
- [x] ทดสอบ: เจ้าของแก้ต้นฉบับแล้ว copy ของคนอื่นต้องไม่เปลี่ยนตาม — verify ผ่าน 12/12 (A แก้+ลบต้นฉบับ, copy ของ B ไม่เปลี่ยน)

**เช็คก่อนข้าม:** เครื่อง A เผยแพร่ deck → เครื่อง B ค้นเจอ → โหลด → แก้ได้อิสระ

---

## Phase 4 — ขัดเงาและปล่อยจริง

เป้าหมาย: ทำให้พร้อมใช้งานจริงและขึ้น store (ทำเท่าที่อยากทำ)

### 4.1 Spaced Repetition

- [x] ใส่อัลกอริทึม SM-2 (แบบเดียวกับ Anki) ใช้ `card_reviews` — `lib/reviews.ts` (binary จำได้/จำไม่ได้), verify 7/7
- [x] คำนวณ `due_date` จากผลการตอบ — interval 1→6→×ease, ลด ease เมื่อจำไม่ได้
- [x] โหมดเรียน "เฉพาะการ์ดที่ถึงกำหนด" — ปุ่ม "ทบทวนที่ถึงกำหนด (N)" ในหน้า deck (`?due=1`)

### 4.2 ปรับ UX

- [x] empty state สวยๆ (ตอนยังไม่มี deck) — `EmptyState` ทุกหน้า (คลัง/เรียน/ค้นพบ/เด็ค)
- [x] loading skeleton แทนหน้าจอว่าง — `LoadingScreen` (spinner) + `ErrorState` มีปุ่มลองใหม่
- [x] ยืนยันก่อนลบ — `Alert` ยืนยันทุกการลบ (โฟลเดอร์/เด็ค/การ์ด)
- [x] รองรับ dark mode — `useColorScheme` + `Palette` (light/dark) อัตโนมัติ
- [x] รองรับ swipe gesture ตอนเรียน — ปัดขวา=จำได้ / ปัดซ้าย=จำไม่ได้ (gesture-handler + reanimated)

### 4.3 เตรียมปล่อย

- [~] icon + splash screen — splash ตั้งค่าใน `app.json` แล้ว; ไอคอนยังเป็นของ default (_รอไฟล์อาร์ตจริงจากผู้ใช้_)
- [ ] ทดสอบบนทั้ง iOS และ Android — _ทดสอบบนเครื่องจริงเอง_
- [~] build ด้วย EAS Build — `eas.json` + bundle id พร้อมแล้ว; เหลือ `eas login` + `eas init` + `eas build` (_ต้องใช้บัญชี Expo ของผู้ใช้_)
- [ ] (optional) ส่งขึ้น TestFlight / Google Play internal testing — _ต้องใช้บัญชี store ของผู้ใช้_

---

## เคล็ดลับสำหรับแอปแรก

- **ทำให้เสร็จทีละ Phase** — อย่ากระโดดไปทำแชร์ทั้งที่ local ยังไม่เสร็จ ความยากจะกองรวมกันจนท้อ
- **แยก data layer ออกจาก UI** ตั้งแต่แรก — ตอนย้ายจาก SQLite ไป Supabase ใน Phase 2 จะแก้ที่เดียวจบ
- **commit git บ่อยๆ** — ทุกครั้งที่ฟีเจอร์เล็กๆ ทำงานได้
- **ทดสอบบนมือถือจริง** ไม่ใช่แค่ simulator — gesture/keyboard/ขนาดจอ ต่างกันจริง
- **RLS ห้ามข้าม** — เป็นด่านความปลอดภัยหลัก ถ้าไม่ทำ ใครก็แก้ข้อมูลคนอื่นได้

---

## ก้าวต่อไป

เริ่มที่ Phase 0 ให้รันแอปเปล่าบนมือถือได้ก่อน แล้วลุย Phase 1 ทีละข้อในเช็คลิสต์
