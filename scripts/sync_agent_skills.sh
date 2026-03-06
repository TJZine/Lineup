#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
agent_parent_dir="${repo_root}/.agent"
agent_dir="${agent_parent_dir}/skills"
codex_repo_skills="${repo_root}/.codex/skills"
codex_home="${CODEX_HOME:-$HOME/.codex}"
superpowers_dir="${codex_home}/superpowers/skills"
global_skills_dir="${codex_home}/skills"
tmp_dir=""
backup_dir=""

cleanup() {
  if [[ -n "${tmp_dir}" && -d "${tmp_dir}" ]]; then
    rm -rf "${tmp_dir}"
  fi

  if [[ -n "${backup_dir}" && -d "${backup_dir}" && ! -e "${agent_dir}" ]]; then
    mv "${backup_dir}" "${agent_dir}"
    backup_dir=""
  fi
}

trap cleanup EXIT

mkdir -p "${agent_parent_dir}"
tmp_dir="$(mktemp -d "${agent_parent_dir}/skills.tmp.XXXXXX")"

if [[ -d "${superpowers_dir}" ]]; then
  rsync -a "${superpowers_dir}/" "${tmp_dir}/"
fi

for skill in frontend-design desloppify; do
  if [[ -d "${global_skills_dir}/${skill}" ]]; then
    rsync -a "${global_skills_dir}/${skill}/" "${tmp_dir}/${skill}/"
  fi
done

# Repo-local skills are the source of truth for Lineup-specific guidance, so
# they are applied last and win on name conflicts.
if [[ -d "${codex_repo_skills}" ]]; then
  rsync -a "${codex_repo_skills}/" "${tmp_dir}/"
fi

if [[ -e "${agent_dir}" ]]; then
  backup_dir="${agent_parent_dir}/skills.backup.$$"
  mv "${agent_dir}" "${backup_dir}"
fi

mv "${tmp_dir}" "${agent_dir}"
tmp_dir=""

if [[ -n "${backup_dir}" && -d "${backup_dir}" ]]; then
  rm -rf "${backup_dir}"
  backup_dir=""
fi

trap - EXIT

if [[ ! -d "${agent_dir}" ]]; then
  echo "Failed to sync local Antigravity skills into ${agent_dir}" >&2
  exit 1
fi

echo "Synced local Antigravity skills into ${agent_dir}"
