#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
agent_dir="${repo_root}/.agent/skills"
codex_repo_skills="${repo_root}/.codex/skills"
codex_home="${CODEX_HOME:-$HOME/.codex}"
superpowers_dir="${codex_home}/superpowers/skills"
global_skills_dir="${codex_home}/skills"

mkdir -p "${agent_dir}"

rm -rf "${agent_dir}"
mkdir -p "${agent_dir}"

if [[ -d "${codex_repo_skills}" ]]; then
  rsync -a "${codex_repo_skills}/" "${agent_dir}/"
fi

if [[ -d "${superpowers_dir}" ]]; then
  rsync -a "${superpowers_dir}/" "${agent_dir}/"
fi

for skill in frontend-design desloppify; do
  if [[ -d "${global_skills_dir}/${skill}" ]]; then
    rsync -a "${global_skills_dir}/${skill}/" "${agent_dir}/${skill}/"
  fi
done

echo "Synced local Antigravity skills into ${agent_dir}"
