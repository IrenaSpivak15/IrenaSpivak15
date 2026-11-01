const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require(process.argv[2] + "/scripts/apply_theme.js");
const OUT = process.argv[3];

const THEME = {
  name: "Where Is The Money",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "14231C", lt1: "FFFFFF", dk2: "0B3D2E", lt2: "EEF5F1",
    accent1: "1F7A5A", accent2: "E0A800", accent3: "5FB58E", accent4: "9AA5A0",
    accent5: "C8452F", accent6: "2E5E8C", hlink: "1F7A5A", folHlink: "0B3D2E",
  },
};
const H = THEME.colors;

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color: "#" + color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.title = "איפה הכסף? – IBM Challenge";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const W = 13.333;

  const RTL = { rtlMode: true, align: "right", lang: "he-IL" };

  // ---------- Layouts ----------
  pres.defineSlideMaster({
    title: "DARK",
    background: { color: C.text2 },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 2.2, w: 8.2, h: 1.6, fontSize: 60, bold: true, color: C.background1, align: "right", valign: "middle" }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.9, w: 8.2, h: 1.6, fontSize: 20, color: C.background2, align: "right", valign: "top" }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "CONTENT",
    background: { color: C.background1 },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 12.13, h: 0.95, fontSize: 32, bold: true, color: C.text2, align: "right", valign: "middle" }, text: "" } },
      { text: { text: "איפה הכסף?  |  IBM Challenge", options: { x: 7.7, y: 7.0, w: 5.0, h: 0.3, fontSize: 10, color: C.accent4, align: "right", rtlMode: true } } },
    ],
    slideNumber: { x: 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent4 },
  });

  const add = (sec, master = "CONTENT") => pres.addSlide({ masterName: master, sectionTitle: sec });
  const T = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true }, RTL, o));
  const title = (s, text) => s.addText(text, Object.assign({ placeholder: "title" }, RTL));
  const circleIcon = async (s, Comp, x, y, d, bg, fg, name) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg }, objectName: name + " circle" });
    const pad = d * 0.25;
    s.addImage({ data: await icon(Comp, fg), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, altText: name, objectName: name + " icon" });
  };
  const card = (s, x, y, w, h, fill, name) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill }, objectName: name });

  // ---------- 1. Title ----------
  pres.addSection({ title: "פתיחה" });
  let s = add("פתיחה", "DARK");
  T(s, "IBM CHALLENGE 2026", { x: 0.6, y: 1.5, w: 8.2, h: 0.5, fontSize: 16, bold: true, color: C.accent2, charSpacing: 3 });
  s.addText("איפה הכסף?", Object.assign({ placeholder: "title" }, RTL));
  s.addText("עוזר AI למנהל ה-IT שמאתר כפילויות בעובדים, בכלים ובצריכת החשמל — ומציע ייעול בלי לפגוע ברווחיות הכוללת",
    Object.assign({ placeholder: "body" }, RTL));
  s.addShape(pres.shapes.OVAL, { x: 9.4, y: 1.9, w: 3.3, h: 3.3, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "hero circle" });
  s.addImage({ data: await icon(fa.FaSearchDollar, H.accent2), x: 10.2, y: 2.7, w: 1.7, h: 1.7, altText: "זכוכית מגדלת על סימן כסף", objectName: "hero icon" });
  s.addNotes("פתיחה: מי אנחנו ובמה נעסוק. משפט אחד: אנחנו עוזרים למנהל ה-IT לענות על השאלה 'איפה הכסף?' — ולחסוך בלי לפגוע ברווח.");

  // ---------- 2. Problem ----------
  pres.addSection({ title: "הבעיה" });
  s = add("הבעיה");
  title(s, "מנהל ה-IT יודע שהכסף דולף — אבל לא יודע איפה");
  const probs = [
    { ic: fa.FaUsers, big: "3 מערכות", lab: "עובדים", txt: "נתוני HR, משימות ופרויקטים יושבים במערכות נפרדות — אף אחד לא רואה שני צוותים שעושים את אותה עבודה" },
    { ic: fa.FaToolbox, big: "כ-27%", lab: "כלים ותוכנה", txt: "מההוצאה על ענן מוערכת כבזבוז: רישיונות לא בשימוש וכלים כפולים לאותה מטרה ", src: "מקור: Flexera, State of the Cloud" },
    { ic: fa.FaBolt, big: "עד 30%", lab: "חשמל", txt: "מהשרתים בחוות נתונים נמצאו 'זומבים' — צורכים חשמל וקירור בלי לבצע עבודה ", src: "מקור: Koomey & Taylor / Anthesis" },
  ];
  const cw = 3.8, cg = 0.36, cx0 = W - 0.6 - cw;
  for (let i = 0; i < 3; i++) {
    const p = probs[i], x = cx0 - i * (cw + cg), y = 1.7;
    card(s, x, y, cw, 4.9, C.background2, "problem card " + (i + 1));
    await circleIcon(s, p.ic, x + cw - 1.2, y + 0.35, 0.85, C.text2, H.accent2, p.lab);
    T(s, p.lab, { x: x + 0.3, y: y + 0.45, w: cw - 1.65, h: 0.6, fontSize: 20, bold: true, color: C.text2 });
    T(s, p.big, { x: x + 0.3, y: y + 1.45, w: cw - 0.6, h: 1.1, fontSize: 48, bold: true, color: C.accent1 });
    T(s, p.txt.trim(), { x: x + 0.3, y: y + 2.65, w: cw - 0.6, h: 1.6, fontSize: 15, color: C.text1, valign: "top" });
    if (p.src) T(s, p.src, { x: x + 0.3, y: y + 4.3, w: cw - 0.6, h: 0.4, fontSize: 11, italic: true, color: C.accent4 });
  }
  s.addNotes("שלושה מקורות דליפה: אנשים, כלים, חשמל. הנתונים קיימים — אבל מפוזרים. הסטטיסטיקות מגיעות מדוח Flexera State of the Cloud ומחקר Koomey & Taylor על שרתים 'קומטוזים'. מומלץ לוודא את המספר העדכני לפני ההצגה.");

  // ---------- 3. Current solutions ----------
  s = add("הבעיה");
  title(s, "הפתרונות הקיימים רואים רק חתיכה מהתמונה");
  const Y = "✓", N = "—";
  const hdr = ["פתרון", "עובדים", "כלים", "חשמל", "בדיקת השפעה על רווח"];
  const rows = [
    ["אקסל וביקורת ידנית", "חלקי", "חלקי", N, N],
    ["כלי ניהול רישיונות SaaS", N, Y, N, N],
    ["כלי FinOps לענן", N, Y, N, "חלקי"],
    ["דשבורד אנרגיה / BMS", N, N, Y, N],
    ["איפה הכסף?", Y, Y, Y, Y],
  ];
  const cell = (t, o = {}) => ({ text: t, options: Object.assign({ align: "center", rtlMode: true, fontSize: 16, color: C.text1, valign: "middle" }, o) });
  const tbl = [hdr.slice().reverse().map((h) => cell(h, { bold: true, color: C.background1, fill: { color: C.text2 } }))];
  rows.forEach((r, ri) => {
    const last = ri === rows.length - 1;
    const base = last ? { bold: true, color: C.background1, fill: { color: C.accent1 } } : { fill: { color: ri % 2 ? C.background1 : C.background2 } };
    const cells = r.map((v, ci) => cell(v, Object.assign({}, base, ci === 0 ? { align: "right" } : {}, !last && v === Y ? { color: C.accent1, bold: true } : {})));
    tbl.push(cells.reverse());
  });
  s.addTable(tbl, { x: 0.6, y: 1.65, w: 12.13, colW: [2.9, 1.9, 1.9, 1.9, 3.53], rowH: 0.72, border: { type: "solid", pt: 1, color: "FFFFFF" }, objectName: "comparison table" });
  T(s, "הפער: אף כלי לא מחבר בין אנשים, כלים וחשמל — ואף אחד לא בודק אם החיסכון יפגע בהכנסות", { x: 0.6, y: 6.15, w: 12.13, h: 0.55, fontSize: 18, bold: true, italic: true, color: C.text2 });
  s.addNotes("הדגישו שהפתרונות הקיימים מצוינים — אבל כל אחד מכסה רק תחום אחד. הייחוד שלנו: תמונה אחת + 'מבחן רווח' לכל המלצה.");

  // ---------- 4. Solution ----------
  pres.addSection({ title: "הפתרון" });
  s = add("הפתרון");
  title(s, "הפתרון: CFO אישי למחלקת ה-IT");
  card(s, 0.6, 1.55, 12.13, 1.35, C.text2, "elevator pitch band");
  T(s, "״איפה הכסף?״ מחבר את נתוני העובדים, הכלים והחשמל, מוצא כפילויות ומציג רק המלצות שחוסכות כסף בלי לפגוע ברווח",
    { x: 0.9, y: 1.6, w: 11.5, h: 1.25, fontSize: 22, bold: true, color: C.background1, valign: "middle" });
  const steps = [
    { ic: fa.FaPlug, h: "מתחברים", t: "HR, ITSM, רכש ורישיונות, ענן ומוני חשמל" },
    { ic: fa.FaSearchDollar, h: "מזהים", t: "AI מאתר כפילויות, חוסר ניצול ובזבוז" },
    { ic: fa.FaShieldAlt, h: "בודקים רווח", t: "כל המלצה עוברת סימולציה של השפעה על הכנסות ו-SLA" },
    { ic: fa.FaRocket, h: "פועלים", t: "תוכנית פעולה מדורגת לפי חיסכון נקי, עם מעקב ביצוע" },
  ];
  const sw = 2.75, sg = 0.38, sx0 = W - 0.6 - sw;
  for (let i = 0; i < 4; i++) {
    const st = steps[i], x = sx0 - i * (sw + sg), y = 3.35;
    await circleIcon(s, st.ic, x + sw / 2 - 0.6, y, 1.2, C.background2, H.accent1, st.h);
    s.addText(String(i + 1), { isTextBox: true, x: x + sw / 2 + 0.3, y: y - 0.1, w: 0.45, h: 0.45, shape: pres.shapes.OVAL, fill: { color: C.accent2 }, fontSize: 14, bold: true, color: C.text2, align: "center", valign: "middle", margin: 0, objectName: "step number " + (i + 1) });
    T(s, st.h, { x, y: y + 1.35, w: sw, h: 0.5, fontSize: 20, bold: true, color: C.text2, align: "center" });
    T(s, st.t, { x, y: y + 1.85, w: sw, h: 1.1, fontSize: 15, color: C.text1, align: "center", valign: "top" });
    if (i < 3) s.addImage({ data: await icon(fa.FaArrowLeft, H.accent4), x: x - sg / 2 - 0.15, y: y + 0.45, w: 0.3, h: 0.3, altText: "חץ", objectName: "flow arrow " + (i + 1) });
  }
  s.addNotes("משפט המעלית ואז ארבעת השלבים. הדגישו את שלב 3 — זה מה שמבדיל אותנו.");

  // ---------- 5. Product: three engines ----------
  s = add("הפתרון");
  title(s, "שלושה מנועים, תמונה אחת של הכסף");
  const eng = [
    { ic: fa.FaUsers, h: "מנוע אנשים", f: "מזהה: צוותים שמבצעים משימות חופפות, תפקידים כפולים אחרי מיזוגים, תורנויות מקבילות", r: "ממליץ: איחוד תהליכים והסבת עובדים לפרויקטים מניבים — לא פיטורים" },
    { ic: fa.FaToolbox, h: "מנוע כלים", f: "מזהה: רישיונות לא פעילים, כמה כלים לאותה מטרה (למשל 3 מערכות שיחות וידאו), חבילות מנוי מנופחות", r: "ממליץ: איחוד ספקים, הורדת רמת מנוי, מו״מ חידוש מבוסס נתונים" },
    { ic: fa.FaBolt, h: "מנוע חשמל", f: "מזהה: שרתים בניצול נמוך או 'זומבים', קירור עודף, עומסים בשעות תעריף יקרות", r: "ממליץ: כיבוי ואיחוד שרתים, וירטואליזציה, הזזת עומסים לשעות זולות" },
  ];
  for (let i = 0; i < 3; i++) {
    const e = eng[i], x = cx0 - i * (cw + cg), y = 1.6;
    card(s, x, y, cw, 5.1, C.background2, "engine card " + (i + 1));
    await circleIcon(s, e.ic, x + cw / 2 - 0.5, y + 0.3, 1.0, C.accent1, "FFFFFF", e.h);
    T(s, e.h, { x: x + 0.25, y: y + 1.4, w: cw - 0.5, h: 0.5, fontSize: 22, bold: true, color: C.text2, align: "center" });
    T(s, e.f, { x: x + 0.3, y: y + 2.0, w: cw - 0.6, h: 1.55, fontSize: 15, color: C.text1, valign: "top" });
    T(s, e.r, { x: x + 0.3, y: y + 3.55, w: cw - 0.6, h: 1.4, fontSize: 15, bold: true, color: C.accent1, valign: "top" });
  }
  s.addNotes("מנוע האנשים רגיש: המטרה היא להעביר אנשים לעבודה בעלת ערך גבוה יותר, לא לצמצם. זה גם מה שמגן על הרווחיות.");

  // ---------- 6. Profit guardrail ----------
  s = add("הפתרון");
  title(s, "״מבחן הרווח״: חוסכים רק במה שלא פוגע בהכנסות");
  // quadrant (left side)
  const qx = 0.9, qy = 1.7, qw = 5.6, qh = 4.6;
  s.addShape(pres.shapes.RECTANGLE, { x: qx, y: qy + qh / 2, w: qw / 2, h: qh / 2, fill: { color: C.background2 }, line: { color: C.background2 }, objectName: "quadrant low" });
  s.addShape(pres.shapes.RECTANGLE, { x: qx + qw / 2, y: qy + qh / 2, w: qw / 2, h: qh / 2, fill: { color: "D7EDE2" }, line: { color: "D7EDE2" }, objectName: "quadrant sweet spot" });
  s.addShape(pres.shapes.RECTANGLE, { x: qx, y: qy, w: qw / 2, h: qh / 2, fill: { color: "F6F6F6" }, line: { color: "F6F6F6" }, objectName: "quadrant avoid" });
  s.addShape(pres.shapes.RECTANGLE, { x: qx + qw / 2, y: qy, w: qw / 2, h: qh / 2, fill: { color: "FBF1D3" }, line: { color: "FBF1D3" }, objectName: "quadrant review" });
  s.addShape(pres.shapes.LINE, { x: qx, y: qy + qh, w: qw, h: 0, line: { color: C.text1, width: 1.5, endArrowType: "triangle" }, objectName: "x axis" });
  s.addShape(pres.shapes.LINE, { x: qx, y: qy, w: 0, h: qh, line: { color: C.text1, width: 1.5, beginArrowType: "triangle" }, objectName: "y axis" });
  T(s, "חיסכון שנתי", { x: qx + qw - 2.4, y: qy + qh + 0.05, w: 2.4, h: 0.35, fontSize: 12, color: C.text1 });
  T(s, "סיכון להכנסות / SLA", { x: qx - 0.3, y: qy - 0.42, w: 3.0, h: 0.35, fontSize: 12, color: C.text1, align: "left" });
  T(s, "מבצעים מיד", { x: qx + qw / 2, y: qy + qh - 0.5, w: qw / 2 - 0.1, h: 0.4, fontSize: 14, bold: true, color: C.accent1 });
  T(s, "בדיקה עם בעלי עניין", { x: qx + qw / 2, y: qy + 0.1, w: qw / 2 - 0.1, h: 0.4, fontSize: 14, bold: true, color: "8A6A00" });
  T(s, "לא מומלץ", { x: qx + 0.1, y: qy + 0.1, w: qw / 2 - 0.2, h: 0.4, fontSize: 14, bold: true, color: C.accent4 });
  T(s, "ניצחונות קטנים", { x: qx + 0.1, y: qy + qh - 0.5, w: qw / 2 - 0.2, h: 0.4, fontSize: 14, bold: true, color: C.text1 });
  const dots = [[0.78, 0.25, C.accent1], [0.65, 0.35, C.accent1], [0.88, 0.15, C.accent1], [0.3, 0.3, C.accent3], [0.7, 0.72, C.accent2], [0.25, 0.8, C.accent4]];
  dots.forEach(([dx, dy, col], i) => s.addShape(pres.shapes.OVAL, { x: qx + dx * qw - 0.15, y: qy + (1 - dy) * qh - 0.15, w: 0.3, h: 0.3, fill: { color: col }, line: { color: "FFFFFF", width: 1 }, objectName: "recommendation dot " + (i + 1) }));
  // right side text
  const checks = [
    { ic: fa.FaChartLine, h: "השפעה על הכנסות", t: "האם הכלי, השרת או הצוות תומכים בלקוח משלם?" },
    { ic: fa.FaShieldAlt, h: "רמת שירות (SLA)", t: "סימולציה של זמני תגובה וזמינות אחרי השינוי" },
    { ic: fa.FaBalanceScale, h: "הוגנות ושקיפות", t: "המלצות על אנשים עוברות בקרת watsonx.governance" },
  ];
  for (let i = 0; i < 3; i++) {
    const c = checks[i], y = 1.75 + i * 1.5;
    await circleIcon(s, c.ic, W - 0.6 - 0.9, y, 0.9, C.text2, H.accent2, c.h);
    T(s, c.h, { x: 7.0, y: y - 0.05, w: 4.65, h: 0.45, fontSize: 19, bold: true, color: C.text2 });
    T(s, c.t, { x: 7.0, y: y + 0.4, w: 4.65, h: 0.7, fontSize: 15, color: C.text1, valign: "top" });
  }
  T(s, "רק המלצות עם חיסכון נקי חיובי מגיעות למנהל", { x: 7.0, y: 6.15, w: 5.73, h: 0.5, fontSize: 16, bold: true, italic: true, color: C.accent1 });
  s.addNotes("כל נקודה במטריצה היא המלצה. המערכת מציגה למנהל קודם את הרביע הירוק — חיסכון גבוה, סיכון נמוך.");

  // ---------- 7. Example scenario ----------
  pres.addSection({ title: "ערך ושוק" });
  s = add("ערך ושוק");
  title(s, "תרחיש לדוגמה: חברה של 800 עובדים");
  s.addChart(pres.charts.BAR, [{ name: "חיסכון שנתי (מיליון ₪)", labels: ["חשמל וקירור", "כפילויות עובדים (הסבה)", "כלים ורישיונות"], values: [0.6, 0.9, 1.1] }], {
    x: 0.6, y: 1.55, w: 7.2, h: 4.9, barDir: "bar", chartColors: [H.accent1],
    showTitle: true, title: "חיסכון שנתי פוטנציאלי לפי מקור (מיליון ₪)", titleFontSize: 14, titleColor: H.dk2, titleFontFace: "+mn-lt",
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 14, dataLabelColor: H.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0.0",
    catAxisLabelColor: H.dk1, catAxisLabelFontSize: 14, catAxisLabelFontFace: "+mn-lt",
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 60,
  });
  const stats = [["₪2.6M", "חיסכון שנתי פוטנציאלי"], ["0%", "פגיעה צפויה בהכנסות"], ["כ-120", "טון CO₂ פחות בשנה"]];
  stats.forEach(([b, l], i) => {
    const y = 1.6 + i * 1.6;
    card(s, 8.3, y, 4.43, 1.4, i === 0 ? C.text2 : C.background2, "stat card " + (i + 1));
    T(s, b, { x: 8.5, y: y + 0.08, w: 4.03, h: 0.8, fontSize: 36, bold: true, color: i === 0 ? C.accent2 : C.accent1 });
    T(s, l, { x: 8.5, y: y + 0.85, w: 4.03, h: 0.45, fontSize: 15, color: i === 0 ? C.background1 : C.text1 });
  });
  T(s, "* נתונים להמחשה בלבד — יאומתו בפיילוט", { x: 0.6, y: 6.5, w: 12.13, h: 0.35, fontSize: 11, italic: true, color: C.accent4 });
  s.addNotes("המספרים הם תרחיש המחשה, לא תוצאות בפועל. אם יש לכם נתונים מארגון אמיתי — החליפו אותם כאן.");

  // ---------- 8. Market ----------
  s = add("ערך ושוק");
  title(s, "הזמן הנכון: לחץ תקציבי, AI ועלויות חשמל");
  card(s, 0.6, 1.6, 4.6, 5.0, C.text2, "market stat card");
  T(s, "x2", { x: 0.9, y: 1.9, w: 4.0, h: 1.6, fontSize: 80, bold: true, color: C.accent2, align: "center" });
  T(s, "צריכת החשמל של מרכזי נתונים צפויה יותר מלהכפיל את עצמה עד 2030", { x: 0.9, y: 3.6, w: 4.0, h: 1.5, fontSize: 18, bold: true, color: C.background1, align: "center" });
  T(s, "IEA, Energy and AI, 2025", { x: 0.9, y: 5.6, w: 4.0, h: 0.4, fontSize: 11, color: C.background2, align: "center" });
  const mk = [
    { ic: fa.FaUserTie, h: "הלקוח שלנו", t: "מנהלי IT ו-CIO בארגונים של 200–5,000 עובדים, שנדרשים לחסוך בלי לעצור את העסק" },
    { ic: fa.FaCoins, h: "לחץ על תקציבי IT", t: "הוצאות AI וענן עולות, והנהלות דורשות להראות לאן הולך כל שקל" },
    { ic: fa.FaLeaf, h: "רגולציית ESG", t: "דרישות דיווח על צריכת אנרגיה ופליטות הופכות חיסכון בחשמל ליעד עסקי" },
  ];
  for (let i = 0; i < 3; i++) {
    const m = mk[i], y = 1.65 + i * 1.65;
    await circleIcon(s, m.ic, W - 0.6 - 0.9, y, 0.9, C.background2, H.accent1, m.h);
    T(s, m.h, { x: 5.7, y: y - 0.05, w: 5.95, h: 0.45, fontSize: 20, bold: true, color: C.text2 });
    T(s, m.t, { x: 5.7, y: y + 0.42, w: 5.95, h: 0.9, fontSize: 15, color: C.text1, valign: "top" });
  }
  s.addNotes("שלוש מגמות שיוצרות דחיפות. נתון ה-IEA: צריכת חשמל של מרכזי נתונים צפויה להגיע לכ-945 TWh ב-2030.");

  // ---------- 9. Business model ----------
  s = add("ערך ושוק");
  title(s, "מודל עסקי: הלקוח משלם כשהוא חוסך");
  const bm = [
    { ic: fa.FaSyncAlt, h: "מנוי SaaS", t: "תשלום חודשי לפי מספר עובדים בארגון — כולל דשבורד, התראות ודוחות" },
    { ic: fa.FaHandshake, h: "דמי הצלחה", t: "אחוז מהחיסכון המאומת בשנה הראשונה — אנחנו מרוויחים רק כשהלקוח חוסך" },
    { ic: fa.FaCogs, h: "ערוץ IBM", t: "הפצה דרך מערך השותפים של IBM כהרחבה ללקוחות Apptio ו-Turbonomic" },
  ];
  for (let i = 0; i < 3; i++) {
    const b = bm[i], x = cx0 - i * (cw + cg), y = 1.7;
    card(s, x, y, cw, 3.6, C.background2, "model card " + (i + 1));
    await circleIcon(s, b.ic, x + cw - 1.2, y + 0.35, 0.85, C.accent1, "FFFFFF", b.h);
    T(s, b.h, { x: x + 0.3, y: y + 0.45, w: cw - 1.65, h: 0.6, fontSize: 22, bold: true, color: C.text2 });
    T(s, b.t, { x: x + 0.3, y: y + 1.45, w: cw - 0.6, h: 1.9, fontSize: 16, color: C.text1, valign: "top" });
  }
  card(s, 0.6, 5.65, 12.13, 1.0, C.text2, "value band");
  T(s, "החזר השקעה כבר ברבעון הראשון: החיסכון בכלים לבדו מכסה את עלות המנוי", { x: 0.9, y: 5.7, w: 11.5, h: 0.9, fontSize: 20, bold: true, color: C.background1, valign: "middle" });
  s.addNotes("מחיר מדויק ייקבע בפיילוט. ההיגיון: סיכון נמוך ללקוח — דמי ההצלחה מיישרים אינטרסים.");

  // ---------- 10. Architecture ----------
  pres.addSection({ title: "ביצוע" });
  s = add("ביצוע");
  title(s, "בנוי על טכנולוגיות IBM");
  const cols = [
    { h: "מקורות נתונים", items: ["HR ומערכות משימות", "ITSM וכרטיסי תמיכה", "רכש ורישיונות SaaS", "ענן ושרתים", "מוני חשמל ו-BMS"], fill: C.background2, tc: C.text1 },
    { h: "שכבת הניתוח", items: ["watsonx.ai — זיהוי כפילויות", "Apptio — עלויות IT", "Turbonomic — ניצול משאבים", "Envizi — אנרגיה ופליטות"], fill: C.accent1, tc: C.background1 },
    { h: "בקרה ותוצר", items: ["watsonx.governance — שקיפות", "מבחן הרווח", "דשבורד ניהולי", "עוזר שיחה: ״איפה הכסף?״"], fill: C.text2, tc: C.background1 },
  ];
  const aw = 3.6, ag = 0.66, ax0 = W - 0.6 - aw;
  for (let i = 0; i < 3; i++) {
    const c = cols[i], x = ax0 - i * (aw + ag), y = 1.6;
    card(s, x, y, aw, 4.9, c.fill, "architecture column " + (i + 1));
    T(s, c.h, { x: x + 0.25, y: y + 0.2, w: aw - 0.5, h: 0.6, fontSize: 22, bold: true, color: i === 0 ? C.text2 : C.accent2, align: "center" });
    T(s, c.items.map((t, k) => ({ text: t, options: { bullet: true, rtlMode: true, align: "right", breakLine: k < c.items.length - 1, paraSpaceAfter: 10 } })),
      { x: x + 0.25, y: y + 1.0, w: aw - 0.5, h: 3.7, fontSize: 16, color: c.tc, valign: "top" });
    if (i < 2) s.addImage({ data: await icon(fa.FaArrowLeft, H.accent2), x: x - ag / 2 - 0.2, y: y + 2.25, w: 0.4, h: 0.4, altText: "חץ", objectName: "arch arrow " + (i + 1) });
  }
  s.addNotes("משתלבים בכלים ש-IBM כבר מוכרת ללקוחות ארגוניים: Apptio, Turbonomic ו-Envizi, עם watsonx כשכבת ה-AI והממשל.");

  // ---------- 11. Roadmap ----------
  s = add("ביצוע");
  title(s, "מפת דרכים ל-12 חודשים");
  const rm = [
    { q: "רבעון 1", h: "MVP", t: "מנועי כלים וחשמל, חיבור ל-Apptio ו-Turbonomic" },
    { q: "רבעון 2", h: "פיילוט", t: "2 ארגונים, מדידת חיסכון מאומת מול קו בסיס" },
    { q: "רבעון 3", h: "מנוע אנשים", t: "הוספת ניתוח כפילויות משימות עם watsonx.governance" },
    { q: "רבעון 4", h: "השקה", t: "הפצה דרך שותפי IBM ו-10 לקוחות משלמים" },
  ];
  s.addShape(pres.shapes.LINE, { x: 1.2, y: 3.0, w: 10.9, h: 0, line: { color: C.accent3, width: 3 }, objectName: "timeline line" });
  for (let i = 0; i < 4; i++) {
    const r = rm[i], x = sx0 - i * (sw + sg);
    s.addShape(pres.shapes.OVAL, { x: x + sw / 2 - 0.3, y: 2.7, w: 0.6, h: 0.6, fill: { color: i === 0 ? C.accent2 : C.accent1 }, line: { color: "FFFFFF", width: 2 }, objectName: "milestone " + (i + 1) });
    T(s, r.q, { x, y: 2.05, w: sw, h: 0.45, fontSize: 15, bold: true, color: C.accent4, align: "center" });
    card(s, x, 3.6, sw, 2.6, C.background2, "milestone card " + (i + 1));
    T(s, r.h, { x: x + 0.2, y: 3.75, w: sw - 0.4, h: 0.55, fontSize: 22, bold: true, color: C.text2, align: "center" });
    T(s, r.t, { x: x + 0.2, y: 4.35, w: sw - 0.4, h: 1.7, fontSize: 15, color: C.text1, align: "center", valign: "top" });
  }
  s.addNotes("מתחילים בתחומים שבהם הנתונים זמינים והחיסכון מהיר (כלים, חשמל), ורק אחר כך מנוע האנשים — הרגיש יותר.");

  // ---------- 12. Team ----------
  s = add("ביצוע");
  title(s, "הצוות");
  const team = [["[שם מלא]", "[תפקיד — למשל: מובילת מוצר]", "[ניסיון רלוונטי]"], ["[שם מלא]", "[תפקיד — למשל: Data / AI]", "[ניסיון רלוונטי]"], ["[שם מלא]", "[תפקיד — למשל: פיתוח]", "[ניסיון רלוונטי]"]];
  for (let i = 0; i < 3; i++) {
    const x = cx0 - i * (cw + cg), y = 1.7;
    card(s, x, y, cw, 4.6, C.background2, "team card " + (i + 1));
    await circleIcon(s, fa.FaUserTie, x + cw / 2 - 0.75, y + 0.4, 1.5, C.text2, H.accent2, "חבר/ת צוות " + (i + 1));
    T(s, team[i][0], { x: x + 0.25, y: y + 2.1, w: cw - 0.5, h: 0.55, fontSize: 22, bold: true, color: C.text2, align: "center" });
    T(s, team[i][1], { x: x + 0.25, y: y + 2.7, w: cw - 0.5, h: 0.5, fontSize: 15, bold: true, color: C.accent1, align: "center" });
    T(s, team[i][2], { x: x + 0.25, y: y + 3.25, w: cw - 0.5, h: 1.1, fontSize: 15, color: C.text1, align: "center", valign: "top" });
  }
  s.addNotes("השלימו שמות, תפקידים וניסיון של חברי הצוות.");

  // ---------- 13. Ask ----------
  pres.addSection({ title: "סיכום" });
  s = add("סיכום", "DARK");
  T(s, "מה אנחנו מבקשים מ-IBM", { x: 0.6, y: 0.7, w: 12.13, h: 0.9, fontSize: 36, bold: true, color: C.background1 });
  const asks = [
    { ic: fa.FaCogs, h: "גישה לטכנולוגיה", t: "סביבת watsonx, Apptio ו-Turbonomic לפיתוח" },
    { ic: fa.FaBullseye, h: "לקוח פיילוט", t: "חיבור לארגון אחד-שניים מלקוחות IBM" },
    { ic: fa.FaHandshake, h: "ליווי מנטור", t: "מומחה FinOps / Sustainability מ-IBM" },
  ];
  for (let i = 0; i < 3; i++) {
    const a = asks[i], x = cx0 - i * (cw + cg), y = 1.9;
    card(s, x, y, cw, 2.9, C.accent1, "ask card " + (i + 1));
    await circleIcon(s, a.ic, x + cw / 2 - 0.45, y + 0.3, 0.9, C.text2, H.accent2, a.h);
    T(s, a.h, { x: x + 0.25, y: y + 1.35, w: cw - 0.5, h: 0.55, fontSize: 21, bold: true, color: C.background1, align: "center" });
    T(s, a.t, { x: x + 0.25, y: y + 1.9, w: cw - 0.5, h: 0.85, fontSize: 15, color: C.background1, align: "center", valign: "top" });
  }
  T(s, "כל שקל שנחסך — בלי לפגוע באף שקל של רווח", { x: 0.6, y: 5.35, w: 12.13, h: 0.8, fontSize: 28, bold: true, italic: true, color: C.accent2, align: "center" });
  T(s, "[שם הצוות]  ·  [מייל ליצירת קשר]", { x: 0.6, y: 6.25, w: 12.13, h: 0.5, fontSize: 16, color: C.background2, align: "center" });
  s.addNotes("סיום: הבקשה הקונקרטית, ומשפט הסיום שחוזר על ההבטחה המרכזית.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
