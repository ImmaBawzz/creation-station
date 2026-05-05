# Creation Station

Creation Station is a small creative workflow app.

Flow:

1. Save an idea in the Inbox.
2. Send it to the Factory Planner.
3. Let Ollama create a first project plan.
4. Review the plan.
5. Approve it to create tasks.

## What You Need

1. Node.js installed.
2. Ollama installed and running.
3. A local Ollama model pulled to your machine.

Recommended model:

```bash
ollama pull qwen2.5:14b-instruct
```

Lighter fallback:

```bash
ollama pull llama3.1:8b-instruct
```

## First Setup

1. Install app packages:

```bash
npm install
```

2. Make sure your local environment file exists:

```bash
.env.local
```

3. Put these values in `.env.local`:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:14b-instruct
DATABASE_URL=file:./dev.db
```

4. Start Ollama.

5. Start the app:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## How To Use It

### Inbox

1. Add a title.
2. Add the raw idea text.
3. Click `Save to Inbox`.

### Factory Planner

1. Open the `Factory Planner` page.
2. Find the idea you want.
3. Click `Make AI Plan`.
4. Wait for the local model to finish.
5. Read the plan sections:
	Summary, Main Concept, What You Need, Risks, Next Steps.

### Review And Tasks

1. Go back to the home page.
2. Review the saved plan.
3. Click `Approve + Create Tasks`.

## If Something Goes Wrong

### Ollama is not running

Start Ollama first, then try again.

### The model name is wrong

Check `OLLAMA_MODEL` in `.env.local`.

### The app cannot reach Ollama

Check `OLLAMA_BASE_URL` in `.env.local`.

### The plan does not save

Make sure the model returned all required fields.

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
```
