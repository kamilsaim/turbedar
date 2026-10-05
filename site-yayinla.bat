@echo off
REM Turbedar ? SEO sitesi + paylasim kartlarini uretip Firebase'e yukler.
REM Windows Zamanlayici'daki "TurbedarSite" gorevi bunu haftada bir calistirir;
REM yeni kayit onaylandiginda elle de cift tiklanabilir.
REM Kayit: _yayin\son-calisma.log

cd /d "%~dp0"
if not exist _yayin mkdir _yayin
set LOG=_yayin\son-calisma.log

echo === %date% %time% === > %LOG%
call node site-uret >> %LOG% 2>&1 || goto hata
call node yayin.js >> %LOG% 2>&1 || goto hata

REM Yeni kayitlarin kalici adresleri (seo-sluglar.json) repoya islenir
git diff --quiet -- seo-sluglar.json
if errorlevel 1 (
  git add seo-sluglar.json >> %LOG% 2>&1
  git commit -q -m "seo-sluglar: yeni kayit adresleri (otomatik)" -- seo-sluglar.json >> %LOG% 2>&1
  git push -q origin main >> %LOG% 2>&1
)
echo TAMAM >> %LOG%
exit /b 0

:hata
echo HATA - ayrinti yukarida >> %LOG%
exit /b 1
