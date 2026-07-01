# Deployment — App Store & Google Play

Step-by-step path from the current repo state to a live listing on both stores. Written
against what's actually in this repo today (bundle id `com.flashcardhero.app`, Expo SDK 54,
`eas.json` with `development`/`preview`/`production` profiles, no EAS project linked yet).

Do the steps in order — later steps assume earlier ones are done.

---

## 0. Accounts you need (do this first, takes the longest to clear)

- **Expo (EAS)** account — free. https://expo.dev/signup
- **Apple Developer Program** — $99/year, enrolled as yourself or an organization (D-U-N-S
  number required for orgs — can take days to verify). Needed for iOS builds/signing and
  App Store Connect.
- **Google Play Console** account — $25 one-time. New developer accounts currently have an
  identity-verification step and a 14-day+ testing requirement before production access —
  start this early so it's not the bottleneck.

---

## 1. Pre-submission code/asset checklist (specific to this repo)

Things that are currently placeholder/missing and **will** cause rejection or embarrassment
if shipped as-is:

- [ ] **Real app icon + splash.** `assets/images/icon.png`, `android-icon-foreground.png`,
      `android-icon-background.png`, `android-icon-monochrome.png`, `splash-icon.png`, and
      `favicon.png` are still the default Expo template art. Replace with real branded
      assets (1024×1024 icon, no transparency for iOS). `plan.md` already flags this as
      the one blocking item from Phase 4.3.
- [ ] **Account deletion.** Apple guideline 5.1.1(v) requires apps with account creation to
      offer in-app account deletion, not just sign-out. There's currently no delete-account
      action in `app/(tabs)/profile.tsx` / `lib/auth.tsx`. Add a "Delete account" flow
      (Supabase: delete the `auth.users` row via an RPC using `security definer`, cascading
      to `profiles`/`folders`/`decks`/`cards`/`card_reviews` — mirror the pattern already
      used for owner-scoped cascade deletes in `lib/folders.ts`). Do this **before**
      submitting to Apple; it's a hard rejection otherwise. Google doesn't hard-require it
      in-app but does require a way to request deletion (an in-app flow or a documented web
      form — see Data Safety section below).
- [ ] **Privacy policy.** Both stores require a hosted, publicly reachable privacy policy
      URL. The app collects an email/password (Supabase Auth) and stores user-authored
      content — that alone is enough to require one. Any static page (GitHub Pages, Notion
      public page, etc.) is fine; you just need a stable URL for both console forms.
- [ ] **Bump `version` in `app.json`** if this isn't truly `1.0.0` for you anymore (currently
      `1.0.0` — fine for a first release).
