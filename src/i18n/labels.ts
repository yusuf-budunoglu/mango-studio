import i18n from '.'

// Motor dilden bağımsızdır; animasyon, eğri ve kategori adları çeviri dosyalarından gelir.
// Bu fonksiyonları çağıran bileşen `useTranslation()` kullanmalı ki dil değişince yeniden çizilsin.
export const presetLabel = (id: string) => i18n.t(`presets.${id}`, { defaultValue: id })
export const easingLabel = (id: string) => i18n.t(`easings.${id}`, { defaultValue: id })
export const categoryLabel = (id: string) => i18n.t(`categories.${id}`, { defaultValue: id })
export const paramLabel = (key: string) => i18n.t(`params.${key}`, { defaultValue: key })
