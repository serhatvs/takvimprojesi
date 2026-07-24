#!/usr/bin/env bash
# Builds an image and inspects every layer's filesystem diff for anything
# that looks like a leaked .env file or a tracked .git directory. This is a
# real (not just textual) check: it exports each layer with `docker save`
# and greps the actual tar contents, so it also catches a secret that was
# copied in one layer and deleted in a later one (still present in image
# history).
#
# Usage: scripts/docker/verify-no-secrets-in-image.sh <image-tag>
# Requires: Docker.

set -euo pipefail

image_tag="${1:?Usage: verify-no-secrets-in-image.sh <image-tag>}"
workdir="$(mktemp -d)"
cleanup() {
  rm -rf "$workdir"
}
trap cleanup EXIT

echo "==> Saving image ${image_tag} for layer inspection"
docker save "$image_tag" -o "${workdir}/image.tar"

mkdir -p "${workdir}/extracted"
tar -xf "${workdir}/image.tar" -C "${workdir}/extracted"

echo "==> Scanning every layer for .env files or a .git directory"
found=0
while IFS= read -r -d '' layer_tar; do
  listing="$(tar -tf "$layer_tar" 2>/dev/null || true)"

  # Flag any top-level ".env" (but never ".env.example") and any ".git/" path.
  leaked_env="$(echo "$listing" | grep -E '(^|/)\.env($|/)' | grep -v '\.env\.example' || true)"
  leaked_git="$(echo "$listing" | grep -E '(^|/)\.git/' || true)"

  if [ -n "$leaked_env" ]; then
    echo "FAIL: layer $(basename "$layer_tar") contains .env-like paths:" >&2
    echo "$leaked_env" >&2
    found=1
  fi
  if [ -n "$leaked_git" ]; then
    echo "FAIL: layer $(basename "$layer_tar") contains .git paths:" >&2
    echo "$leaked_git" >&2
    found=1
  fi
done < <(find "${workdir}/extracted" -name '*.tar' -print0)

if [ "$found" -ne 0 ]; then
  echo "FAIL: secrets or .git leaked into ${image_tag} layers" >&2
  exit 1
fi

echo "==> PASS: no .env or .git content found in any layer of ${image_tag}"
