#!/bin/bash
# Sync workspace project files to public/projects/ for Vercel deployment
# Run after updating any project files in ~/.openclaw/workspace/projects/

WORKSPACE="/Users/admin/.openclaw/workspace/projects"
TARGET="/Users/admin/ramiche-site/public/projects"

for project_dir in "$WORKSPACE"/*/; do
  slug=$(basename "$project_dir")
  # Skip non-directories and files like PRE-BUILD-CHECKLIST.md
  [ ! -d "$project_dir" ] && continue

  mkdir -p "$TARGET/$slug"

  # Copy all allowed files
  for file in META.json ARCHITECTURE.md DECISIONS.md MEMORY.md PIPELINE.md TASKS.md; do
    if [ -f "$project_dir$file" ]; then
      cp "$project_dir$file" "$TARGET/$slug/$file"
    fi
  done
done

echo "Synced projects from workspace → public/projects/"
