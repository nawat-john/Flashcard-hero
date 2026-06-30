'use strict';
/**
 * Seed script: creates and publishes English-Thai and English-Japanese flashcard
 * decks under the signed-in user's account.
 *
 * Prerequisites – add to .env:
 *   SEED_EMAIL=your@email.com
 *   SEED_PASSWORD=yourpassword
 *
 * Run:
 *   node scripts/seed-decks.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;

if (!url || !key || url.includes('YOUR-') || key.includes('YOUR-')) {
  console.error('ERROR: Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}
if (!email || !password) {
  console.error('ERROR: Set SEED_EMAIL and SEED_PASSWORD in .env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const FOLDERS = [
  { name: 'English-Thai' },
  { name: 'English-Japanese' },
];

const DECKS = [
  // ── English-Thai ──────────────────────────────────────────────────────────
  {
    folder: 'English-Thai',
    title: 'Thai Greetings & Basics',
    description: 'Essential phrases for everyday Thai conversation',
    cards: [
      { front: 'hello', back: 'สวัสดี (sawadee)' },
      { front: 'thank you', back: 'ขอบคุณ (khob khun)' },
      { front: 'sorry / excuse me', back: 'ขอโทษ (kho thot)' },
      { front: 'yes', back: 'ใช่ (chai) · ครับ (male) · ค่ะ (female)' },
      { front: 'no', back: 'ไม่ (mai)' },
      { front: 'how are you?', back: 'เป็นยังไงบ้าง? (pen yang ngai bang?)' },
      { front: "I'm fine", back: 'สบายดี (sabai dee)' },
      { front: 'what is your name?', back: 'คุณชื่ออะไร? (khun chue arai?)' },
      { front: 'my name is …', back: 'ฉันชื่อ … (chan chue …)' },
      { front: 'nice to meet you', back: 'ยินดีที่ได้รู้จัก (yin dee thi dai roo jak)' },
    ],
  },
  {
    folder: 'English-Thai',
    title: 'Thai Numbers 1–20',
    description: 'Count in Thai from one to twenty',
    cards: [
      { front: 'one', back: 'หนึ่ง (neung)' },
      { front: 'two', back: 'สอง (song)' },
      { front: 'three', back: 'สาม (sam)' },
      { front: 'four', back: 'สี่ (si)' },
      { front: 'five', back: 'ห้า (ha)' },
      { front: 'six', back: 'หก (hok)' },
      { front: 'seven', back: 'เจ็ด (jet)' },
      { front: 'eight', back: 'แปด (paet)' },
      { front: 'nine', back: 'เก้า (gao)' },
      { front: 'ten', back: 'สิบ (sip)' },
      { front: 'eleven', back: 'สิบเอ็ด (sip-et)' },
      { front: 'twelve', back: 'สิบสอง (sip-song)' },
      { front: 'thirteen', back: 'สิบสาม (sip-sam)' },
      { front: 'fourteen', back: 'สิบสี่ (sip-si)' },
      { front: 'fifteen', back: 'สิบห้า (sip-ha)' },
      { front: 'sixteen', back: 'สิบหก (sip-hok)' },
      { front: 'seventeen', back: 'สิบเจ็ด (sip-jet)' },
      { front: 'eighteen', back: 'สิบแปด (sip-paet)' },
      { front: 'nineteen', back: 'สิบเก้า (sip-gao)' },
      { front: 'twenty', back: 'ยี่สิบ (yi-sip)' },
    ],
  },
  {
    folder: 'English-Thai',
    title: 'Thai Everyday Vocabulary',
    description: 'Common nouns and adjectives for daily life',
    cards: [
      { front: 'water', back: 'น้ำ (nam)' },
      { front: 'food', back: 'อาหาร (a-han)' },
      { front: 'rice', back: 'ข้าว (khao)' },
      { front: 'house / home', back: 'บ้าน (ban)' },
      { front: 'car', back: 'รถ (rot)' },
      { front: 'person / people', back: 'คน (khon)' },
      { front: 'day', back: 'วัน (wan)' },
      { front: 'time', back: 'เวลา (we-la)' },
      { front: 'money', back: 'เงิน (ngoen)' },
      { front: 'good', back: 'ดี (dee)' },
      { front: 'big', back: 'ใหญ่ (yai)' },
      { front: 'small', back: 'เล็ก (lek)' },
      { front: 'hot', back: 'ร้อน (ron)' },
      { front: 'cold', back: 'เย็น / หนาว (yen / nao)' },
      { front: 'beautiful', back: 'สวย (suay)' },
    ],
  },

  // ── English-Japanese ───────────────────────────────────────────────────────
  {
    folder: 'English-Japanese',
    title: 'Japanese Greetings & Basics',
    description: 'Essential phrases for everyday Japanese conversation',
    cards: [
      { front: 'hello (daytime)', back: 'こんにちは (konnichiwa)' },
      { front: 'good morning', back: 'おはようございます (ohayou gozaimasu)' },
      { front: 'good evening', back: 'こんばんは (konbanwa)' },
      { front: 'good night', back: 'おやすみなさい (oyasuminasai)' },
      { front: 'thank you', back: 'ありがとうございます (arigatou gozaimasu)' },
      { front: 'sorry / excuse me', back: 'すみません (sumimasen)' },
      { front: 'yes', back: 'はい (hai)' },
      { front: 'no', back: 'いいえ (iie)' },
      { front: 'nice to meet you', back: 'はじめまして (hajimemashite)' },
      { front: 'please (requesting)', back: 'おねがいします (onegai shimasu)' },
      { front: "I don't understand", back: 'わかりません (wakarimasen)' },
      { front: 'where is …?', back: '… はどこですか? (… wa doko desu ka?)' },
    ],
  },
  {
    folder: 'English-Japanese',
    title: 'Japanese Hiragana – Vowels & K-row',
    description: 'The first 15 hiragana characters with romaji pronunciation',
    cards: [
      { front: 'a (あ)', back: 'あ — sounds like "ah"' },
      { front: 'i (い)', back: 'い — sounds like "ee"' },
      { front: 'u (う)', back: 'う — sounds like "oo" (short)' },
      { front: 'e (え)', back: 'え — sounds like "eh"' },
      { front: 'o (お)', back: 'お — sounds like "oh"' },
      { front: 'ka (か)', back: 'か — sounds like "kah"' },
      { front: 'ki (き)', back: 'き — sounds like "kee"' },
      { front: 'ku (く)', back: 'く — sounds like "koo"' },
      { front: 'ke (け)', back: 'け — sounds like "keh"' },
      { front: 'ko (こ)', back: 'こ — sounds like "koh"' },
      { front: 'sa (さ)', back: 'さ — sounds like "sah"' },
      { front: 'shi (し)', back: 'し — sounds like "shee"' },
      { front: 'su (す)', back: 'す — sounds like "sue"' },
      { front: 'se (せ)', back: 'せ — sounds like "seh"' },
      { front: 'so (そ)', back: 'そ — sounds like "soh"' },
    ],
  },
  {
    folder: 'English-Japanese',
    title: 'Japanese Everyday Vocabulary',
    description: 'Common nouns and adjectives for daily life',
    cards: [
      { front: 'water', back: '水 みず (mizu)' },
      { front: 'food', back: '食べ物 たべもの (tabemono)' },
      { front: 'rice (cooked)', back: 'ご飯 ごはん (gohan)' },
      { front: 'house / home', back: '家 いえ (ie)' },
      { front: 'car', back: '車 くるま (kuruma)' },
      { front: 'person / people', back: '人 ひと (hito)' },
      { front: 'day', back: '日 ひ (hi)' },
      { front: 'time', back: '時間 じかん (jikan)' },
      { front: 'money', back: 'お金 おかね (okane)' },
      { front: 'good', back: 'いい (ii)' },
      { front: 'big', back: '大きい おおきい (ookii)' },
      { front: 'small', back: '小さい ちいさい (chiisai)' },
      { front: 'hot', back: '暑い あつい (atsui)' },
      { front: 'cold', back: '寒い さむい (samui)' },
      { front: 'beautiful', back: 'きれい (kirei)' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insert(table, values) {
  const { error } = await supabase.from(table).insert(values);
  if (error) throw new Error(`INSERT ${table}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  // Sign in
  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !data.user) {
    throw new Error('Sign-in failed: ' + (signInError?.message ?? 'no user returned'));
  }
  console.log(`Signed in as ${email} (${data.user.id})\n`);

  // Create folders
  const folderIds = {};
  for (const f of FOLDERS) {
    const id = randomUUID();
    await insert('folders', { id, name: f.name, parent_id: null });
    folderIds[f.name] = id;
    console.log(`[folder] ${f.name}`);
  }

  // Create decks + cards
  for (const deck of DECKS) {
    const deckId = randomUUID();
    const folderId = folderIds[deck.folder];
    await insert('decks', {
      id: deckId,
      folder_id: folderId,
      title: deck.title,
      description: deck.description,
      is_public: true,
    });
    console.log(`  [deck]  ${deck.title} (${deck.cards.length} cards)`);

    for (let i = 0; i < deck.cards.length; i++) {
      await insert('cards', {
        id: randomUUID(),
        deck_id: deckId,
        front: deck.cards[i].front,
        back: deck.cards[i].back,
        position: i,
      });
    }
  }

  console.log('\nDone. All decks are published and visible in Discover.');
}

run().catch((e) => {
  console.error('\nERROR:', e.message);
  process.exit(1);
});
