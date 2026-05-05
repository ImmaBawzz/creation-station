# Human Review Checklist

Use this when you return from your break.

## First: Health Check

Do not code immediately if you feel dizzy.

- [ ] Drink water
- [ ] Eat something light if needed
- [ ] Look away from screens
- [ ] Get fresh air
- [ ] Sit down if dizziness continues

## Project Check

When back:

```powershell
git status
git log --oneline -5
npm run dev
```

Open:

```text
http://localhost:3000
```

## Review Agent Work

Check:

- [ ] Did the agent stay inside scope?
- [ ] Did it create new systems? If yes, reject/revert.
- [ ] Did it make small commits?
- [ ] Does the app still load?
- [ ] Do statuses look clearer?
- [ ] Are empty states better?
- [ ] Is revision flow clearer?
- [ ] Are there no major console/terminal errors?

## Manual Full Loop Test

- [ ] Create idea
- [ ] Send to Factory
- [ ] Review AI plan
- [ ] Request revision
- [ ] Re-plan with feedback
- [ ] Approve plan
- [ ] Confirm tasks generated

## If Broken

Run:

```powershell
git status
git log --oneline -10
```

Then either:
- Fix the small issue manually
- Ask for help with the exact error
- Revert last commit:

```powershell
git revert HEAD
```
