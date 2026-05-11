#!/usr/bin/env bash
set -euo pipefail

# Best-effort dependency bootstrap. Safe to skip if your CI already installs dependencies.

if [ -f package.json ]; then
  if [ -f pnpm-lock.yaml ]; then
    corepack enable || true
    pnpm install --frozen-lockfile || pnpm install
  elif [ -f yarn.lock ]; then
    corepack enable || true
    yarn install --frozen-lockfile || yarn install
  elif [ -f package-lock.json ]; then
    npm ci || npm install
  else
    npm install
  fi
fi

if [ -f pyproject.toml ]; then
  if command -v uv >/dev/null 2>&1; then
    uv sync || true
  elif [ -f requirements.txt ]; then
    python -m pip install -r requirements.txt
  fi
elif [ -f requirements.txt ]; then
  python -m pip install -r requirements.txt
fi

if [ -f Gemfile ]; then
  bundle install || true
fi

if [ -f go.mod ]; then
  go mod download || true
fi

if [ -f Cargo.toml ]; then
  cargo fetch || true
fi
