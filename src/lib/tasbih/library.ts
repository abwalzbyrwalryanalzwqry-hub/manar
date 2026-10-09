// ============================================================
// منار — مكتبة أذكار المسبحة (محتوى ثابت موثّق)
// ------------------------------------------------------------
// قواعد المحتوى:
// • النص الشرعي منفصل عن أي عدد: `documented` = عدد ورد في النص المذكور
//   في المصدر نفسه، مع وصف موضعه. لا يُعرض العدد الافتراضي للمسبحة بوصفه سُنّة.
// • كل ذكر معه مصدر قابل للتحقق (رابط sunnah.com برقم الحديث في طبعته)،
//   والدرجة تُذكر فقط لغير الصحيحين وكما هي في الصفحة المرجعية.
// • النص القرآني مأخوذ حرفيًا من مصحف تنزيل المضمّن في التطبيق
//   (public/data/quran/uthmani) ويختبره `tests/unit/tasbih-library.test.ts`.
// • استُبعد ما لم يثبت: «سبحان الله العظيم وبحمده» (الترمذي ٣٤٦٤ ضعّفه المحقق).
// ============================================================

export type TasbihCategory = "tasbih" | "istighfar" | "tahlil" | "takbir" | "salawat" | "mixed";

export const TASBIH_CATEGORIES: { key: TasbihCategory; label: string }[] = [
  { key: "tasbih", label: "التسبيح والتحميد" },
  { key: "istighfar", label: "الاستغفار" },
  { key: "tahlil", label: "التهليل" },
  { key: "takbir", label: "التكبير" },
  { key: "salawat", label: "الصلاة على النبي ﷺ" },
  { key: "mixed", label: "أذكار متنوعة" },
];

export interface TasbihSource {
  /** وصف المصدر للعرض، مثل «صحيح مسلم ٢٦٩٨». */
  label: string;
  url: string;
  /** درجة الحديث كما في الصفحة المرجعية (لغير الصحيحين فقط). */
  grade?: string;
}

export interface LibraryZikr {
  id: string;
  category: TasbihCategory;
  /** اسم قصير للعرض. */
  name: string;
  /** النص الشرعي كما ورد. */
  text: string;
  /** إن كان النص مقتطفًا من آية: موضعه في المصحف. */
  quran?: { surah: number; ayah: number; surahName: string };
  /** أعداد ورد ذكرها في المصدر (للإعلام فقط — المستخدم يختار هدفه). */
  documented?: { count: number; context: string }[];
  /** خلاصة ما ورد، بلا زيادة على المصدر. */
  about?: string;
  sources: TasbihSource[];
}

const sunnah = (path: string) => `https://sunnah.com/${path}`;

