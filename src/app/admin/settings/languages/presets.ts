/**
 * Curated starting points for the "Add language" form: code, English name,
 * native name, script direction and a Google Font that actually covers the
 * script (so a new language renders correctly without any CSS work).
 */
export type LanguagePreset = {
  code: string;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  font: string;
  flag: string;
};

export const LANGUAGE_PRESETS: LanguagePreset[] = [
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr", font: "Noto Sans Devanagari", flag: "🇮🇳" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl", font: "Noto Nastaliq Urdu", flag: "🇵🇰" },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl", font: "Noto Naskh Arabic", flag: "🇸🇦" },
  { code: "fa", name: "Persian", nativeName: "فارسی", dir: "rtl", font: "Noto Naskh Arabic", flag: "🇮🇷" },
  { code: "he", name: "Hebrew", nativeName: "עברית", dir: "rtl", font: "Noto Sans Hebrew", flag: "🇮🇱" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", dir: "ltr", font: "Noto Sans Tamil", flag: "🇮🇳" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", dir: "ltr", font: "Noto Sans Telugu", flag: "🇮🇳" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", dir: "ltr", font: "Noto Sans Kannada", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", dir: "ltr", font: "Noto Sans Malayalam", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", dir: "ltr", font: "Noto Sans Devanagari", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", dir: "ltr", font: "Noto Sans Gujarati", flag: "🇮🇳" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", dir: "ltr", font: "Noto Sans Gurmukhi", flag: "🇮🇳" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली", dir: "ltr", font: "Noto Sans Devanagari", flag: "🇳🇵" },
  { code: "si", name: "Sinhala", nativeName: "සිංහල", dir: "ltr", font: "Noto Sans Sinhala", flag: "🇱🇰" },
  { code: "my", name: "Burmese", nativeName: "မြန်မာ", dir: "ltr", font: "Noto Sans Myanmar", flag: "🇲🇲" },
  { code: "th", name: "Thai", nativeName: "ไทย", dir: "ltr", font: "Noto Sans Thai", flag: "🇹🇭" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", dir: "ltr", font: "Noto Sans", flag: "🇻🇳" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr", font: "Noto Sans", flag: "🇮🇩" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", dir: "ltr", font: "Noto Sans", flag: "🇲🇾" },
  { code: "fil", name: "Filipino", nativeName: "Filipino", dir: "ltr", font: "Noto Sans", flag: "🇵🇭" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", dir: "ltr", font: "Noto Sans SC", flag: "🇨🇳" },
  { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr", font: "Noto Sans JP", flag: "🇯🇵" },
  { code: "ko", name: "Korean", nativeName: "한국어", dir: "ltr", font: "Noto Sans KR", flag: "🇰🇷" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr", font: "Noto Sans", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr", font: "Noto Sans", flag: "🇩🇪" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr", font: "Noto Sans", flag: "🇪🇸" },
  { code: "pt", name: "Portuguese", nativeName: "Português", dir: "ltr", font: "Noto Sans", flag: "🇵🇹" },
  { code: "it", name: "Italian", nativeName: "Italiano", dir: "ltr", font: "Noto Sans", flag: "🇮🇹" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", dir: "ltr", font: "Noto Sans", flag: "🇳🇱" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", dir: "ltr", font: "Noto Sans", flag: "🇸🇪" },
  { code: "da", name: "Danish", nativeName: "Dansk", dir: "ltr", font: "Noto Sans", flag: "🇩🇰" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", dir: "ltr", font: "Noto Sans", flag: "🇳🇴" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", dir: "ltr", font: "Noto Sans", flag: "🇫🇮" },
  { code: "pl", name: "Polish", nativeName: "Polski", dir: "ltr", font: "Noto Sans", flag: "🇵🇱" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr", font: "Noto Sans", flag: "🇹🇷" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr", font: "Noto Sans", flag: "🇷🇺" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", dir: "ltr", font: "Noto Sans", flag: "🇺🇦" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", dir: "ltr", font: "Noto Sans", flag: "🇬🇷" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", dir: "ltr", font: "Noto Sans", flag: "🇰🇪" },
  { code: "am", name: "Amharic", nativeName: "አማርኛ", dir: "ltr", font: "Noto Sans Ethiopic", flag: "🇪🇹" },
];

export const PRESET_BY_CODE = new Map(LANGUAGE_PRESETS.map((p) => [p.code, p]));
