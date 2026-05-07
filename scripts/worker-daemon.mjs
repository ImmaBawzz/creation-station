const baseUrl = process.env.WORKER_BASE_URL || "http://localhost:3000";
const workerId = process.env.WORKER_ID || `creation-station-daemon-${process.pid}`;
const pollMs = Number.parseInt(process.env.WORKER_POLL_MS || "2000", 10);
const actionLimits = {
  file_write: Number.parseInt(process.env.WORKER_FILE_WRITE_LIMIT || "1", 10),
};

let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postTick(body) {
  const response = await fetch(`${baseUrl}/api/worker/tick`, {
    body: JSON.stringify({ actionLimits, workerId, ...body }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Worker tick failed with HTTP ${response.status}.`);
  }

  return response.json();
}

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  try {
    await postTick({ shutdown: true });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Worker shutdown failed.");
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`Creation Station worker daemon started as ${workerId}.`);

while (!shuttingDown) {
  try {
    const tick = await postTick({});
    const status = tick.result?.processed ? tick.result.status : tick.result?.reason;
    console.log(`[${new Date().toISOString()}] ${workerId}: ${status ?? "idle"}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Worker tick failed.");
  }

  await sleep(Number.isFinite(pollMs) && pollMs > 0 ? pollMs : 2000);
}

console.log(`Creation Station worker daemon stopped as ${workerId}.`);
