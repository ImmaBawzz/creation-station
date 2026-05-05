Write-Host "=== Creation Station Stability Check ===" -ForegroundColor Cyan

Write-Host "`n1. Git status" -ForegroundColor Yellow
git status

Write-Host "`n2. Prisma generate" -ForegroundColor Yellow
npx prisma generate

Write-Host "`n3. TypeScript check" -ForegroundColor Yellow
npx tsc --noEmit

Write-Host "`n4. Lint" -ForegroundColor Yellow
npm run lint

Write-Host "`nDone. If all checks passed, run: npm run dev" -ForegroundColor Green
