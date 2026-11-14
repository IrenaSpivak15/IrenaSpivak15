const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require(process.argv[2] + "/scripts/apply_theme.js");
const OUT = process.argv[3];

// Brand palette taken from the eifo-money site: near-black, mint, amber, lavender
const THEME = {
  name: "Eifo Money Insurance",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "0B0F14",   // page background
    lt1: "FFFFFF",   // primary text
    dk2: "151C24",   // card
    lt2: "8C98A4",   // muted text
    accent1: "6EE0A8", // mint
    accent2: "F2B544", // amber (money)
    accent3: "A78BFA", // lavender (AI)
    accent4: "202A35", // inner card / chip
    accent5: "E07A6C", // risk
    accent6: "3A4654", // neutral bar
    hlink: "6EE0A8", folHlink: "A78BFA",
  },
};
const H = THEME.colors;

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.title = "איפה הכסף? לחברות ביטוח – IBM Challenge";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const BG = C.text1, CARD = C.text2, TXT = C.background1, MUTED = C.background2;
  const MINT = C.accent1, AMBER = C.accent2, LAV = C.accent3, CHIP = C.accent4, RISK = C.accent5, NEUT = C.accent6;
  const W = 13.333, M = 0.6, CW = W - 2 * M;
  const RTL = { rtlMode: true, align: "right", lang: "he-IL" };

  pres.defineSlideMaster({
    title: "HERO", background: { color: BG },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: M, y: 2.0, w: 8.0, h: 1.5, fontSize: 56, bold: true, color: TXT, align: "right", valign: "middle" }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: M, y: 3.6, w: 8.0, h: 1.4, fontSize: 22, color: MUTED, align: "right", valign: "top" }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "CONTENT", background: { color: BG }, margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: M, y: 0.3, w: CW, h: 0.95, fontSize: 32, bold: true, color: TXT, align: "right", valign: "middle" }, text: "" } },
      { text: { text: "איפה הכסף? לביטוח  |  IBM Challenge", options: { x: 7.7, y: 7.02, w: 5.03, h: 0.3, fontSize: 10, color: MUTED, align: "right", rtlMode: true } } },
    ],
    slideNumber: { x: M, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, color: MUTED },
  });

  const add = (sec, master = "CONTENT") => pres.addSlide({ masterName: master, sectionTitle: sec });
  const T = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true }, RTL, o));
  const L = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, align: "left" }, o)); // LTR text (codes, numbers)
  const title = (s, text) => s.addText(text, Object.assign({ placeholder: "title" }, RTL));
  const box = (s, x, y, w, h, fill, name, r = 0.14) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: r, fill: { color: fill }, line: { color: fill }, objectName: name });
  const circleIcon = async (s, Comp, x, y, d, bg, fg, name) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg }, objectName: name + " circle" });
    const p = d * 0.26;
    s.addImage({ data: await icon(Comp, fg), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: name, objectName: name + " icon" });
  };
  const col3 = (i, w = 3.8, g = 0.365) => W - M - w - i * (w + g);

  // Finding card, styled after the findings on eifo-money.fit
  const finding = (s, x, y, w, h, f, n) => {
    box(s, x, y, w, h, CARD, "finding card " + n);
    const cw = Math.min(1.9, 0.25 + f.tag.length * 0.11);
    s.addText(f.tag, { isTextBox: true, x: x + w - 0.25 - cw, y: y + 0.25, w: cw, h: 0.38, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.19, fill: { color: CHIP }, fontSize: 12, bold: true, color: AMBER, align: "center", valign: "middle", margin: 0, rtlMode: true, objectName: "finding tag " + n });
    T(s, f.amt, { x: x + 0.2, y: y + 0.2, w: w - cw - 0.6, h: 0.48, fontSize: 18, bold: true, color: AMBER, align: "left", valign: "middle" });
    L(s, f.code, { x: x + 0.25, y: y + 0.78, w: w - 0.5, h: 0.3, fontSize: 11, fontFace: "Courier New", color: MUTED, align: "right", margin: 0 });
    T(s, f.title, { x: x + 0.25, y: y + 1.12, w: w - 0.5, h: 0.95, fontSize: 17, bold: true, color: TXT, valign: "top", margin: 0 });
    T(s, f.detail, { x: x + 0.25, y: y + 2.1, w: w - 0.5, h: 1.3, fontSize: 14, color: MUTED, valign: "top", margin: 0 });
    // confidence meter
    T(s, "ביטחון " + f.conf + "%", { x: x + w - 0.25 - 1.6, y: y + 3.45, w: 1.6, h: 0.32, fontSize: 12, color: MUTED, margin: 0, valign: "middle" });
    const lit = Math.round(f.conf / 20);
    for (let k = 0; k < 5; k++)
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + w - 2.0 - k * 0.14, y: y + 3.49, w: 0.08, h: 0.24, rectRadius: 0.03, fill: { color: k < lit ? MINT : NEUT }, line: { color: k < lit ? MINT : NEUT }, objectName: `confidence bar ${n}.${k}` });
    box(s, x + 0.2, y + 3.9, w - 0.4, h - 4.1, CHIP, "finding action " + n, 0.1);
    T(s, [{ text: "פעולה: ", options: { bold: true, color: MINT } }, { text: f.action, options: { color: TXT } }],
      { x: x + 0.35, y: y + 3.95, w: w - 0.7, h: h - 4.2, fontSize: 14, valign: "middle", margin: 0 });
  };
  const domainSlide = async (sec, ttl, sub, items, notes) => {
    const s = add(sec);
    title(s, ttl);
    T(s, sub, { x: M, y: 1.18, w: CW, h: 0.42, fontSize: 16, color: MUTED });
    items.forEach((f, i) => finding(s, col3(i), 1.75, 3.8, 5.0, f, i + 1));
    s.addNotes(notes + " כל הסכומים בשקף הם ממצאים לדוגמה בחברת ביטוח מדומה, להמחשה בלבד.");
    return s;
  };

  // ===== 1. Title =====
  pres.addSection({ title: "פתיחה" });
  let s = add("פתיחה", "HERO");
  T(s, "IBM CHALLENGE 2026  ·  INSURANCE", { x: M, y: 1.35, w: 8.0, h: 0.5, fontSize: 15, bold: true, color: MINT, charSpacing: 3 });
  s.addText("איפה הכסף? לביטוח", Object.assign({ placeholder: "title" }, RTL));
  s.addText("בוט שנכנס למחלקת ה-IT, ממפה כוח אדם, חשמל ומערכות, ובונה אנציקלופדיה ארגונית אחת — ומשם מוצא איפה הכסף, בלי לגעת ביחס התביעות.", Object.assign({ placeholder: "body" }, RTL));
  L(s, "eifo-money.fit", { x: M, y: 5.6, w: 4, h: 0.4, fontSize: 14, color: MUTED, align: "right" });
  s.addShape(pres.shapes.OVAL, { x: 9.5, y: 1.8, w: 3.2, h: 3.2, fill: { color: CARD }, line: { color: MINT, width: 2 }, objectName: "hero ring" });
  s.addImage({ data: await icon(fa.FaSearchDollar, H.accent1), x: 10.3, y: 2.6, w: 1.6, h: 1.6, altText: "זכוכית מגדלת על סימן כסף", objectName: "hero icon" });
  s.addNotes("פתיחה: אנחנו 'איפה הכסף?' — וזו הגרסה לחברות ביטוח. המסר: אקטוארים מכיילים את יחס התביעות עד עשירית האחוז, ואנחנו עושים אותו דבר לשורת ה-IT והדאטה ביחס ההוצאות.");

  // ===== 2. Problem in actuarial terms =====
  pres.addSection({ title: "הבעיה" });
  s = add("הבעיה");
  title(s, "יחס התביעות מכויל עד עשירית האחוז. יחס ההוצאות — לא");
  T(s, "יחס משולב (Combined Ratio) = יחס תביעות + יחס הוצאות  ·  חברה לדוגמה", { x: M, y: 1.3, w: CW, h: 0.45, fontSize: 16, color: MUTED });
  const segs = [{ v: 68, lab: "יחס תביעות", c: NEUT, tc: TXT }, { v: 15, lab: "עמלות ורכישה", c: "56657A", tc: TXT }, { v: 12, lab: "תפעול: אנשים, חשמל, מערכות IT", c: MINT, tc: "0B0F14" }];
  const unit = CW / 100; let xr = W - M;
  segs.forEach((g, i) => {
    const w = g.v * unit; xr -= w;
    s.addShape(pres.shapes.RECTANGLE, { x: xr, y: 1.95, w, h: 1.0, fill: { color: g.c }, line: { color: BG, width: 2 }, objectName: "ratio segment " + (i + 1) });
    L(s, g.v + "%", { x: xr, y: 1.95, w, h: 1.0, fontSize: 26, bold: true, color: g.tc, align: "center", valign: "middle", margin: 0 });
    const ex = i === 2 ? 0.2 : 0;
    T(s, g.lab, { x: xr - ex, y: 3.02, w: w + 2 * ex, h: i === 2 ? 0.65 : 0.4, fontSize: 13, bold: i === 2, color: i === 2 ? MINT : MUTED, align: "center", margin: 0 });
  });
  L(s, "95%", { x: M - 0.1, y: 1.95, w: 5 * unit + 0.1, h: 1.0, fontSize: 14, bold: true, color: TXT, align: "center", valign: "middle", margin: 0 });
  T(s, "יחס משולב", { x: M - 0.2, y: 1.6, w: 1.2, h: 0.3, fontSize: 11, color: MUTED, align: "left", margin: 0 });
  const pcards = [
    { big: "₪200K", lab: "שווה נקודת בסיס אחת ביחס ההוצאות, בחברה עם ₪2 מיליארד פרמיות ברוטו", c: AMBER },
    { big: "0.1%", lab: "רמת הדיוק שבה האקטואר מכייל את יחס התביעות, את העתודות ואת התמחור", c: TXT },
    { big: "קופסה שחורה", lab: "כוח אדם, חשמל ומערכות IT: שלושה מקורות הוצאה שאיש לא מצליב ביניהם", c: MINT },
  ];
  pcards.forEach((p, i) => {
    const x = col3(i), y = 3.85;
    box(s, x, y, 3.8, 2.85, CARD, "problem card " + (i + 1));
    T(s, p.big, { x: x + 0.3, y: y + 0.3, w: 3.2, h: 0.9, fontSize: i === 2 ? 30 : 40, bold: true, color: p.c, valign: "middle" });
    T(s, p.lab, { x: x + 0.3, y: y + 1.3, w: 3.2, h: 1.35, fontSize: 15, color: MUTED, valign: "top" });
  });
  s.addNotes("מדברים בשפת האקטואר: יחס משולב. כל נקודת בסיס (0.01%) ביחס ההוצאות של חברה עם 2 מיליארד ₪ פרמיות שווה 200 אלף ₪ — בדיוק כמו נקודת בסיס ביחס התביעות. אבל את יחס התביעות מנתחים לעומק, ואת הוצאות התפעול — אנשים, חשמל ומערכות IT — לא. היחסים בגרף להמחשה.");

  // ===== J. Journey =====
  pres.addSection({ title: "הרעיון" });
  s = add("הרעיון");
  title(s, "הרעיון: נכנסים ל-IT, יוצאים עם אנציקלופדיה ארגונית");
  T(s, "״איפה הכסף?״ מתחיל במיפוי. הכסף הוא מה שמגלים בסוף", { x: M, y: 1.18, w: CW, h: 0.42, fontSize: 16, color: MUTED });
  const jr = [
    { ic: fa.FaDoorOpen, h: "נכנסים ל-IT", t: "קריאה בלבד: קוד, תהליכים, טבלאות, דוחות וחשבוניות" },
    { ic: fa.FaLayerGroup, h: "ממפים 3 נושאים", t: "כוח אדם, חשמל ומערכות IT" },
    { ic: fa.FaSitemap, h: "מקשרים למחלקות", t: "כל נכס למחלקה שמשתמשת בו ולגורם אחראי" },
    { ic: fa.FaSearchPlus, h: "צוללים לתהליכים", t: "למשל תביעות: כל המערכות, הטבלאות והדוחות" },
    { ic: fa.FaBook, h: "אנציקלופדיה ארגונית", t: "ומשם רואים כפילויות — ואיפה הכסף" },
  ];
  const jw = 2.25, jg = (CW - 5 * jw) / 4;
  s.addShape(pres.shapes.LINE, { x: M + jw / 2, y: 2.35, w: CW - jw, h: 0, line: { color: NEUT, width: 3 }, objectName: "journey line" });
  for (let i = 0; i < 5; i++) {
    const j = jr[i], x = W - M - jw - i * (jw + jg), last = i === 4;
    await circleIcon(s, j.ic, x + jw / 2 - 0.55, 1.8, 1.1, last ? H.accent2 : H.accent4, last ? H.dk1 : H.accent1, j.h);
    s.addText(String(i + 1), { isTextBox: true, x: x + jw / 2 + 0.3, y: 1.7, w: 0.4, h: 0.4, shape: pres.shapes.OVAL, fill: { color: MINT }, fontSize: 13, bold: true, color: "0B0F14", align: "center", valign: "middle", margin: 0, objectName: "journey number " + (i + 1) });
    T(s, j.h, { x, y: 3.05, w: jw, h: 0.75, fontSize: 18, bold: true, color: last ? AMBER : TXT, align: "center", valign: "middle" });
    T(s, j.t, { x: x + 0.05, y: 3.8, w: jw - 0.1, h: 1.0, fontSize: 14, color: MUTED, align: "center", valign: "top" });
  }
  const pills = [["המוצר", "איפה הכסף?"], ["המנוע", "IBM Bob + watsonx"], ["התוצר", "אנציקלופדיה ארגונית"]];
  pills.forEach(([k, v], i) => {
    const x = col3(i), y = 5.35;
    box(s, x, y, 3.8, 1.25, i === 2 ? "17362A" : CARD, "pill " + (i + 1));
    T(s, k, { x: x + 0.25, y: y + 0.12, w: 3.3, h: 0.4, fontSize: 13, color: MUTED, margin: 0 });
    T(s, v, { x: x + 0.25, y: y + 0.52, w: 3.3, h: 0.55, fontSize: 20, bold: true, color: i === 2 ? MINT : TXT, margin: 0, valign: "middle" });
  });
  s.addNotes("זה הסיפור כולו בשקף אחד. באים למחלקת ה-IT, ממפים שלושה נושאים — כוח אדם, חשמל ומערכות IT — מקשרים כל נכס למחלקה ולגורם אחראי, צוללים לתהליכים כמו תביעות, ובסוף יש אנציקלופדיה ארגונית. הכפילויות והכסף הם תוצר של המפה.");

  // ===== 2a. Catalog built by Bob =====
  pres.addSection({ title: "הבסיס: אנציקלופדיה" });
  s = add("הבסיס: אנציקלופדיה");
  title(s, "שלב 1: IBM Bob בונה קטלוג של כל תוצרי ה-IT");
  T(s, "לפני שמחפשים כסף — ממפים. לכל תוצר: מה נכנס, מה יוצא, למה הוא מקושר ומי משתמש בו", { x: M, y: 1.18, w: CW, h: 0.42, fontSize: 16, color: MUTED });
  const reads = [
    { ic: fa.FaCode, h: "קוד ושאילתות", tools: "GitHub · GitLab · SQL" },
    { ic: fa.FaCogs, h: "תהליכים מתוזמנים", tools: "Airflow · Control-M · SSIS" },
    { ic: fa.FaDatabase, h: "סכמות וטבלאות", tools: "Oracle · DB2 · Snowflake" },
    { ic: fa.FaChartBar, h: "דוחות ולוחות מחוונים", tools: "Power BI · Qlik · Tableau" },
  ];
  T(s, "מה Bob קורא", { x: 8.2, y: 1.75, w: 4.53, h: 0.45, fontSize: 18, bold: true, color: MINT });
  for (let i = 0; i < 4; i++) {
    const r = reads[i], y = 2.3 + i * 1.08;
    box(s, 8.2, y, 4.53, 0.92, CARD, "bob reads " + (i + 1));
    await circleIcon(s, r.ic, W - M - 0.8, y + 0.14, 0.64, CHIP, H.accent1, r.h);
    T(s, r.h, { x: 8.4, y: y + 0.08, w: 3.4, h: 0.42, fontSize: 16, bold: true, color: TXT, margin: 0, valign: "middle" });
    L(s, r.tools, { x: 8.4, y: y + 0.5, w: 3.4, h: 0.32, fontSize: 12, color: MUTED, align: "right", margin: 0 });
  }
  s.addImage({ data: await icon(fa.FaArrowLeft, H.accent2), x: 7.55, y: 3.95, w: 0.45, h: 0.45, altText: "חץ", objectName: "catalog arrow" });
  // catalog entry mock
  const cx = M, cy = 1.75, cwd = 6.75;
  box(s, cx, cy, cwd, 4.95, CARD, "catalog entry");
  s.addText("רשומת קטלוג", { isTextBox: true, x: cx + cwd - 1.85, y: cy + 0.25, w: 1.6, h: 0.38, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.19, fill: { color: CHIP }, fontSize: 12, bold: true, color: MINT, align: "center", valign: "middle", margin: 0, rtlMode: true, objectName: "catalog chip" });
  T(s, "חישוב תעריף רכב — לילי", { x: cx + 0.3, y: cy + 0.75, w: cwd - 0.6, h: 0.55, fontSize: 22, bold: true, color: TXT, margin: 0 });
  const fields = [
    ["סוג", "תהליך מתוזמן", false],
    ["אינפוט", "policy_master · claims_hist · credit_ext", true],
    ["אאוטפוט", "rate_table_auto", true],
    ["משרת", "תמחור (ראשי), חיתום", false],
    ["בעלים", "צוות תמחור רכב", false],
    ["עלות", "₪95K בשנה — מחשוב וחשמל", false],
  ];
  fields.forEach(([k, v, ltr], i) => {
    const y = cy + 1.45 + i * 0.47;
    T(s, k, { x: cx + cwd - 1.5, y, w: 1.2, h: 0.4, fontSize: 14, bold: true, color: AMBER, margin: 0, valign: "middle" });
    if (ltr) L(s, v, { x: cx + 0.3, y, w: cwd - 1.9, h: 0.4, fontSize: 13, fontFace: "Courier New", color: TXT, align: "right", margin: 0, valign: "middle" });
    else T(s, v, { x: cx + 0.3, y, w: cwd - 1.9, h: 0.4, fontSize: 14, color: TXT, margin: 0, valign: "middle" });
  });
  box(s, cx + 0.25, cy + 4.3, cwd - 0.5, 0.5, "3A3020", "catalog flag", 0.1);
  T(s, "כפילות אפשרית: אותו אאוטפוט נבנה גם בתהליך SAS נפרד", { x: cx + 0.4, y: cy + 4.3, w: cwd - 0.8, h: 0.5, fontSize: 14, bold: true, color: AMBER, valign: "middle", margin: 0 });
  s.addNotes("זה הבסיס של המוצר. IBM Bob נכנס ל-IT — קוד, תהליכים מתוזמנים, סכמות ודוחות — ובונה קטלוג: לכל תוצר מה נכנס, מה יוצא, למה הוא מקושר, מי משתמש בו וכמה הוא עולה. בלי הקטלוג אי אפשר לדעת ששני תהליכים עושים אותו דבר.");

  // ===== 2b. Semantic layer =====
  s = add("הבסיס: אנציקלופדיה");
  title(s, "שכבה סמנטית אחת: איזו טבלה משרתת איזה תהליך");
  const colT = { x: 10.23, w: 2.5 }, colP = { x: 5.55, w: 3.1 }, colB = { x: M, w: 2.1 };
  [["טבלאות", colT], ["תהליכי IT", colP], ["תהליכים עסקיים", colB]].forEach(([h, c]) =>
    T(s, h, { x: c.x, y: 1.2, w: c.w, h: 0.4, fontSize: 16, bold: true, color: MINT, align: "center" }));
  const ys = [1.75, 2.55, 3.35, 4.15, 4.95], ch = 0.52;
  const tabs = ["policy_master", "claims_hist", "model_points", "policy_snapshot_q3", "credit_ext"];
  const procs2 = [["תעריף רכב — Python", false], ["תעריף רכב — SAS", true], ["תחזית תזרים IFRS 17", false], ["תחזית תזרים כושר פירעון", true], ["שליפת דוח אשראי", false]];
  const biz = [["תמחור", 2.15], ["דוחות", 3.75], ["חיתום", 4.95]];
  const line = (x1, y1, x2, y2, col, n) => {
    const o = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), line: { color: col, width: 1.5 }, objectName: "link " + n };
    if ((x1 > x2) !== (y1 > y2) && o.h > 0) o.flipH = true;
    s.addShape(pres.shapes.LINE, o);
  };
  const tE = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 2], [2, 3], [3, 2], [4, 4]];
  tE.forEach(([t, p], n) => line(colT.x, ys[t] + ch / 2, colP.x + colP.w, ys[p] + ch / 2, procs2[p][1] ? AMBER : NEUT, "t" + n));
  const pE = [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2]];
  pE.forEach(([p, b], n) => line(colP.x, ys[p] + ch / 2, colB.x + colB.w, biz[b][1] + ch / 2, procs2[p][1] ? AMBER : NEUT, "p" + n));
  tabs.forEach((t, i) => {
    box(s, colT.x, ys[i], colT.w, ch, CARD, "table " + (i + 1), 0.08);
    L(s, t, { x: colT.x + 0.1, y: ys[i], w: colT.w - 0.2, h: ch, fontSize: 12, fontFace: "Courier New", color: TXT, align: "center", valign: "middle", margin: 0 });
  });
  s.addText("4 עותקים", { isTextBox: true, x: colT.x - 0.25, y: ys[3] - 0.18, w: 0.95, h: 0.32, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.16, fill: { color: AMBER }, fontSize: 11, bold: true, color: "0B0F14", align: "center", valign: "middle", margin: 0, rtlMode: true, objectName: "copies badge" });
  procs2.forEach(([p, dup], i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: colP.x, y: ys[i], w: colP.w, h: ch, rectRadius: 0.08, fill: { color: dup ? "3A3020" : CARD }, line: { color: dup ? AMBER : CARD, width: 1.5 }, objectName: "process " + (i + 1) });
    T(s, p, { x: colP.x + 0.1, y: ys[i], w: colP.w - 0.2, h: ch, fontSize: 14, bold: dup, color: dup ? AMBER : TXT, align: "center", valign: "middle", margin: 0 });
  });
  biz.forEach(([b, y], i) => {
    box(s, colB.x, y, colB.w, ch, "17362A", "business " + (i + 1), 0.08);
    T(s, b, { x: colB.x, y, w: colB.w, h: ch, fontSize: 16, bold: true, color: MINT, align: "center", valign: "middle", margin: 0 });
  });
  const ins = [
    { big: "כל טבלה", t: "יודעים איזה תהליך היא מזינה ומי הבעלים" },
    { big: "כל תהליך", t: "יודעים מה האינפוט, מה האאוטפוט ולמי הוא משרת" },
    { big: "כל כפילות", t: "אותו אאוטפוט מאותם אינפוטים — מסומן אוטומטית" },
  ];
  ins.forEach((c, i) => {
    const x = col3(i), y = 5.75;
    box(s, x, y, 3.8, 0.98, CARD, "insight " + (i + 1));
    T(s, c.big, { x: x + 0.2, y: y + 0.06, w: 3.4, h: 0.42, fontSize: 16, bold: true, color: i === 2 ? AMBER : TXT, margin: 0, valign: "middle" });
    T(s, c.t, { x: x + 0.2, y: y + 0.48, w: 3.4, h: 0.42, fontSize: 13, color: MUTED, margin: 0, valign: "middle" });
  });
  s.addNotes("זו השכבה הסמנטית: טבלאות, תהליכי IT ותהליכים עסקיים במפה אחת. עכשיו כולם רואים את אותה תמונה. הכפילויות קופצות לבד: שני תהליכים שבונים את אותו תעריף מאותן טבלאות, שני מנועים שמחשבים את אותה תחזית תזרים, וארבעה עותקים של אותו צילום רבעוני. רק מכאן ממשיכים לשאלה איפה הכסף.");

  // ===== N. Network: topics x departments x owners =====
  s = add("הבסיס: אנציקלופדיה");
  title(s, "הרשת: 3 נושאים × מחלקות × גורם אחראי");
  const topics = [[fa.FaUsers, "כוח אדם"], [fa.FaBolt, "חשמל"], [fa.FaLaptopCode, "מערכות IT"]];
  const depts = [
    ["תביעות", "סמנכ״ל תביעות", ["46 עובדים · 9 תהליכים", "14 שרתים · ארכיון מסמכים", "11 מערכות · 38 דוחות"]],
    ["חיתום", "מנהל חיתום ראשי", ["32 עובדים · 6 תהליכים", "30 שרתי ליבה ישנים", "7 מערכות · 4 ספקי מידע"]],
    ["תמחור", "אקטואר תמחור ראשי", ["12 אקטוארים · 5 מודלים", "שרתי GPU לריצות לילה", "6 כלי מידול"]],
    ["כספים ואקטואריה", "אקטואר ממונה", ["18 עובדים · 4 סגירות", "40 שרתי חישוב", "3 כלי BI · 2 מנועי תזרים"]],
  ];
  const dw = 2.6, ng = 0.1, tw = (CW - dw - 3 * ng) / 3, th = 0.75, rh2 = 0.95, ny = 1.45;
  for (let i = 0; i < 3; i++) {
    const x = W - M - dw - ng - tw - i * (tw + ng);
    box(s, x, ny, tw, th, "17362A", "topic header " + (i + 1), 0.1);
    await circleIcon(s, topics[i][0], x + tw - 0.65, ny + 0.12, 0.5, BG, H.accent1, topics[i][1]);
    T(s, topics[i][1], { x: x + 0.2, y: ny, w: tw - 0.95, h: th, fontSize: 19, bold: true, color: TXT, valign: "middle", margin: 0 });
  }
  for (let j = 0; j < 4; j++) {
    const d = depts[j], y = ny + th + ng + j * (rh2 + ng);
    box(s, W - M - dw, y, dw, rh2, CHIP, "dept " + (j + 1), 0.1);
    T(s, d[0], { x: W - M - dw + 0.15, y: y + 0.08, w: dw - 0.3, h: 0.45, fontSize: 18, bold: true, color: AMBER, margin: 0, valign: "middle" });
    s.addImage({ data: await icon(fa.FaUserCheck, H.accent1), x: W - M - 0.45, y: y + 0.6, w: 0.24, h: 0.24, altText: "גורם אחראי", objectName: "owner icon " + (j + 1) });
    T(s, d[1], { x: W - M - dw + 0.15, y: y + 0.52, w: dw - 0.65, h: 0.36, fontSize: 13, color: MINT, margin: 0, valign: "middle" });
    for (let i = 0; i < 3; i++) {
      const x = W - M - dw - ng - tw - i * (tw + ng);
      box(s, x, y, tw, rh2, CARD, `node ${j + 1}.${i + 1}`, 0.1);
      T(s, d[2][i], { x: x + 0.2, y, w: tw - 0.4, h: rh2, fontSize: 15, color: TXT, valign: "middle", margin: 0 });
    }
  }
  T(s, "כל צומת ברשת = נכס + מחלקה + גורם אחראי. יחד הם האנציקלופדיה הארגונית (מספרים להמחשה)", { x: M, y: 6.5, w: CW, h: 0.4, fontSize: 14, bold: true, italic: true, color: MINT });
  s.addNotes("זו הרשת: מצד אחד שלושת הנושאים — כוח אדם, חשמל ומערכות IT. מצד שני המחלקות. לכל צומת יש גורם אחראי. כך כל שאלה — מי משתמש בשרת הזה, מי אחראי על הדוח הזה — מקבלת תשובה אחת.");

  // ===== C1. Claims systems map =====
  pres.addSection({ title: "צלילה: תביעות" });
  s = add("צלילה: תביעות");
  title(s, "צוללים לתביעות: כל המערכות שמשרתות את התהליך");
  const stages = [
    ["פתיחת תביעה", "מנהלת המוקד", [["מוקד — Salesforce", 1], ["אפליקציית לקוח", 0], ["פורטל סוכנים", 0]]],
    ["שמאות והערכה", "מנהל השמאות", [["פורטל שמאים", 0], ["מערכת תביעות ליבה", 1], ["סיכום מסמכים — AI", 0]]],
    ["יישוב ותשלום", "מנהל יישוב תביעות", [["מערכת תביעות ליבה", 0], ["תשלומים — SAP", 0], ["גיליון אישורים", 1]]],
    ["שיבוב וגבייה", "מנהלת שיבוב", [["מערכת שיבוב", 0], ["גבייה — SAP", 0]]],
    ["עתודות ודיווח", "האקטואר הממונה", [["Power BI — תפעול", 2], ["Qlik — כספים", 2], ["ResQ — אקטואריה", 2]]],
  ];
  const sw5 = (CW - 4 * 0.15) / 5;
  for (let i = 0; i < 5; i++) {
    const st = stages[i], x = W - M - sw5 - i * (sw5 + 0.15);
    box(s, x, 1.4, sw5, 0.85, "17362A", "stage " + (i + 1), 0.1);
    T(s, st[0], { x: x + 0.1, y: 1.45, w: sw5 - 0.2, h: 0.42, fontSize: 16, bold: true, color: TXT, align: "center", margin: 0, valign: "middle" });
    T(s, st[1], { x: x + 0.1, y: 1.85, w: sw5 - 0.2, h: 0.33, fontSize: 12, color: MINT, align: "center", margin: 0, valign: "middle" });
    if (i < 4) s.addImage({ data: await icon(fa.FaArrowLeft, H.lt2), x: x - 0.13, y: 1.73, w: 0.11, h: 0.18, altText: "חץ", objectName: "stage arrow " + (i + 1) });
    st[2].forEach(([nm, flag], k) => {
      const y = 2.45 + k * 0.62, dup = flag > 0;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: sw5, h: 0.5, rectRadius: 0.08, fill: { color: dup ? "3A3020" : CARD }, line: { color: dup ? AMBER : CARD, width: 1.25 }, objectName: `system ${i + 1}.${k + 1}` });
      T(s, nm, { x: x + 0.08, y, w: sw5 - 0.16, h: 0.5, fontSize: 13, bold: dup, color: dup ? AMBER : TXT, align: "center", valign: "middle", margin: 0 });
    });
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.4, w: CW, h: 0.6, rectRadius: 0.1, fill: { color: "3A3020" }, line: { color: AMBER, width: 1.25 }, objectName: "documents row" });
  T(s, "לאורך כל התהליך: מסמכי התביעה נשמרים בשתי מערכות — FileNet ו-SharePoint", { x: M + 0.2, y: 4.4, w: CW - 0.4, h: 0.6, fontSize: 15, bold: true, color: AMBER, valign: "middle", margin: 0 });
  const cst = [["11 מערכות", "משרתות את תהליך התביעות"], ["3 דוחות", "עונים על אותה שאלה, מנתונים שונים"], ["פעמיים", "תביעה מוקלדת במוקד ובמערכת הליבה"]];
  cst.forEach(([b, l], i) => {
    const x = col3(i), y = 5.25;
    box(s, x, y, 3.8, 1.4, CARD, "claims stat " + (i + 1));
    T(s, b, { x: x + 0.25, y: y + 0.12, w: 3.3, h: 0.65, fontSize: 28, bold: true, color: i === 0 ? TXT : AMBER, margin: 0, valign: "middle" });
    T(s, l, { x: x + 0.25, y: y + 0.8, w: 3.3, h: 0.45, fontSize: 14, color: MUTED, margin: 0, valign: "middle" });
  });
  s.addNotes("צלילה לתהליך אחד — תביעות. הבוט ממפה כל שלב, את המערכות שמשרתות אותו ואת הגורם האחראי. בזהב: כפילויות — תביעה שמוקלדת פעמיים, גיליון אקסל במקביל למערכת, שתי מערכות מסמכים ושלושה דוחות דיווח. שמות המערכות הם דוגמאות לכלים נפוצים.");

  // ===== C2. Same question, three answers =====
  s = add("צלילה: תביעות");
  title(s, "אותה שאלה, שלוש תשובות: כמה תביעות פתוחות יש?");
  const reps = [
    { tool: "Power BI", dept: "תפעול תביעות", n: "12,480", src: "claims_core.status", def: "תביעה שלא סומנה כסגורה במערכת הליבה", own: "מנהל יישוב תביעות" },
    { tool: "Qlik", dept: "כספים", n: "11,920", src: "sap_payments.open_items", def: "תביעה שיש לה תשלום פתוח בהנהלת החשבונות", own: "החשב" },
    { tool: "ResQ", dept: "אקטואריה", n: "12,950", src: "claims_snapshot_eom", def: "צילום לסוף החודש, כולל תביעות שנפתחו מחדש", own: "האקטואר הממונה" },
  ];
  reps.forEach((r, i) => {
    const x = col3(i), y = 1.4, h = 3.75;
    box(s, x, y, 3.8, h, CARD, "report card " + (i + 1));
    s.addText(r.tool, { isTextBox: true, x: x + 3.8 - 0.25 - 1.2, y: y + 0.25, w: 1.2, h: 0.38, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.19, fill: { color: CHIP }, fontSize: 12, bold: true, color: AMBER, align: "center", valign: "middle", margin: 0, objectName: "report tool " + (i + 1) });
    T(s, r.dept, { x: x + 0.25, y: y + 0.22, w: 2.2, h: 0.44, fontSize: 16, bold: true, color: TXT, align: "left", margin: 0, valign: "middle" });
    L(s, r.n, { x: x + 0.25, y: y + 0.8, w: 3.3, h: 0.85, fontSize: 44, bold: true, color: AMBER, align: "right", margin: 0, valign: "middle" });
    L(s, r.src, { x: x + 0.25, y: y + 1.7, w: 3.3, h: 0.32, fontSize: 11, fontFace: "Courier New", color: MUTED, align: "right", margin: 0 });
    T(s, r.def, { x: x + 0.25, y: y + 2.1, w: 3.3, h: 0.85, fontSize: 15, color: TXT, valign: "top", margin: 0 });
    T(s, "גורם אחראי: " + r.own, { x: x + 0.25, y: y + 3.1, w: 3.3, h: 0.4, fontSize: 13, color: MINT, margin: 0, valign: "middle" });
  });
  box(s, M, 5.35, CW, 1.4, "17362A", "encyclopedia entry");
  await circleIcon(s, fa.FaBook, W - M - 1.0, 5.6, 0.85, BG, H.accent2, "ערך באנציקלופדיה");
  T(s, [{ text: "ערך באנציקלופדיה: ״תביעה פתוחה״", options: { bold: true, color: MINT, breakLine: true, rtlMode: true, align: "right" } }, { text: "הגדרה אחת, טבלת מקור אחת ובעלים אחד: האקטואר הממונה. פער של 1,030 תביעות בין הדוחות נסגר, ומתפנה כמשרה של התאמות ידניות — ₪240K בשנה", options: { color: TXT, rtlMode: true, align: "right" } }],
    { x: M + 0.3, y: 5.42, w: CW - 1.6, h: 1.26, fontSize: 15, valign: "middle", margin: 0 });
  s.addNotes("זו הדוגמה החזקה ביותר לאקטוארים: שלושה דוחות עונים על אותה שאלה — כמה תביעות פתוחות — ומקבלים שלוש תשובות, כי כל אחד מחשב מנתונים אחרים ובהגדרה אחרת. האנציקלופדיה יוצרת ערך אחד עם הגדרה ובעלים. זה חוסך זמן התאמות, ובעיקר נותן לעתודות ולדוחות בסיס נתונים אחד. המספרים להמחשה.");

  // ===== 3. Matrix: 3 components x 4 processes =====
  pres.addSection({ title: "ממצאים" });
  s = add("ממצאים");
  title(s, "מה האנציקלופדיה מגלה: 3 נושאים × 4 תהליכים");
  const pil = [
    { ic: fa.FaUsers, h: "כוח אדם", amt: "₪2.18M", cells: ["אותה הצעה נבדקת פעמיים — בסוכנות ובחברה", "טבלאות תעריף מוקלדות ידנית לשלוש מערכות", "שני צוותים מתאימים את אותם נתונים לרבעון", "שלושה צוותים מפיקים דוח תביעות פתוחות"] },
    { ic: fa.FaBolt, h: "חשמל", amt: "₪435K", cells: ["שרתי מערכת הליבה הישנה עדיין דולקים", "ריצות לילה על נתונים שלא השתנו", "חוות החישוב דולקת כל השנה, עובדת 4 שבועות", "ארכיון המסמכים נשמר בשתי מערכות"] },
    { ic: fa.FaLaptopCode, h: "מערכות IT", amt: "₪1.47M", cells: ["אותו דוח חיצוני נשלף 3 פעמים על אותו מבוטח", "רישיונות כפולים לכלי מידול לאותם אקטוארים", "שלושה כלי BI לאותם דוחות הנהלה", "סיכום תיקי תביעה על מודל AI יקר"] },
  ];
  const procs = ["חיתום", "תמחור", "דוחות", "תביעות"];
  const lw = 1.6, gp = 0.1, pw = (CW - lw - 3 * gp) / 3, hh = 0.95, rh = 0.88, y0 = 1.4;
  for (let j = 0; j < 4; j++) {
    const y = y0 + hh + gp + j * (rh + gp);
    box(s, W - M - lw, y, lw, rh, CHIP, "process label " + (j + 1), 0.1);
    T(s, procs[j], { x: W - M - lw, y, w: lw - 0.2, h: rh, fontSize: 20, bold: true, color: AMBER, valign: "middle" });
  }
  for (let i = 0; i < 3; i++) {
    const p = pil[i], x = W - M - lw - gp - pw - i * (pw + gp);
    box(s, x, y0, pw, hh, "17362A", "pillar header " + (i + 1), 0.1);
    await circleIcon(s, p.ic, x + pw - 0.72, y0 + 0.2, 0.55, BG, H.accent1, p.h);
    T(s, p.h, { x: x + 1.25, y: y0 + 0.2, w: pw - 2.0, h: 0.65, fontSize: 19, bold: true, color: TXT, valign: "middle", margin: 0 });
    T(s, p.amt, { x: x + 0.12, y: y0 + 0.2, w: 1.1, h: 0.65, fontSize: 17, bold: true, color: AMBER, align: "left", valign: "middle", margin: 0 });
    for (let j = 0; j < 4; j++) {
      const y = y0 + hh + gp + j * (rh + gp);
      box(s, x, y, pw, rh, CARD, `cell ${i + 1}.${j + 1}`, 0.1);
      T(s, p.cells[j], { x: x + 0.2, y, w: pw - 0.4, h: rh, fontSize: 14, color: TXT, valign: "middle" });
    }
  }
  T(s, "ועוד במערכות IT: זיכויי SLA וחשבוניות כפולות. סכומים שנתיים, חברה מדומה עם ₪2 מיליארד פרמיות", { x: M, y: 6.55, w: CW, h: 0.35, fontSize: 12, italic: true, color: MUTED });
  s.addNotes("זה לב המצגת: שלושת הרכיבים — כוח אדם, חשמל ומערכות IT — מול שלושת התהליכים שאקטואר מכיר: חיתום, תמחור ודוחות. כל תא הוא ממצא קונקרטי שמפורט בשקפים הבאים.");

  // ===== 4-7. Component deep dives =====
  await domainSlide("ממצאים", "כוח אדם: אותה עבודה, פעמיים — בלי לפטר אף אחד",
    "ממצאים לדוגמה מיומני משימות ושעות. ההמלצה היא הסבה לעבודה בעלת ערך, לא צמצום", [
      { tag: "חיתום", amt: "₪1.1M בשנה", code: "DUP_UW_REVIEW", conf: 90, title: "אותה הצעה נבדקת פעמיים — בסוכנות ובחברה", detail: "38% מהצעות הרכב בסיכון נמוך עוברות שתי בדיקות ידניות זהות. כ-4.5 משרות בשנה", action: "אישור אוטומטי לסיכון נמוך, והסבת החתמים לסיכונים מורכבים" },
      { tag: "תמחור", amt: "₪360K בשנה", code: "MANUAL_RATE_ENTRY", conf: 94, title: "טבלאות תעריף מוקלדות ידנית לשלוש מערכות", detail: "אחרי כל עדכון תעריף הצוות מקליד את הטבלאות לשלוש מערכות ובודק פעמיים. כ-1.5 משרות", action: "העלאה אוטומטית ממודל התמחור ובדיקה אחת" },
      { tag: "דוחות", amt: "₪480K בשנה", code: "DUP_RECONCILIATION", conf: 92, title: "שני צוותים מתאימים את אותם נתונים לרבעון", detail: "האקטואריה והכספים מתאימים כל אחד בנפרד את נתוני הפוליסות לדוח הרבעוני, שלושה שבועות בכל רבעון", action: "התאמה אחת משותפת. האקטוארים מתפנים לניתוח" },
    ], "כוח אדם: הנושא הרגיש ביותר. המסר: לא מפטרים — מפנים זמן של חתמים ואקטוארים לעבודה שמשפרת את יחס התביעות. 8 משרות כאן, ועוד כמשרה בדוחות התביעות.");

  await domainSlide("ממצאים", "חשמל: שרתים שדולקים כשאף אחד לא מחשב",
    "ממצאים לדוגמה ממוני החשמל ומניצול השרתים. יחד: כ-650 מגה-ואט-שעה וכ-300 טון CO₂ בשנה", [
      { tag: "חיתום", amt: "₪125K בשנה", code: "ZOMBIE_LEGACY_SERVERS", conf: 96, title: "30 שרתים של מערכת הליבה הישנה עדיין דולקים", detail: "אפס פעולות חיתום כבר חצי שנה אחרי המיגרציה — אבל הם צורכים חשמל וקירור", action: "גיבוי, כיבוי ופינוי מחדר השרתים" },
      { tag: "תמחור", amt: "₪95K בשנה", code: "IDLE_NIGHTLY_RERUN", conf: 93, title: "ריצות לילה על נתונים שלא השתנו", detail: "מודל תמחור הרכב מאומן מחדש כל לילה על שרתי GPU, אף שהנתונים מתעדכנים פעם בחודש", action: "הרצה רק כשהנתונים משתנים — פחות קוט״ש" },
      { tag: "דוחות", amt: "₪170K בשנה", code: "IDLE_GRID_FARM", conf: 93, title: "חוות החישוב דולקת כל השנה, עובדת 4 שבועות", detail: "40 שרתי חישוב לתחזיות התזרים הרבעוניות, בניצול של 6% מחוץ לסגירת הרבעון", action: "כיבוי בין סגירות, או חישוב בענן לפי דרישה" },
    ], "חשמל: החישוב לפי כ-0.6 ₪ לקוט״ש כולל קירור, ומקדם פליטה של כ-0.47 ק״ג CO₂ לקוט״ש. הנחות להמחשה — לבדוק מול התעריף ומקדם הפליטה העדכניים.");

  await domainSlide("ממצאים", "מערכות IT: משלמים פעמיים על מידע ועל כלים",
    "ממצאים לדוגמה מחשבוניות ספקי המידע, מרישיונות הכלים ומיומני השימוש", [
      { tag: "ספקי מידע", amt: "₪410K בשנה", code: "DUP_EXT_DATA_PULL", conf: 97, title: "אותו דוח חיצוני נשלף 3 פעמים על אותו מבוטח", detail: "היסטוריית תביעות ודירוג אשראי נשלפים בהצעה, בחיתום ובחידוש — בתוך 30 יום, בתשלום לכל שליפה", action: "שמירת הדוח ל-90 יום לפי ת.ז. — אותו מידע, אותה איכות חיתום" },
      { tag: "SAS", amt: "₪260K בשנה", code: "DUP_MODELING_SEATS", conf: 96, title: "14 אקטוארים מחזיקים שני כלי מידול", detail: "גם רישיון SAS וגם רישיון לכלי GLM מסחרי. בנוסף, 9 מושבים שלא נפתחו ב-90 הימים האחרונים", action: "איחוד לכלי אחד לכל צוות וביטול המושבים הרדומים" },
      { tag: "Power BI", amt: "₪220K בשנה", code: "DUP_BI_STACK", conf: 94, title: "שלושה כלי BI מפיקים את אותם דוחות הנהלה", detail: "דוח יחס התביעות החודשי קיים בשלושה כלים שונים, עם שלושה צוותי תחזוקה", action: "בחירת כלי אחד ומעבר הדרגתי של הדוחות" },
    ], "מערכות IT, חלק א: מידע, רישיונות ודוחות — בחיתום, בתמחור ובדוחות.");

  await domainSlide("ממצאים", "מערכות IT: בינה מלאכותית, חוזים וחשבוניות",
    "ממצאים לדוגמה מחשבונות ה-AI, מחוזי הספקים, מהנהלת החשבונות ומהבנק", [
      { tag: "Anthropic", amt: "₪214K בשנה", code: "AI_FLAGSHIP_OVERUSE", conf: 95, title: "סיכום תיקי תביעה רץ על מודל הדגל היקר", detail: "סיווג וסיכום מסמכים פשוטים במודל הגדול, בלי שמירת ההנחיה הקבועה במטמון", action: "מעבר למודל קטן מאותה משפחה — דיוק דומה, כחמישית מהמחיר" },
      { tag: "Microsoft 365", amt: "₪60K זיכוי", code: "SLA_CREDIT_UNCLAIMED", conf: 88, title: "זמינות מתחת ל-99.9% — וזיכוי שלא נדרש", detail: "לפי הסכם רמת השירות של מיקרוסופט ושני ספקים נוספים, חודש עם זמינות נמוכה מזכה בזיכוי — ואיש לא דרש אותו", action: "הגשת בקשות זיכוי ומעקב חודשי אחרי עמידת הספקים בהתחייבות" },
      { tag: "מוסכים", amt: "₪310K להחזר", code: "DUP_VENDOR_INVOICE", conf: 97, title: "אותה חשבונית שולמה פעמיים", detail: "חשבונית מוסך שולמה בהעברה בנקאית ושוב דרך מערכת התביעות, עם מספר תיק תביעה זהה", action: "דרישת החזר מהספק וחסימת תשלום כפול לפי מספר תיק" },
    ], "מערכות IT, חלק ב: כאן גם ממצא ה-SLA — ההתחייבות של מיקרוסופט ל-99.9% זמינות חודשית מזכה בזיכוי כשהיא לא מתקיימת.");

  // ===== 7a. Tech stack map =====
  s = add("ממצאים");
  title(s, "הכלים הטכנולוגיים: איפה הכסף בסטאק של חברת ביטוח");
  const stack = [
    { ic: fa.FaServer, h: "מערכות ליבה ביטוחיות", tools: "Sapiens · Guidewire · Duck Creek", t: "מערכת ישנה וחדשה רצות במקביל אחרי מיגרציה, עם שני חוזי תחזוקה" },
    { ic: fa.FaCalculator, h: "אקטואריה ומידול", tools: "SAS · Prophet · Moody's AXIS · Emblem", t: "אותם אקטוארים עם רישיון לשני כלים, ומושבים שלא נפתחו חודשים" },
    { ic: fa.FaCloud, h: "ענן ונתונים", tools: "AWS · Azure · Snowflake · Databricks", t: "מחשוב לילי על נתונים שלא השתנו, ועותקים כפולים של אותם נתונים" },
    { ic: fa.FaChartBar, h: "דוחות ובינה עסקית", tools: "Power BI · Tableau · Qlik", t: "אותו דוח הנהלה מתוחזק בשלושה כלים, עם שלושה צוותים" },
    { ic: fa.FaRobot, h: "בינה מלאכותית ופיתוח", tools: "OpenAI · Anthropic · Copilot · Cursor", t: "מודל דגל למשימות פשוטות, מפתחות של עובדים שעזבו, שני עוזרי קוד לאותו מפתח" },
    { ic: fa.FaUsers, h: "שיתוף פעולה ומנויים", tools: "Microsoft 365 · Zoom · Slack · Salesforce", t: "מושבים של עובדים שעזבו, שני כלי ועידה, זיכויי SLA שלא נדרשו" },
  ];
  for (let i = 0; i < 6; i++) {
    const c = stack[i], x = col3(i % 3), y = 1.45 + Math.floor(i / 3) * 2.72, w = 3.8, h = 2.5;
    box(s, x, y, w, h, CARD, "stack card " + (i + 1));
    await circleIcon(s, c.ic, x + w - 0.95, y + 0.25, 0.7, CHIP, i === 4 ? H.accent3 : H.accent1, c.h);
    T(s, c.h, { x: x + 0.2, y: y + 0.3, w: w - 1.3, h: 0.6, fontSize: 17, bold: true, color: TXT, valign: "middle", margin: 0 });
    L(s, c.tools, { x: x + 0.2, y: y + 1.0, w: w - 0.4, h: 0.35, fontSize: 12, bold: true, color: i === 4 ? LAV : MINT, align: "right", margin: 0 });
    T(s, c.t, { x: x + 0.2, y: y + 1.42, w: w - 0.4, h: 0.95, fontSize: 14, color: MUTED, valign: "top", margin: 0 });
  }
  s.addNotes("זה הסטאק הטכנולוגי הטיפוסי של חברת ביטוח, והכפילות הנפוצה בכל שכבה. שמות הכלים הם דוגמאות לכלים נפוצים בשוק — לא טענה על לקוח מסוים.");

  // ===== 7b. Integrations =====
  s = add("ממצאים");
  title(s, "החיבורים: מאיפה כל מספר מגיע");
  const ihdr = ["מקור", "כלים לדוגמה", "מה אנחנו קוראים", "כללים לדוגמה"];
  const irows = [
    ["קוד ותהליכי IT", "GitHub · Airflow · dbt · SQL", "קוד, ג׳ובים, סכמות וטבלאות — לבניית הקטלוג", "DUP_PIPELINE_OUTPUT\nDUP_TABLE_COPY"],
    ["כוח אדם", "HiBob · Jira · ServiceNow", "שעות לפי משימה ותהליך, תפקידים", "DUP_UW_REVIEW\nDUP_RECONCILIATION"],
    ["חשמל", "BMS · Smart meters · IPMI", "צריכת קוט״ש וניצול שרתים לפי שעה", "IDLE_GRID_FARM\nZOMBIE_LEGACY_SERVERS"],
    ["הנהלת חשבונות ובנק", "Priority · SAP · Leumi · Cal", "חשבוניות, העברות וחיובי כרטיס", "DUP_VENDOR_INVOICE\nDUP_CROSS_CURRENCY"],
    ["ענן", "AWS Cost Explorer · Azure Cost Mgmt", "עלות לפי שירות, תגית ופרויקט", "IDLE_GLM_RERUN"],
    ["בינה מלאכותית", "OpenAI · Anthropic — Usage API", "טוקנים לפי מפתח, מודל ופרויקט", "AI_FLAGSHIP_OVERUSE"],
    ["רישיונות וספקי מידע", "Microsoft 365 · Okta · Sapiens", "מושבים, כניסה אחרונה, שליפות לפי מבוטח", "DUP_EXT_DATA_PULL\nDUP_MODELING_SEATS"],
  ];
  const hc = (t) => ({ text: t, options: { bold: true, color: "0B0F14", fill: { color: H.accent1 }, align: "center", rtlMode: true, fontSize: 14, valign: "middle" } });
  const itbl = [ihdr.slice().reverse().map(hc)];
  irows.forEach((r, ri) => {
    const fill = { color: ri % 2 ? H.dk1 : H.dk2 };
    itbl.push([
      { text: r[3], options: { fill, color: H.lt2, fontFace: "Courier New", fontSize: 11, align: "center", valign: "middle" } },
      { text: r[2], options: { fill, color: "FFFFFF", fontSize: 14, align: "right", rtlMode: true, valign: "middle" } },
      { text: r[1], options: { fill, color: ri === 5 ? H.accent3 : H.accent1, bold: true, fontSize: 13, align: "center", valign: "middle" } },
      { text: r[0], options: { fill, color: "FFFFFF", bold: true, fontSize: 14, align: "right", rtlMode: true, valign: "middle" } },
    ]);
  });
  s.addTable(itbl, { x: M, y: 1.45, w: CW, colW: [2.75, 3.4, 3.68, 2.3], rowH: [0.42, 0.58, 0.56, 0.56, 0.56, 0.48, 0.48, 0.56], border: { type: "solid", pt: 1, color: H.accent4 }, objectName: "integrations table" });
  box(s, M, 6.05, CW, 0.7, CARD, "read only band");
  s.addImage({ data: await icon(fa.FaLock, H.accent1), x: W - M - 0.6, y: 6.2, w: 0.4, h: 0.4, altText: "מנעול", objectName: "read only icon" });
  T(s, "כל החיבורים בקריאה בלבד. כתיבה רק למשימות ב-Jira או ServiceNow, באישור אדם", { x: M + 0.3, y: 6.08, w: CW - 1.2, h: 0.64, fontSize: 16, bold: true, color: TXT, valign: "middle" });
  s.addNotes("כאן רואים את הטכנולוגיה בפועל: לכל מקור — הכלים, מה נקרא דרך ה-API, ואילו כללים רצים עליו. למשל: ה-Usage API של OpenAI ו-Anthropic נותן טוקנים לפי מפתח ומודל; HiBob נותן תאריך סיום העסקה, ו-Microsoft 365 נותן מושבים פעילים — וההצלבה מגלה מושבים של עובדים שעזבו.");

  // ===== 8. Guardrail =====
  pres.addSection({ title: "הפתרון" });
  s = add("הפתרון");
  title(s, "מבחן ההשפעה: לא נוגעים בתמחור, בעתודות ובחיתום");
  const qx = 0.9, qy = 1.75, qw = 5.6, qh = 4.55;
  [[qx, qy + qh / 2, "1C232C", "low"], [qx + qw / 2, qy + qh / 2, "17362A", "go"], [qx, qy, "1A1F26", "avoid"], [qx + qw / 2, qy, "3A3020", "review"]].forEach(([x, y, c, n]) =>
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: qw / 2, h: qh / 2, fill: { color: c }, line: { color: c }, objectName: "quadrant " + n }));
  s.addShape(pres.shapes.LINE, { x: qx, y: qy + qh, w: qw, h: 0, line: { color: MUTED, width: 1.5, endArrowType: "triangle" }, objectName: "x axis" });
  s.addShape(pres.shapes.LINE, { x: qx, y: qy, w: 0, h: qh, line: { color: MUTED, width: 1.5, beginArrowType: "triangle" }, objectName: "y axis" });
  T(s, "חיסכון שנתי", { x: qx + qw - 2.4, y: qy + qh + 0.05, w: 2.4, h: 0.35, fontSize: 12, color: MUTED });
  T(s, "השפעה על התמחור, העתודות או החיתום", { x: qx - 0.3, y: qy - 0.45, w: 4.6, h: 0.35, fontSize: 12, color: MUTED, align: "left" });
  T(s, "מבצעים מיד", { x: qx + qw / 2, y: qy + qh - 0.5, w: qw / 2 - 0.1, h: 0.4, fontSize: 14, bold: true, color: MINT });
  T(s, "באישור האקטואר הממונה", { x: qx + qw / 2, y: qy + 0.1, w: qw / 2 - 0.1, h: 0.4, fontSize: 14, bold: true, color: AMBER });
  T(s, "לא מומלץ", { x: qx + 0.1, y: qy + 0.1, w: qw / 2 - 0.2, h: 0.4, fontSize: 14, bold: true, color: RISK });
  T(s, "ניצחונות קטנים", { x: qx + 0.1, y: qy + qh - 0.5, w: qw / 2 - 0.2, h: 0.4, fontSize: 14, bold: true, color: MUTED });
  [[0.8, 0.2, MINT], [0.66, 0.3, MINT], [0.9, 0.12, MINT], [0.3, 0.25, MUTED], [0.72, 0.7, AMBER], [0.22, 0.82, RISK]].forEach(([dx, dy, c], i) =>
    s.addShape(pres.shapes.OVAL, { x: qx + dx * qw - 0.15, y: qy + (1 - dy) * qh - 0.15, w: 0.3, h: 0.3, fill: { color: c }, line: { color: BG, width: 1 }, objectName: "finding dot " + (i + 1) }));
  const checks = [
    { ic: fa.FaCalculator, h: "נאותות התמחור", t: "שום ממצא לא משנה הנחות, משתנים או נתונים שנכנסים למודל" },
    { ic: fa.FaBalanceScale, h: "עתודות ודיווח", t: "בדוחות IFRS 17 וכושר הפירעון: אותן תוצאות, פחות חישובים כפולים" },
    { ic: fa.FaUserShield, h: "איכות החיתום", t: "לא מוותרים על מידע — רק לא קונים אותו פעמיים. בלי אנטי-סלקציה" },
  ];
  for (let i = 0; i < 3; i++) {
    const c = checks[i], y = 1.75 + i * 1.5;
    await circleIcon(s, c.ic, W - M - 0.9, y, 0.9, CHIP, H.accent1, c.h);
    T(s, c.h, { x: 7.0, y: y - 0.05, w: 4.65, h: 0.45, fontSize: 19, bold: true, color: TXT });
    T(s, c.t, { x: 7.0, y: y + 0.4, w: 4.65, h: 0.75, fontSize: 15, color: MUTED, valign: "top" });
  }
  T(s, "חוסכים ביחס ההוצאות — לא נוגעים ביחס התביעות", { x: 6.4, y: 6.2, w: 6.33, h: 0.5, fontSize: 15, bold: true, italic: true, color: MINT });
  s.addNotes("כל ממצא מסווג לפי חיסכון מול השפעה על התמחור, העתודות והחיתום. ממצאים שנוגעים בחישובים רגולטוריים עוברים לאישור האקטואר הממונה — המערכת לא מבצעת אותם לבד.");

  // ===== 9. How it works =====
  s = add("הפתרון");
  title(s, "איך זה עובד: מהשורה במקור ועד הפעולה");
  const steps = [
    { ic: fa.FaPlug, h: "מתחברים בקריאה בלבד", t: "שעות עבודה, מוני חשמל, הנהלת חשבונות, ענן ורישיונות" },
    { ic: fa.FaProjectDiagram, h: "קטלוג ושכבה סמנטית", t: "Bob ממפה כל תוצר: אינפוט, אאוטפוט, קישורים ומשתמשים" },
    { ic: fa.FaSearchDollar, h: "כללים מוצאים כפילויות", t: "33 כללים ועוד חבילת ביטוח, עם סכום ושורות מקור" },
    { ic: fa.FaCheckCircle, h: "פעולה ומעקב", t: "משימה לצוות האחראי, התראה, ומעקב אחרי חיסכון מאומת" },
  ];
  const sw = 2.75, sg = 0.377;
  for (let i = 0; i < 4; i++) {
    const st = steps[i], x = W - M - sw - i * (sw + sg), y = 1.55;
    box(s, x, y, sw, 3.4, CARD, "step card " + (i + 1));
    await circleIcon(s, st.ic, x + sw / 2 - 0.5, y + 0.3, 1.0, CHIP, H.accent1, st.h);
    s.addText(String(i + 1), { isTextBox: true, x: x + sw / 2 + 0.3, y: y + 0.2, w: 0.42, h: 0.42, shape: pres.shapes.OVAL, fill: { color: AMBER }, fontSize: 13, bold: true, color: "0B0F14", align: "center", valign: "middle", margin: 0, objectName: "step number " + (i + 1) });
    T(s, st.h, { x: x + 0.15, y: y + 1.45, w: sw - 0.3, h: 0.5, fontSize: 17, bold: true, color: TXT, align: "center" });
    T(s, st.t, { x: x + 0.2, y: y + 2.0, w: sw - 0.4, h: 1.25, fontSize: 14, color: MUTED, align: "center", valign: "top" });
  }
  const trust = [[fa.FaLock, "הרשאות קריאה בלבד"], [fa.FaShieldAlt, "תואם תיקון 13 לחוק הגנת הפרטיות"], [fa.FaUserShield, "אדם מאשר כל פעולה"], [fa.FaClock, "ממצאים ראשונים תוך שעה"]];
  box(s, M, 5.3, CW, 1.4, CARD, "trust band");
  for (let i = 0; i < 4; i++) {
    const tw = CW / 4, x = W - M - tw - i * tw;
    s.addImage({ data: await icon(trust[i][0], H.accent1), x: x + tw - 0.7, y: 5.75, w: 0.42, h: 0.42, altText: trust[i][1], objectName: "trust icon " + (i + 1) });
    T(s, trust[i][1], { x: x + 0.15, y: 5.55, w: tw - 0.95, h: 0.9, fontSize: 14, bold: true, color: TXT, valign: "middle" });
  }
  s.addNotes("הכללים דטרמיניסטיים — לא מודל שמנחש. לכן כל ממצא ניתן לביקורת, כמו כל חישוב אקטוארי. הסוכן רק מסביר ומכין פעולות.");

  // ===== 10. Agent demo =====
  s = add("הפתרון");
  title(s, "שואלים בעברית. התשובה רק מהנתונים");
  box(s, M, 1.5, 7.6, 5.2, CARD, "chat window");
  box(s, 3.6, 1.8, 4.35, 0.8, CHIP, "user bubble");
  T(s, "איפה הכסף בתמחור — בלי לגעת במודל?", { x: 3.75, y: 1.8, w: 4.05, h: 0.8, fontSize: 15, color: TXT, valign: "middle" });
  box(s, 0.85, 2.85, 6.4, 3.6, "1E2433", "agent bubble");
  T(s, [
    { text: "מצאתי 3 ממצאים בתמחור, בסך ₪715K בשנה", options: { bold: true, breakLine: true, paraSpaceAfter: 8, rtlMode: true, align: "right" } },
    { text: "כוח אדם: הקלדה ידנית של טבלאות תעריף — ₪360K", options: { bullet: true, breakLine: true, paraSpaceAfter: 4, rtlMode: true, align: "right" } },
    { text: "מערכות IT: רישיונות כפולים לכלי מידול — ₪260K", options: { bullet: true, breakLine: true, paraSpaceAfter: 4, rtlMode: true, align: "right" } },
    { text: "חשמל: ריצות לילה על נתונים שלא השתנו — ₪95K", options: { bullet: true, breakLine: true, paraSpaceAfter: 8, rtlMode: true, align: "right" } },
    { text: "אף אחד מהם לא משנה את מודל התמחור. לפתוח משימה לצוות?", options: { color: MINT, rtlMode: true, align: "right" } },
  ], { x: 1.05, y: 2.95, w: 6.0, h: 3.4, fontSize: 15, color: TXT, valign: "top" });
  const why = [
    { ic: fa.FaDatabase, h: "לא ממציא מספרים", t: "כל משפט מצביע על ממצא או על שורת מקור" },
    { ic: fa.FaProjectDiagram, h: "מתחבר לכל סוכן", t: "שרת MCP לסוכנים שכבר עובדים בארגון" },
    { ic: fa.FaComments, h: "נשען על השכבה הסמנטית", t: "יודע איזו טבלה משרתת איזה תהליך" },
  ];
  for (let i = 0; i < 3; i++) {
    const w = why[i], y = 1.6 + i * 1.7;
    await circleIcon(s, w.ic, W - M - 0.85, y, 0.85, CHIP, H.accent3, w.h);
    T(s, w.h, { x: 8.6, y: y - 0.02, w: 3.2, h: 0.45, fontSize: 18, bold: true, color: TXT });
    T(s, w.t, { x: 8.6, y: y + 0.43, w: 3.2, h: 0.85, fontSize: 14, color: MUTED, valign: "top" });
  }
  s.addNotes("הדגמה של הסוכן. הוא עונה רק מתוך הממצאים, וכל מספר בתשובה ניתן למעקב עד שורת המקור.");

  // ===== 11. Scenario =====
  pres.addSection({ title: "ערך" });
  s = add("ערך");
  title(s, "תרחיש: חברת ביטוח עם ₪2 מיליארד פרמיות ברוטו");
  s.addChart(pres.charts.BAR, [{ name: "חיסכון שנתי (אלפי ₪)", labels: ["חשמל", "מערכות IT", "כוח אדם"], values: [435, 1474, 2180] }], {
    x: M, y: 1.45, w: 7.4, h: 5.0, barDir: "bar", chartColors: [H.accent1],
    showTitle: true, title: "חיסכון שנתי לפי רכיב (אלפי ₪)", titleFontSize: 14, titleColor: H.lt2, titleFontFace: "+mn-lt",
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 14, dataLabelColor: "FFFFFF", dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0",
    catAxisLabelColor: "FFFFFF", catAxisLabelFontSize: 14, catAxisLabelFontFace: "+mn-lt", catAxisLineShow: false,
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 55,
  });
  [["₪4.1M", "חיסכון שנתי בשלושת הנושאים", AMBER], ["כ-20 נ״ב", "שיפור ביחס ההוצאות: כ-0.2% מהפרמיות", MINT], ["9 משרות", "מוסבות לעבודה בעלת ערך — אפס פיטורים", TXT]].forEach(([b, l, c], i) => {
    const y = 1.55 + i * 1.65;
    box(s, 8.4, y, 4.33, 1.45, CARD, "stat card " + (i + 1));
    T(s, b, { x: 8.6, y: y + 0.1, w: 3.93, h: 0.75, fontSize: 34, bold: true, color: c });
    T(s, l, { x: 8.6, y: y + 0.85, w: 3.93, h: 0.45, fontSize: 14, color: MUTED });
  });
  T(s, "* חברה מדומה ונתונים להמחשה בלבד — יאומתו בסריקה חינם על הנתונים האמיתיים", { x: M, y: 6.5, w: CW, h: 0.35, fontSize: 11, italic: true, color: MUTED });
  s.addNotes("4.1 מיליון ₪ (כוח אדם 2.18 כולל דוחות התביעות, מערכות IT 1.47, חשמל 0.435) חלקי 2 מיליארד ₪ פרמיות = כ-0.2%, כלומר כ-20 נקודות בסיס ביחס ההוצאות. בכוח אדם הערך הוא זמן עבודה שמוסב, לא פיטורים. זה סדר גודל של שיפור שאקטואר מכיר ומעריך.");

  // ===== W. Why it helps =====
  s = add("ערך");
  title(s, "למה זה עוזר — ולמי");
  const why2 = [
    { ic: fa.FaServer, h: "מנהל ה-IT", t: "מפה אחת של כל המערכות, הטבלאות והדוחות — ומי אחראי על כל אחד" },
    { ic: fa.FaCoins, h: "סמנכ״ל הכספים", t: "איפה הכסף: כ-20 נקודות בסיס ביחס ההוצאות, עם שורות מקור" },
    { ic: fa.FaBalanceScale, h: "האקטואר הממונה", t: "הגדרה אחת לכל מונח — דוחות ועתודות על אותם נתונים" },
    { ic: fa.FaSitemap, h: "מנהלי המחלקות", t: "תמונה מלאה של התהליך שלהם, ואחריות ברורה לכל נכס" },
  ];
  const ww = (CW - 3 * 0.3) / 4;
  for (let i = 0; i < 4; i++) {
    const c = why2[i], x = W - M - ww - i * (ww + 0.3), y = 1.5;
    box(s, x, y, ww, 3.5, CARD, "stakeholder " + (i + 1));
    await circleIcon(s, c.ic, x + ww / 2 - 0.5, y + 0.3, 1.0, CHIP, H.accent1, c.h);
    T(s, c.h, { x: x + 0.15, y: y + 1.45, w: ww - 0.3, h: 0.5, fontSize: 18, bold: true, color: TXT, align: "center" });
    T(s, c.t, { x: x + 0.2, y: y + 2.0, w: ww - 0.4, h: 1.35, fontSize: 14, color: MUTED, align: "center", valign: "top" });
  }
  box(s, M, 5.3, CW, 1.4, "2A2416", "ibm value band");
  await circleIcon(s, fa.FaHandshake, W - M - 1.0, 5.57, 0.85, BG, H.accent2, "IBM");
  T(s, [{ text: "ומה IBM מרוויחה", options: { bold: true, color: AMBER, breakLine: true, rtlMode: true, align: "right" } }, { text: "הכלים של IBM — Bob ו-watsonx — נכנסים לחברות ביטוח דרך בעיה שכל מנהל מערכות מכיר, והאנציקלופדיה נשארת אצל הלקוח כנכס קבוע", options: { color: TXT, rtlMode: true, align: "right" } }],
    { x: M + 0.3, y: 5.37, w: CW - 1.6, h: 1.26, fontSize: 16, valign: "middle", margin: 0 });
  s.addNotes("השקף שעונה למה זה עוזר. לכל בעל עניין — תועלת אחרת. ול-IBM: שער כניסה לחברות ביטוח, ומוצר שנשאר — האנציקלופדיה מתעדכנת כל הזמן.");

  // ===== 12. IBM architecture =====
  pres.addSection({ title: "ביצוע" });
  s = add("ביצוע");
  title(s, "על בסיס IBM: הבוט בונה, watsonx מפעיל");
  const cols = [
    { h: "מקורות", sub: "קריאה בלבד", items: ["קוד, תהליכים וטבלאות", "שעות עבודה ומשימות", "מוני חשמל ושרתים", "מערכות ליבה ותביעות"], fill: CARD, hc: TXT },
    { h: "אנציקלופדיה", sub: "IBM Bob + watsonx.data", items: ["מיפוי קוד, תהליכים וטבלאות", "קישור למחלקה ולגורם אחראי", "מילון מונחים ושושלת", "זיהוי דוחות כפולים"], fill: "17362A", hc: MINT },
    { h: "אורקסטרציה", sub: "watsonx Orchestrate", items: ["סוכן כוח אדם", "סוכן חשמל", "סוכן מערכות IT", "סוכן תהליך, למשל תביעות"], fill: "17362A", hc: MINT },
    { h: "בקרה ופעולה", sub: "watsonx.governance", items: ["אישור האקטואר הממונה", "תיעוד כל החלטה", "משימה והתראה לצוות"], fill: CARD, hc: TXT },
  ];
  for (let i = 0; i < 4; i++) {
    const c = cols[i], x = W - M - sw - i * (sw + sg), y = 1.5;
    box(s, x, y, sw, 4.2, c.fill, "arch column " + (i + 1));
    T(s, c.h, { x: x + 0.15, y: y + 0.15, w: sw - 0.3, h: 0.5, fontSize: 19, bold: true, color: c.hc, align: "center" });
    L(s, c.sub, { x: x + 0.1, y: y + 0.63, w: sw - 0.2, h: 0.38, fontSize: 12, italic: true, color: MUTED, align: "center" });
    T(s, c.items.map((t, k) => ({ text: t, options: { bullet: true, rtlMode: true, align: "right", breakLine: k < c.items.length - 1, paraSpaceAfter: 8 } })),
      { x: x + 0.2, y: y + 1.15, w: sw - 0.4, h: 2.9, fontSize: 15, color: TXT, valign: "top" });
    if (i < 3) s.addImage({ data: await icon(fa.FaArrowLeft, H.accent2), x: x - sg / 2 - 0.15, y: y + 1.95, w: 0.3, h: 0.3, altText: "חץ", objectName: "arch arrow " + (i + 1) });
  }
  box(s, M, 5.95, CW, 0.8, "2A2416", "bob band");
  s.addImage({ data: await icon(fa.FaCode, H.accent2), x: W - M - 0.7, y: 6.1, w: 0.5, h: 0.5, altText: "קוד", objectName: "bob icon" });
  T(s, "IBM Bob קורא את קוד ה-IT, מתעד כל תהליך וכותב את ערכי האנציקלופדיה", { x: M + 0.3, y: 5.98, w: CW - 1.3, h: 0.75, fontSize: 17, bold: true, color: AMBER, valign: "middle" });
  s.addNotes("הקטלוג מספק שושלת נתונים — חשוב לביקורת של IFRS 17. Orchestrate מנהל סוכן לכל רכיב — כוח אדם, חשמל ומערכות IT —, ו-governance מתעד כל החלטה. IBM Bob הוא כלי הפיתוח שבו בונים את המחברים ואת חבילת הכללים לביטוח.");

  // ===== 13. Business model =====
  s = add("ביצוע");
  title(s, "מודל עסקי: מתחילים בסריקה חינם");
  const plans = [
    { h: "סריקה חינם", p: "₪0", u: "פעם אחת, בלי כרטיס אשראי", items: ["עד 6 מקורות נתונים", "דוח PDF עם 10 הממצאים הגדולים", "הנתונים נמחקים אחרי 14 יום"], fill: CARD, pc: TXT },
    { h: "Growth", p: "₪2,900", u: "לחודש · עד 150 עובדים", items: ["כל המקורות, סריקה יומית", "הסוכן בעברית ושרת MCP", "התראות לפני כל חידוש"], fill: CARD, pc: TXT },
    { h: "Insurance", p: "בהתאמה", u: "לחברות ביטוח וסוכנויות גדולות", items: ["אנציקלופדיה ארגונית ושכבה סמנטית", "פריסה ב-IBM Cloud או אצל הלקוח", "אישורי אקטואר ותיעוד לביקורת"], fill: "17362A", pc: MINT },
  ];
  const check = await icon(fa.FaCheck, H.accent1);
  plans.forEach((p, i) => {
    const x = col3(i), y = 1.5, h = 5.2;
    box(s, x, y, 3.8, h, p.fill, "plan card " + (i + 1));
    if (i === 2) s.addText("היעד שלנו", { isTextBox: true, x: x + 0.25, y: y + 0.3, w: 1.3, h: 0.36, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.18, fill: { color: "0F2A1F" }, fontSize: 12, bold: true, color: MINT, align: "center", valign: "middle", margin: 0, rtlMode: true, objectName: "target chip" });
    L(s, p.h, { x: x + 1.6, y: y + 0.25, w: 1.95, h: 0.5, fontSize: 20, bold: true, color: TXT, align: "right" });
    T(s, p.p, { x: x + 0.25, y: y + 0.85, w: 3.3, h: 0.85, fontSize: 36, bold: true, color: p.pc });
    T(s, p.u, { x: x + 0.25, y: y + 1.7, w: 3.3, h: 0.4, fontSize: 13, color: MUTED });
    p.items.forEach((t, k) => {
      const yy = y + 2.4 + k * 0.85;
      s.addImage({ data: check, x: x + 3.8 - 0.55, y: yy + 0.08, w: 0.26, h: 0.26, altText: "וי", objectName: `plan ${i + 1} check ${k + 1}` });
      T(s, t, { x: x + 0.25, y: yy - 0.05, w: 2.9, h: 0.75, fontSize: 14, color: TXT, valign: "top", margin: 0 });
    });
  });
  s.addNotes("שני המסלולים הראשונים קיימים היום באתר. מסלול Insurance הוא מה שאנחנו בונים במסגרת ה-Challenge.");

  // ===== 14. Roadmap =====
  s = add("ביצוע");
  title(s, "מפת דרכים ל-12 חודשים");
  const rm = [
    { q: "רבעון 1", h: "אנציקלופדיה ארגונית", t: "מיפוי תוצרי ה-IT עם IBM Bob, ואז כללי מערכות IT וחשמל" },
    { q: "רבעון 2", h: "פיילוט", t: "חברת ביטוח אחת, מדידת חיסכון מאומת מול יחס ההוצאות" },
    { q: "רבעון 3", h: "רכיב כוח אדם", t: "ניתוח עבודה כפולה בחיתום ובדוחות, יחד עם משאבי אנוש" },
    { q: "רבעון 4", h: "השקה", t: "3 חברות ביטוח משלמות, הפצה דרך שותפי IBM" },
  ];
  s.addShape(pres.shapes.LINE, { x: 1.2, y: 2.95, w: 10.9, h: 0, line: { color: NEUT, width: 3 }, objectName: "timeline" });
  for (let i = 0; i < 4; i++) {
    const r = rm[i], x = W - M - sw - i * (sw + sg);
    s.addShape(pres.shapes.OVAL, { x: x + sw / 2 - 0.28, y: 2.67, w: 0.56, h: 0.56, fill: { color: i === 0 ? AMBER : MINT }, line: { color: BG, width: 3 }, objectName: "milestone " + (i + 1) });
    T(s, r.q, { x, y: 2.0, w: sw, h: 0.45, fontSize: 15, bold: true, color: MUTED, align: "center" });
    box(s, x, 3.55, sw, 2.8, CARD, "milestone card " + (i + 1));
    T(s, r.h, { x: x + 0.2, y: 3.7, w: sw - 0.4, h: 0.85, fontSize: 19, bold: true, color: TXT, align: "center", valign: "middle" });
    T(s, r.t, { x: x + 0.2, y: 4.6, w: sw - 0.4, h: 1.6, fontSize: 15, color: MUTED, align: "center", valign: "top" });
  }
  s.addNotes("מתחילים במערכות IT ובחשמל — שם הנתונים זמינים והחיסכון מהיר. רכיב כוח האדם, הרגיש יותר, אחרי הפיילוט ובשיתוף משאבי אנוש.");

  // ===== 15. Team =====
  s = add("ביצוע");
  title(s, "הצוות");
  const team = [["[שם מלא]", "[תפקיד — למשל: מובילת מוצר]"], ["[שם מלא]", "[תפקיד — למשל: אקטואריה ונתונים]"], ["[שם מלא]", "[תפקיד — למשל: פיתוח]"]];
  for (let i = 0; i < 3; i++) {
    const x = col3(i), y = 1.6;
    box(s, x, y, 3.8, 4.7, CARD, "team card " + (i + 1));
    await circleIcon(s, fa.FaUserTie, x + 1.9 - 0.75, y + 0.4, 1.5, CHIP, H.accent1, "חבר/ת צוות " + (i + 1));
    T(s, team[i][0], { x: x + 0.25, y: y + 2.15, w: 3.3, h: 0.55, fontSize: 22, bold: true, color: TXT, align: "center" });
    T(s, team[i][1], { x: x + 0.25, y: y + 2.75, w: 3.3, h: 0.5, fontSize: 15, bold: true, color: MINT, align: "center" });
    T(s, "[ניסיון רלוונטי]", { x: x + 0.25, y: y + 3.3, w: 3.3, h: 1.1, fontSize: 15, color: MUTED, align: "center", valign: "top" });
  }
  s.addNotes("השלימו שמות, תפקידים וניסיון. מומלץ מאוד שיהיה בצוות או בין היועצים מישהו עם רקע אקטוארי או מחברת ביטוח.");

  // ===== 16. Ask =====
  pres.addSection({ title: "סיכום" });
  s = add("סיכום", "HERO");
  T(s, "מה אנחנו מבקשים מ-IBM", { x: M, y: 0.7, w: CW, h: 0.9, fontSize: 36, bold: true, color: TXT });
  const asks = [
    { ic: fa.FaCogs, h: "גישה לטכנולוגיה", t: "IBM Bob, watsonx Orchestrate ו-watsonx.data intelligence" },
    { ic: fa.FaBullseye, h: "חברת ביטוח לפיילוט", t: "היכרות עם לקוח ביטוח של IBM" },
    { ic: fa.FaHandshake, h: "מנטור מתעשיית הביטוח", t: "מומחה IBM לביטוח, אקטואריה או FinOps" },
  ];
  for (let i = 0; i < 3; i++) {
    const a = asks[i], x = col3(i), y = 1.9;
    box(s, x, y, 3.8, 2.9, CARD, "ask card " + (i + 1));
    await circleIcon(s, a.ic, x + 1.9 - 0.45, y + 0.3, 0.9, CHIP, H.accent1, a.h);
    T(s, a.h, { x: x + 0.25, y: y + 1.35, w: 3.3, h: 0.55, fontSize: 20, bold: true, color: TXT, align: "center" });
    T(s, a.t, { x: x + 0.25, y: y + 1.9, w: 3.3, h: 0.85, fontSize: 14, color: MUTED, align: "center", valign: "top" });
  }
  T(s, "מורידים את יחס ההוצאות — בלי לגעת ביחס התביעות", { x: M, y: 5.25, w: CW, h: 0.8, fontSize: 28, bold: true, color: MINT, align: "center" });
  T(s, "[שם הצוות]  ·  eifo-money.fit  ·  [מייל ליצירת קשר]", { x: M, y: 6.15, w: CW, h: 0.5, fontSize: 15, color: MUTED, align: "center" });
  s.addNotes("סיום: שלוש בקשות קונקרטיות, ומשפט הסיום שחוזר על ההבטחה המרכזית.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
