# Panodaki anahtarı .dev.vars dosyasına yazar (yerel geliştirme; dosya git'e girmez). Anahtar ekrana yazılmaz.
#   1. Anahtarı panelde kopyala (Stripe: Developers > API keys > Secret key; Supabase: Project Settings > API Keys > Secret keys)
#   2. powershell -ExecutionPolicy Bypass -File scripts\set-dev-secret.ps1 stripe      (ya da: supabase)
# Yalnızca deneme anahtarını kabul eder (sk_test_ / rk_test_): canlı anahtar bu dosyaya değil, doğrudan
# `npx wrangler secret put STRIPE_SECRET_KEY` ile Worker'a verilir.
param([Parameter(Mandatory = $true)][ValidateSet('stripe', 'supabase')][string]$Which)

$rules = @{
  stripe   = @{ Name = 'STRIPE_SECRET_KEY'; Pattern = '^(sk|rk)_test_[A-Za-z0-9]{20,}$'; Hint = 'sk_test_ ile baslayan Stripe deneme anahtari' }
  supabase = @{ Name = 'SUPABASE_SECRET_KEY'; Pattern = '^(sb_secret_[A-Za-z0-9_\-]{20,}|eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)$'; Hint = 'sb_secret_ ile baslayan Supabase gizli anahtari' }
}
$rule = $rules[$Which]
$value = Get-Clipboard -Raw
if ($null -eq $value) { $value = '' }
$value = $value.Trim()
if ($value -notmatch $rule.Pattern) {
  Write-Output "Panoda $($rule.Hint) yok. Anahtari panelde kopyalayip yeniden dene. (Dosya degismedi.)"
  exit 1
}
$path = Join-Path (Split-Path $PSScriptRoot -Parent) '.dev.vars'
$lines = @()
if (Test-Path $path) { $lines = @(Get-Content $path | Where-Object { $_ -notmatch "^$($rule.Name)=" }) }
$lines += "$($rule.Name)=$value"
[System.IO.File]::WriteAllLines($path, $lines, (New-Object System.Text.UTF8Encoding($false)))
Set-Clipboard -Value ' '
Write-Output "$($rule.Name) .dev.vars dosyasina yazildi, pano temizlendi."