- [ ] **Do not bump the Expo SDK** as part of this work — it's pinned to 54 to match the
      test device's Expo Go build (see `CLAUDE.md`). Store builds don't need Expo Go at all
      (they're standalone binaries), so this isn't actually a blocker for release, just don't
      change it incidentally while doing store prep.

---

## 2. Install and authenticate the EAS CLI

```
npm install -g eas-cli
eas login
```

Verify: `eas whoami`.

---

## 3. Link this project to EAS

```
eas init
```

This registers the project on expo.dev and writes an `extra.eas.projectId` into
`app.json` — commit that change. `eas.json` already exists with the three build profiles
(`development`, `preview`, `production`) and an empty `submit.production`, so you don't
need to scaffold those.

---

## 4. Make Supabase env vars available to cloud builds

`.env` is gitignored, so EAS's cloud build workers never see it — without this step,
production builds will compile with `isSupabaseConfigured === false` and show the setup
notice instead of the login form. Register the two vars as EAS environment variables
(scoped to production, and to preview if you want internal test builds to hit Supabase too):

```
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR-PROJECT-ref.supabase.co" --environment production
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR-ANON-PUBLIC-KEY" --environment production
```

Repeat with `--environment preview` if you want the `preview` build profile (internal
APK / TestFlight builds) to hit the same live Supabase project. Confirm the schema in that
Supabase project is current — run `supabase/schema.sql` (or the incremental `phase5.sql`,
`phase6.sql`, `phase7.sql` if it's an existing DB) in the SQL editor before your first real
users touch it.

---

## 5. iOS setup

1. In **App Store Connect** (https://appstoreconnect.apple.com), create a new app:
   - Bundle ID: register `com.flashcardhero.app` under Certificates/Identifiers/Profiles
     (or let `eas build` auto-register it — it can do this interactively on first build).
   - Platform: iOS. Name: "Flashcard Hero" (or whatever you want the public listing name
     to be — this is independent of the `app.json` internal `name`).
   - SKU: any unique string (e.g. `flashcardhero-ios`).
2. Run the first production build — EAS will interactively walk you through generating a
   distribution certificate + provisioning profile and can store them for you:
   ```
   eas build --platform ios --profile production
   ```
3. Fill in App Store Connect metadata (can be done anytime before submitting for review):
   - Screenshots (6.7" and 5.5" iPhone sizes minimum; iPad if `supportsTablet` matters to you
     — it's currently `true` in `app.json`).
   - Description, keywords, support URL, marketing URL (optional), privacy policy URL.
   - **App Privacy** questionnaire: declare that you collect email address (account
     creation/auth) and user content (their cards/decks), linked to identity, used for
     app functionality — not for tracking. This must match what Supabase actually stores.
   - Age rating questionnaire.
   - Export compliance: this app only uses HTTPS (via Supabase's client), so it typically
     qualifies for the standard encryption exemption — answer accordingly in
     App Store Connect (`ITSAppUsesNonExemptEncryption` can also be set to `false` under
     `ios.infoPlist` in `app.json` to skip the prompt on every build).

---

## 6. Android setup

1. In **Google Play Console**, create a new app:
   - Package name: `com.flashcardhero.app` (must match `android.package` in `app.json`
     exactly — cannot be changed later).
   - Complete the initial "App content" declarations (target audience, privacy policy URL,
     ads: no, data safety — see below, content rating questionnaire).
2. **Data safety form**: declare collection of email (account management), and user-generated
   content (decks/cards) stored and transmitted over Supabase (encrypted in transit via
   HTTPS). Declare whether users can request data deletion (yes, once step 1's
   account-deletion flow exists).
3. Play now requires new apps to go through **Closed testing with 12+ testers for 14 days**
   before you can request production access — start this track early, it's the actual
   critical-path item for Android, not the build itself.
4. First production build:
   ```
   eas build --platform android --profile production
   ```
   This produces an `.aab` (Android App Bundle) — required for Play Store production
   submissions (the `preview` profile is configured for `apk` instead, which is fine for
   sideloading/internal testing but not for the Play Store listing itself).
5. Play App Signing: accept Google's managed app signing when prompted on first upload
   (recommended default — Google holds the upload key, you don't have to manage a keystore).

---

## 7. Internal testing before you submit for real review

Use the `preview` profile (already configured for an installable Android APK) to get a
build onto real devices without going through store review:

```
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

- Android: share the APK directly, or upload to Play Console's internal testing track.
- iOS: `preview` still needs a registered ad-hoc device or an internal TestFlight upload
  (TestFlight builds always route through App Store Connect, even for internal testers —
  there's no ad-hoc-equivalent shortcut for iOS the way there is for Android APKs).

Actually install this on the physical device you've been testing with in Expo Go, since
that's the first time this app runs as a **standalone binary** rather than inside Expo Go —
confirm deep links (`flashcardhero://...`), auth session persistence, and offline sync all
still work outside of the Expo Go sandbox.

---

## 8. Submit for review

Once metadata (steps 5/6) is complete and you've smoke-tested a `preview` build:

```
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

`eas submit` will prompt for App Store Connect API key / Google service account JSON the
first time (or reads them from `eas.json`'s `submit` block if you fill it in — currently
empty). Store the Google service account key path outside version control if you add it
there.

- Apple review: typically 1–3 days. Common rejection reasons for an app like this: missing
  account deletion (step 1), broken sign-in flow in review (make sure the reviewer can
  create an account without needing your Supabase project to be reachable/rate-limited),
  incomplete metadata.
- Google review: first production review on a new developer account can take longer
  (up to a few days to a week) due to additional scrutiny on new accounts.

---

## 9. After approval

- Both stores let you release to 100% immediately or via staged/phased rollout — for a
  first release, a staged rollout (Android supports this natively; iOS has "phased
  release") is a reasonable default so a bad build doesn't hit everyone at once.
- **Future updates**: any native-code or config change (new native module, `app.json`
  native config changes) requires a new `eas build` + store submission cycle. Pure JS/TS
  changes *could* skip store review via `expo-updates` OTA — that package isn't installed
  in this project yet, so for now every update (including this app's day-to-day feature
  work) goes through the full build → submit → review cycle above. Consider adding
  `expo-updates` later if release velocity on JS-only changes becomes a pain point.
- Bump `app.json`'s `version` for each store-visible release; `eas.json`'s
  `production.autoIncrement: true` already handles the iOS build number / Android version
  code automatically, so you only manage the human-facing version string.
