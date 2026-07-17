# هذا السكريبت يقوم بعملية الرفع بشكل آلي وسريع جداً

Write-Host "1. Building frontend locally (Fast)..." -ForegroundColor Cyan
npm run build

Write-Host "2. Pushing code to GitHub..." -ForegroundColor Cyan
# نطلب من المستخدم إدخال رسالة التحديث
$commitMessage = Read-Host "Enter commit message (or press Enter for default)"
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "Auto deploy update"
}

git add .
git commit -m $commitMessage
git push

Write-Host "3. Pulling new code on Server..." -ForegroundColor Cyan
ssh root@64.227.115.100 "cd /var/www/sanfoor && git pull"

Write-Host "4. Uploading fast build directly to server..." -ForegroundColor Cyan
scp -r public/build root@64.227.115.100:/var/www/sanfoor/public/

Write-Host "Deployment Complete! 🚀 (Finished in seconds instead of minutes!)" -ForegroundColor Green
Read-Host "Press Enter to exit"
