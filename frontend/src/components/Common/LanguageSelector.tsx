import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

const languages = [
  { code: 'en', label: 'English', flag: 'US' },
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'de', label: 'Deutsch', flag: 'DE' },
  { code: 'pl', label: 'Polski', flag: 'PL' },
  { code: 'es', label: 'Español', flag: 'ES' },
]

interface LanguageSelectorProps {
  onChange?: (lang: string) => void
}

export default function LanguageSelector({ onChange }: LanguageSelectorProps) {
  const { t, i18n } = useTranslation()

  const handleChange = (lang: string) => {
    i18n.changeLanguage(lang)
    onChange?.(lang)
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-zinc-500" />
      <select
        value={i18n.language}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t('language')}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white outline-none focus:border-[#FF7000]"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </div>
  )
}
