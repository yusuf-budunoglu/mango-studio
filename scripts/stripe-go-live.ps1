# Ödemeyi canlıya alır: panodaki CANLI Stripe anahtarıyla (sk_live_ / rk_live_) canlı hesapta ürünleri, fiyatları,
# müşteri portalını ve bildirim ucunu açar; sonra üç gizli değeri Worker'a yazar (STRIPE_SECRET_KEY,
# STRIPE_WEBHOOK_SECRET, SUPABASE_SECRET_KEY). Anahtarlar ekrana ve dosyaya yazılmaz. Siteyi YAYINLAMAZ:
# yayın ayrıca `npx wrangler deploy` ile yapılır.
#   1. Stripe panelinde canlı kipte (sandbox değil) Developers > API keys > Secret key'i kopyala
#   2. powershell -ExecutionPolicy Bypass -File scripts/stripe-go-live.ps1
# Yeniden çalıştırılabilir: var olan ürünleri ve bildirim ucunu ikinci kez açmaz.
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$key = Get-Clipboard -Raw
if ($null -eq $key) { $key = '' }
$key = $key.Trim()
if ($key -notmatch '^(sk|rk)_live_[A-Za-z0-9]{20,}$') {
  Write-Output 'Panoda canli Stripe anahtari (sk_live_...) yok. Canli kipte Secret key''i kopyalayip yeniden dene. (Hicbir sey degismedi.)'
  exit 1
}
$supabase = ''
if (Test-Path '.dev.vars') {
  $line = Get-Content '.dev.vars' | Where-Object { $_ -match '^SUPABASE_SECRET_KEY=' } | Select-Object -First 1
  if ($line) { $supabase = ($line -replace '^SUPABASE_SECRET_KEY=', '').Trim() }
}
if (-not $supabase) {
  Write-Output '.dev.vars icinde SUPABASE_SECRET_KEY yok: once scripts/set-dev-secret.ps1 supabase. (Hicbir sey degismedi.)'
  exit 1
}
Set-Clipboard -Value ' '

$env:STRIPE_SECRET_KEY = $key
node scripts/stripe-setup.mjs --live --webhook https://mangostudio.design/api/billing/webhook
$setup = $LASTEXITCODE
Remove-Item Env:STRIPE_SECRET_KEY
if ($setup -ne 0) {
  Write-Output 'Stripe kurulumu basarisiz oldu; Worker gizli degerleri yazilmadi.'
  exit 1
}

$key | npx wrangler secret put STRIPE_SECRET_KEY
if ($LASTEXITCODE -ne 0) { Write-Output 'STRIPE_SECRET_KEY Worker''a yazilamadi.'; exit 1 }
$supabase | npx wrangler secret put SUPABASE_SECRET_KEY
if ($LASTEXITCODE -ne 0) { Write-Output 'SUPABASE_SECRET_KEY Worker''a yazilamadi.'; exit 1 }
Write-Output 'Tamam: canli Stripe kuruldu, gizli degerler Worker''a yazildi, pano temizlendi. Siradaki adim: yayin.'
