/**
 * i18n.test.ts — Tests for the language helpers in i18n/index.tsx: reading the language from a URL,
 * adding/removing the /en prefix, and applying the language to <html>.
 */
import { describe, expect, it } from 'vitest'
import { applyDocumentLocale, delocalizePath, detectLocale, localizePath } from '@/i18n'

describe('detectLocale', () => {
  it('reads an enabled language prefix', () => {
    expect(detectLocale('/en')).toBe('en')
    expect(detectLocale('/en/where-to-buy')).toBe('en')
  })

  it('falls back to Hebrew for unprefixed, disabled or unknown prefixes', () => {
    expect(detectLocale('/')).toBe('he')
    expect(detectLocale('/where-to-buy')).toBe('he')
    expect(detectLocale('/ru/where-to-buy')).toBe('he')
    expect(detectLocale('/english')).toBe('he')
  })
})

describe('localizePath', () => {
  it('prefixes non-default languages, keeping search and hash', () => {
    expect(localizePath('/where-to-buy', 'en')).toBe('/en/where-to-buy')
    expect(localizePath('/', 'en')).toBe('/en')
    expect(localizePath('/#brands', 'en')).toBe('/en#brands')
    expect(localizePath('/?q=1', 'en')).toBe('/en?q=1')
  })

  it('leaves Hebrew paths unprefixed', () => {
    expect(localizePath('/where-to-buy', 'he')).toBe('/where-to-buy')
    expect(localizePath('/#brands', 'he')).toBe('/#brands')
  })
})

describe('delocalizePath', () => {
  it('strips an enabled language prefix', () => {
    expect(delocalizePath('/en/where-to-buy')).toBe('/where-to-buy')
    expect(delocalizePath('/en')).toBe('/')
  })

  it('leaves unprefixed, disabled and unknown prefixes alone (so they 404)', () => {
    expect(delocalizePath('/where-to-buy')).toBe('/where-to-buy')
    expect(delocalizePath('/ru/where-to-buy')).toBe('/ru/where-to-buy')
    expect(delocalizePath('/english')).toBe('/english')
  })
})

describe('applyDocumentLocale', () => {
  it('sets <html lang> and <html dir>', () => {
    applyDocumentLocale('en')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    applyDocumentLocale('he')
    expect(document.documentElement).toHaveAttribute('lang', 'he')
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
  })
})
