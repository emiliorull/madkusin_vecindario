# ============================================================================
# deploy.ps1 - Sincroniza cambios locales con GitHub y despliega en el Droplet
# Ruta local: c:\Users\emili\Documents\MADKUSIN\vecindario
# Uso: .\deploy.ps1 "Descripción del cambio"
# ============================================================================

param(
    [string]$CommitMessage = "Actualizar web vecindario.madkusin.com"
)

$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot
$SshKey = "$env:USERPROFILE\.ssh\madkusin_tmp"
$DropletHost = "root@167.99.45.111"

Write-Host "1. Guardando cambios en Git y subiendo a GitHub..." -ForegroundColor Cyan
Set-Location $ProjectDir
if (Get-Command git -ErrorAction SilentlyContinue) {
    git add .
    $status = git status --porcelain
    if ($status) {
        git commit -m $CommitMessage
    }
    git push origin main
}

Write-Host "2. Subiendo archivos actualizados al Droplet (167.99.45.111)..." -ForegroundColor Cyan
scp -4 -r -o BatchMode=yes -i $SshKey "$ProjectDir\src" "$ProjectDir\public" "$ProjectDir\functions" "$ProjectDir\index.html" "$ProjectDir\package.json" "$ProjectDir\vite.config.js" "$ProjectDir\tailwind.config.js" "$ProjectDir\postcss.config.js" "$ProjectDir\Dockerfile" "$ProjectDir\server.js" "${DropletHost}:/opt/n8n/vecindario/"

Write-Host "3. Recompilando y reiniciando contenedor vecindario en DigitalOcean..." -ForegroundColor Cyan
ssh -4 -n -o BatchMode=yes -i $SshKey $DropletHost "cd /opt/n8n && docker compose up -d --build vecindario"

Write-Host "¡Despliegue completado! Web actualizada en https://vecindario.madkusin.com" -ForegroundColor Green
