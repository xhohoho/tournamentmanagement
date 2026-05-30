Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon('C:\GamerSignal\Launcher\launcher.exe')
$bitmap = $icon.ToBitmap()
$bitmap.Save('C:\Users\ryu19\OneDrive\Documents\GitHub\tournamentmanagement\public\launcher-icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output 'Icon extracted successfully'