export const TASBIH_LIBRARY: readonly LibraryZikr[] = [
  {
    id: "subhanallah",
    category: "tasbih",
    name: "التسبيح",
    text: "سُبْحَانَ اللَّهِ",
    documented: [
      { count: 33, context: "دبر كل صلاة، مع التحميد والتكبير" },
      { count: 100, context: "مائة تسبيحة (في حديث مسلم ٢٦٩٨)" },
    ],
    sources: [
      { label: "صحيح مسلم ٥٩٧", url: sunnah("muslim:597a") },
      { label: "صحيح مسلم ٢٦٩٨", url: sunnah("muslim:2698") },
    ],
  },
  {
    id: "alhamdulillah",
    category: "tasbih",
    name: "التحميد",
    text: "الْحَمْدُ لِلَّهِ",
    documented: [{ count: 33, context: "دبر كل صلاة، مع التسبيح والتكبير" }],
    about: "«وأفضل الدعاء الحمد لله».",
    sources: [
      { label: "صحيح مسلم ٥٩٧", url: sunnah("muslim:597a") },
      { label: "جامع الترمذي ٣٣٨٣", url: sunnah("tirmidhi:3383"), grade: "حسن" },
    ],
  },
  {
    id: "subhanallah-wabihamdihi",
    category: "tasbih",
    name: "سبحان الله وبحمده",
    text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    documented: [{ count: 100, context: "مائة مرة في يوم" }],
    sources: [
      { label: "صحيح البخاري ٦٤٠٥", url: sunnah("bukhari:6405") },
      { label: "صحيح مسلم ٢٦٩١", url: sunnah("muslim:2691") },
    ],
  },
  {
    id: "subhanallah-alazim",
    category: "tasbih",
    name: "كلمتان خفيفتان",
    text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ",
    about: "«كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن».",
    sources: [
      { label: "صحيح البخاري ٧٥٦٣", url: sunnah("bukhari:7563") },
      { label: "صحيح مسلم ٢٦٩٤", url: sunnah("muslim:2694") },
    ],
  },
  {
    id: "adada-khalqihi",
    category: "tasbih",
    name: "عدد خلقه",
    text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ",
    documented: [{ count: 3, context: "ثلاث مرات" }],
    sources: [{ label: "صحيح مسلم ٢٧٢٦", url: sunnah("muslim:2726") }],
  },
  {
    id: "astaghfirullah",
    category: "istighfar",
    name: "الاستغفار",
    text: "أَسْتَغْفِرُ اللَّهَ",
    documented: [{ count: 3, context: "ثلاثًا بعد السلام من الصلاة" }],
    sources: [{ label: "صحيح مسلم ٥٩١", url: sunnah("muslim:591") }],
  },
  {
    id: "astaghfirullah-watubu",
    category: "istighfar",
    name: "أستغفر الله وأتوب إليه",
    text: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ",
    about:
      "قال ﷺ: إني لأستغفر الله وأتوب إليه في اليوم أكثر من سبعين مرة (البخاري)، وعند مسلم: إني لأستغفر الله في اليوم مائة مرة.",
    sources: [
      { label: "صحيح البخاري ٦٣٠٧", url: sunnah("bukhari:6307") },
      { label: "صحيح مسلم ٢٧٠٢", url: sunnah("muslim:2702a") },
    ],
  },
  {
    id: "rabbighfirli",
    category: "istighfar",
    name: "رب اغفر لي وتب عليّ",
    text: "رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ، إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ",
    documented: [{ count: 100, context: "عُدّت للنبي ﷺ مائة مرة في المجلس الواحد" }],
    sources: [
      { label: "سنن أبي داود ١٥١٦", url: sunnah("abudawud:1516"), grade: "صحيح (الألباني)" },
    ],
  },
  {
    id: "astaghfirullah-alhayy",
    category: "istighfar",
    name: "الحي القيوم",
    text: "أَسْتَغْفِرُ اللَّهَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ وَأَتُوبُ إِلَيْهِ",
    sources: [
      { label: "سنن أبي داود ١٥١٧", url: sunnah("abudawud:1517"), grade: "صحيح (الألباني)" },
    ],
  },
  {
    id: "sayyid-alistighfar",
    category: "istighfar",
    name: "سيد الاستغفار",
    text: "اللَّهُمَّ أَنْتَ رَبِّي، لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ لَكَ بِذَنْبِي، فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
    about: "يُقال في النهار وفي الليل موقنًا به.",
    sources: [{ label: "صحيح البخاري ٦٣٠٦", url: sunnah("bukhari:6306") }],
  },
  {
    id: "la-ilaha-illallah",
    category: "tahlil",
    name: "التهليل",
    text: "لَا إِلَهَ إِلَّا اللَّهُ",
    about: "«أفضل الذكر لا إله إلا الله».",
    sources: [{ label: "جامع الترمذي ٣٣٨٣", url: sunnah("tirmidhi:3383"), grade: "حسن" }],
  },
  {
    id: "tahlil-kamil",
    category: "tahlil",
    name: "لا إله إلا الله وحده لا شريك له",
    text: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
    documented: [
      { count: 100, context: "مائة مرة في يوم" },
      { count: 10, context: "عشر مرات" },
    ],
    sources: [
      { label: "صحيح البخاري ٦٤٠٣", url: sunnah("bukhari:6403") },
      { label: "صحيح البخاري ٦٤٠٤", url: sunnah("bukhari:6404") },
    ],
  },
  {
    id: "dhun-nun",
    category: "tahlil",
    name: "دعوة ذي النون",
    text: "لَّآ إِلَٰهَ إِلَّآ أَنتَ سُبْحَٰنَكَ إِنِّى كُنتُ مِنَ ٱلظَّٰلِمِينَ",
    quran: { surah: 21, ayah: 87, surahName: "الأنبياء" },
    sources: [{ label: "سورة الأنبياء، الآية ٨٧", url: "https://quran.com/21/87" }],
  },
  {
    id: "allahu-akbar",
    category: "takbir",
    name: "التكبير",
    text: "اللَّهُ أَكْبَرُ",
    documented: [{ count: 33, context: "دبر كل صلاة، مع التسبيح والتحميد" }],
    sources: [{ label: "صحيح مسلم ٥٩٧", url: sunnah("muslim:597a") }],
  },
  {
    id: "akbar-kabira",
    category: "takbir",
    name: "الله أكبر كبيرًا",
    text: "اللَّهُ أَكْبَرُ كَبِيرًا، وَالْحَمْدُ لِلَّهِ كَثِيرًا، وَسُبْحَانَ اللَّهِ بُكْرَةً وَأَصِيلًا",
    sources: [{ label: "صحيح مسلم ٦٠١", url: sunnah("muslim:601") }],
  },
  {
    id: "salat-ibrahimiyya",
    category: "salawat",
    name: "الصلاة الإبراهيمية",
    text: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ",
    about: "«من صلّى عليّ واحدة صلّى الله عليه عشرًا».",
    sources: [
      { label: "صحيح البخاري ٣٣٧٠", url: sunnah("bukhari:3370") },
      { label: "صحيح مسلم ٤٠٨", url: sunnah("muslim:408") },
    ],
  },
  {
    id: "albaqiyat",
    category: "mixed",
    name: "الباقيات الصالحات",
    text: "سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ",
    about: "«أحبّ الكلام إلى الله أربع… لا يضرّك بأيّهن بدأت».",
    sources: [
      { label: "صحيح مسلم ٢١٣٧", url: sunnah("muslim:2137") },
      { label: "صحيح مسلم ٢٦٩٥", url: sunnah("muslim:2695") },
    ],
  },
  {
    id: "hawqala",
    category: "mixed",
    name: "الحوقلة",
    text: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
    about: "«كنز من كنوز الجنة».",
    sources: [
      { label: "صحيح البخاري ٦٣٨٤", url: sunnah("bukhari:6384") },
      { label: "صحيح مسلم ٢٧٠٤", url: sunnah("muslim:2704") },
    ],
  },
  {
    id: "hasbunallah",
    category: "mixed",
    name: "حسبنا الله ونعم الوكيل",
    text: "حَسْبُنَا ٱللَّهُ وَنِعْمَ ٱلْوَكِيلُ",
    quran: { surah: 3, ayah: 173, surahName: "آل عمران" },
    sources: [
      { label: "سورة آل عمران، الآية ١٧٣", url: "https://quran.com/3/173" },
      { label: "صحيح البخاري ٤٥٦٣", url: sunnah("bukhari:4563") },
    ],
  },
];

const BY_ID = new Map(TASBIH_LIBRARY.map((z) => [z.id, z]));

export function libraryZikr(id: string): LibraryZikr | undefined {
  return BY_ID.get(id);
}
