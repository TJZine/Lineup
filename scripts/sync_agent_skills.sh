#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
agent_parent_dir="${repo_root}/.agent"
agent_dir="${agent_parent_dir}/skills"
codex_repo_skills="${repo_root}/.codex/skills"
codex_home="${CODEX_HOME:-$HOME/.codex}"
skill_manifest_path="${repo_root}/docs/agentic/skill-mirror-allowlist.txt"
superpowers_dir="${codex_home}/superpowers/skills"
global_skills_dir="${codex_home}/skills"
lock_dir="${agent_parent_dir}/.skills.lock"
tmp_dir=""
backup_dir=""
lock_held=0

copy_global_skill() {
  local source_type="$1"
  local skill="$2"
  local source_dir=""

  case "${source_type}" in
    superpowers)
      source_dir="${superpowers_dir}/${skill}"
      ;;
    global)
      source_dir="${global_skills_dir}/${skill}"
      ;;
    *)
      echo "Unsupported skill source '${source_type}' in ${skill_manifest_path}" >&2
      exit 1
      ;;
  esac

  if [[ ! -d "${source_dir}" ]]; then
    echo "Missing allowlisted skill '${source_type}:${skill}' at ${source_dir}" >&2
    exit 1
  fi

  rsync -a "${source_dir}/" "${tmp_dir}/${skill}/"
}

release_lock() {
  if [[ "${lock_held}" -eq 1 && -d "${lock_dir}" ]]; then
    rmdir "${lock_dir}"
    lock_held=0
  fi
}

acquire_lock() {
  while ! mkdir "${lock_dir}" 2>/dev/null; do
    sleep 0.1
  done
  lock_held=1
}

cleanup() {
  if [[ -n "${tmp_dir}" && -d "${tmp_dir}" ]]; then
    rm -rf "${tmp_dir}"
  fi

  if [[ -n "${backup_dir}" && -d "${backup_dir}" && ! -e "${agent_dir}" ]]; then
    mv "${backup_dir}" "${agent_dir}"
    backup_dir=""
  fi

  release_lock
}

trap cleanup EXIT

mkdir -p "${agent_parent_dir}"
tmp_dir="$(mktemp -d "${agent_parent_dir}/skills.tmp.XXXXXX")"

if [[ ! -f "${skill_manifest_path}" ]]; then
  echo "Missing skill mirror allowlist: ${skill_manifest_path}" >&2
  exit 1
fi

while IFS= read -r raw_line || [[ -n "${raw_line}" ]]; do
  line="${raw_line#"${raw_line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"

  if [[ -z "${line}" || "${line}" == \#* ]]; then
    continue
  fi

  if [[ ! "${line}" =~ ^(superpowers|global):([a-z0-9][a-z0-9-]*)$ ]]; then
    echo "Invalid skill mirror entry '${line}' in ${skill_manifest_path}" >&2
    exit 1
  fi

  copy_global_skill "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
done < "${skill_manifest_path}"

# Repo-local skills are the source of truth for Lineup-specific guidance, so
# they are applied last and win on name conflicts.
if [[ -d "${codex_repo_skills}" ]]; then
  rsync -a "${codex_repo_skills}/" "${tmp_dir}/"
fi

acquire_lock

if [[ -e "${agent_dir}" ]]; then
  backup_dir="${agent_parent_dir}/skills.backup.$$"
  mv "${agent_dir}" "${backup_dir}"
fi

mv "${tmp_dir}" "${agent_dir}"
tmp_dir=""
release_lock

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
