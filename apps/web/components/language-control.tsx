'use client';

import { useState } from 'react';

export function LanguageControl() {
  const [language, setLanguage] = useState<'en' | 'ta'>('en');

  function selectLanguage(nextLanguage: 'en' | 'ta') {
    setLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage;
  }

  return (
    <div className="language-control" role="group" aria-label="Language">
      <button
        aria-pressed={language === 'en'}
        type="button"
        onClick={() => selectLanguage('en')}
      >
        EN
      </button>
      <button
        aria-pressed={language === 'ta'}
        lang="ta"
        type="button"
        onClick={() => selectLanguage('ta')}
      >
        தமிழ்
      </button>
    </div>
  );
}
