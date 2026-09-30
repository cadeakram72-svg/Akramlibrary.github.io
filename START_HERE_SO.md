# AKRAM LIBRARY — Rakibidda iyo waxa harsan

**Website-ka lama beddelin naqshaddiisa. Xogta buugaagta, qoraayaasha, qiimayaasha iyo lambarrada lacag-bixinta lama beddelin. Update-kan weli laguma rakibin website-kaaga online-ka ah.**

## 1. Arrinta ugu horreysa: labada PDF ee lacagta ah

Hubinta 29 September 2026 waxay muujisay in labadan fayl si dadweyne ah uga furan yihiin GitHub Pages:

- `assets--books--dhis-naftaada.pdf`
- `assets--books--ganacsade.pdf`

Qofku wuu heli karaa isaga oo aan iibsan. Marka hore hubi in nuqullada gaarka ahi ku jiraan Supabase. **Ganacsade hadda ma laha private PDF ku xiran diiwaankiisa.**

Soo gal `admin.html` akoonka `cadeakram72@gmail.com` → Books → Ganacsade → Edit → Book PDF → dooro PDF-gii saxda ahaa → xaqiiji xuquuqda → Save. Qiimaha iyo qoraaga ha beddelin. Dhis Naftaada-na xaqiiji in PDF-giisa gaarka ahi furmayo.

Kadib ka saar labada fayl ee kor ku qoran repository-ga GitHub. **Ha tirtirin buugga diiwaankiisa ama nuqulkiisa Supabase.** Eeg `DELETE_FROM_GITHUB.txt`: faylka cusub oo la upload-gareeyo kii hore kama saarayo, taariikhda Git iyo deployments-kii horena waa in la hubiyaa. Nuqullo hore loo dejiyey lagama soo celin karo dadka.

## 2. Backup samee

GitHub → Code → Download ZIP; ku hay telefoon/laptop iyo meel labaad. Supabase ka samee database backup iyo Storage backup. Export-ka Admin wuxuu bixiyaa xog maamul; ma aha backup dhamaystiran oo accounts/PDFs ah. Eeg `DEPLOYMENT.md`.

## 3. Supabase diyaari

Faylasha SQL ka fur Notepad/VS Code, **qoraalka gudaha ku jira** ku dheji SQL Editor, kadib Run. Magaca faylka keliya ha ku qorin SQL Editor.

1. `supabase/00_PREFLIGHT.sql`: hubin keliya.
2. `supabase/migrations/05_PROVIDER_FOUNDATION.sql`
3. `supabase/migrations/06_COMPLETION.sql`
4. `supabase/migrations/07_OPERATIONS.sql`

Mid walba ha guulaysto ka hor kan xiga. Ha dib u gelin `02_CATALOG.sql`; waxay halis gelin kartaa xogta aad beddeshay. `01_SETUP.sql` ee reference-ku waa dukumenti/tijaabo, ma aha tallaabo update-kan looga baahan yahay haddii nidaamkaagii hore shaqaynayo.

## 4. Lacag-bixinta iyo email-ka

Lambarka EVC ama eDahab keliya ma aha API merchant account. Waxaa weli loo baahan yahay:

- **WAAFI:** merchant UID, store ID, HPP key, webhook secret, iyo oggolaanshaha hababka lacag-bixinta ee akoonkaaga.
- **International:** Stripe merchant account la oggolaaday, secret key iyo webhook signing secret. Waa inuu ganacsigaagu buuxiyaa shuruudaha dalka uu Stripe taageero. Visa/Apple Pay/Google Pay waxaa muuqda keliya kuwa provider-ku taageero. Ha adeegsan aqoonsi/dal aan sax ahayn.
- **Receipt email:** Resend API key iyo domain/sender la xaqiijiyey. Cinwaanka Gmail-kaaga waa contact/reply-to; adigu ma xaqiijin kartid domain-ka `gmail.com` si aad Resend uga dirto.
- **Scheduler:** CRON_SECRET si reconciliation iyo rasiidyadu u socdaan.

**Siraha geli Supabase Secrets; ha ku darin GitHub, auth-config.js, ama farriin ChatGPT ah.** `secrets.env.example` waa magacyada dejimaha, mana wato sir la sameeyey.

Server-ka Edge Function iyo jadwalkiisa waxaa lagu rakibaa sida `DEPLOYMENT.md` ku qoran. Qof technical ah ayaa commands-ka kuu fulin kara adiga oo akoonnada iska leh. EVC/eDahab manual transfer-kii hore wuu sii jiraa; automatic verification lama sheegayo ilaa provider-ka saxda ah la hawlgeliyo.

## 5. GitHub update

ZIP-ka Extract All ku fur. **Kaliya faylasha gudaha `GITHUB_UPDATE` geli repository-ga root-kiisa**, halka `index.html` yaallo. Ha gelin folder-ka laftiisa gudaha folder kale. Ha upload-gareyn ZIP-ka ama SERVER/SOURCE/tests/secret files.

Faylasha isla magacyada leh update-garee. Ha tirtirin assets-ka iyo buugaagta bilaashka ah. Labada paid PDF ee kor ku qoran si gaar ah uga saar kadib private upload. Upload-ka update-kan wuxuu ka yar yahay 100 fayl.

Sug GitHub Pages deployment-ka inuu dhammaado, kadib Ctrl+Shift+R; telefoonka isticmaal private tab markaad tijaabinayso.

## 6. Ka hor furitaanka lacag-bixinta tooska ah

Tijaabi staging/sandbox: user A iyo user B; buy, pending, failed, cancelled, paid; hal lacag oo marar badan webhook-keeda la diro; My Library; PDF; rasiid; telefoon iyo PC. Kadib samee tijaabo live ah oo yar marka merchant-ku oggolaado. **Tijaabo live ah wali lama samayn.**

Ansixi Terms, Privacy iyo Refund policy; xaqiiji aqoonsiga ganacsiga, cinwaanka, xuquuqda iibinta buugaagta, xeerarka xog-haynta iyo shuruudaha provider-ka. Bilowga ha ku darin adeeg bangi aan heshiiskiisa/credentials-kiisa la hayn.

## Maamulka maalinlaha ah

- Books: ku dar/edit/qiime/qarin/ka saar muuqaallada/soo celi. Buyers-kii hore access-kooda si otomaatig ah loogama tirtiro marka buug la qariyo.
- Orders: manual transfer ku ansixi oo keliya kadib marka aad provider account-ka ka xaqiijiso reference-ka iyo qadarka; screenshot keliya ha ku ansixin.
- Sales & operations: iibka la xaqiijiyey, dalabyada provider-ka, hubin provider, refund requests, alerts iyo audit.
- Refund: lacagta provider dashboard-ka ka celi marka la ansixiyo; kadib diiwaangeli natiijada. “Record resolution” lacag ma wareejiyo.
- Access: Receipt ID iyo sabab la diiwaangeliyey ayaad ku joojin/soo celin kartaa helitaanka. Signed link hore loo bixiyey wuxuu shaqayn karaa ilaa 15 daqiiqo.
- Reading position wuxuu ku sync-garayaa akoonka marka internet iyo migrations-ku shaqaynayaan. Notes/highlights/favorites qaabkoodii hore waxay ku jiraan qalabka; ha u qaadan backup cloud ah.

**Lahaanshaha:** GitHub, Supabase, Google OAuth, merchant accounts, email provider iyo domain-ku waa inay ahaadaan akoonnadaada. Password/MFA recovery codes adiga hayso. Koodhku kuma xirna ChatGPT; developer kale ayaa source-ka ku sii shaqayn kara.
