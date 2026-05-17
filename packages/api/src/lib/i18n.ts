type Language = 'en' | 'fr';

const translations: Record<Language, Record<string, string>> = {
  en: {
    BAN: 'Ban',
    KICK: 'Kick',
    MUTE: 'Mute',
    // add other event types as needed
  },
  fr: {
    BAN: 'Banni',
    KICK: 'Kické',
    MUTE: 'Muet',
    // add other event types as needed
  },
};

export function getLanguage(request: any): Language {
  const header = request.headers['accept-language'];
  if (header) {
    const lang = header.split(',')[0].trim().toLowerCase();
    if (lang.startsWith('fr')) return 'fr';
  }
  if (request.cookies?.session?.language) {
    const c = request.cookies.session.language;
    if (c === 'fr') return 'fr';
  }
  return 'en';
}

export function translate(key: string, lang: Language): string {
  return translations[lang][key] ?? key;
}
