@echo off
chcp 65001 > nul
echo جاري إعادة تسمية الكروت...

powershell -NoProfile -ExecutionPolicy Bypass -Command "^
    $base = 'cards'; ^
    $map = @{ ^
        'Good/صقر'           = 'falcon.png'; ^
        'Good/معالجة النور'   = 'light-healer.png'; ^
        'Good/التاجر الماكر'  = 'cunning-trader.png'; ^
        'Good/حارس الخزنة'   = 'vault-guardian.png'; ^
        'Good/درع النور'      = 'light-shield.png'; ^
        'Good/سيف العدالة'   = 'sword-of-justice.png'; ^
        'Evil/الجار الصامت'  = 'silent-neighbor.png'; ^
        'Evil/تنين الجحيم'   = 'hell-dragon.png'; ^
        'Evil/غول الظلام'    = 'dark-ghoul.png'; ^
        'Evil/كاهن الرعب'    = 'dread-priest.png'; ^
        'Evil/وادي الصراخ'   = 'screaming-valley.png'; ^
        'Evil/وحش الصندوق'   = 'box-monster.png' ^
    }; ^
    foreach ($key in $map.Keys) { ^
        Get-ChildItem -Path \"$base/$key.*\" -ErrorAction SilentlyContinue | ForEach-Object { ^
            Rename-Item -Path $_.FullName -NewName $map[$key] -Force; ^
            Write-Host \"[تم] تغيير: $($_.Name) -> $($map[$key])\"; ^
        } ^
    }"

echo.
echo تم إكمال عملية إعادة التسمية بنجاح!
pause