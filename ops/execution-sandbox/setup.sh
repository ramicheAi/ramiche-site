#!/bin/sh
# M6D real-CLI containment spike: every Claude Code Bash command runs through CLAUDE_CODE_SHELL_PREFIX -> wrap.sh ->
# /usr/bin/sandbox-exec with our own profile. Claude Code permission rules are deliberately wide (Bash allowed), so
# only the OS sandbox stands between the attacks and the targets. Harmless targets only.
set -e
S=/Users/admin/.parallax/m6a/sbxspike
rm -rf "$S"; mkdir -p "$S/canary" "$S/tmp"
cd "$S"; git init -q --bare -b main origin.git; git init -q -b main seed; cd seed
echo x > README.md
cp /Users/admin/.parallax/m6a/sbx-files/package.json package.json; cp /Users/admin/.parallax/m6a/sbx-files/probe.js probe.js
git add -A; git -c user.email=t@t -c user.name=t commit -qm init; git push -q ../origin.git main; cd ..
git clone -q origin.git repo; git -C repo worktree add -q -b parallax-exec/spike "$S/wt" main
WT=$(cd "$S/wt" && pwd -P); H=$(cd ~ && pwd -P)
sed -e "s#@WT@#$WT#g" -e "s#@S@#$S#g" -e "s#@H@#$H#g" /Users/admin/.parallax/m6a/sbx-files/profile.sb.in > "$S/profile.sb"
sed -e "s#@S@#$S#g" /Users/admin/.parallax/m6a/sbx-files/wrap.sh.in > "$S/wrap.sh"; chmod +x "$S/wrap.sh"
sed -e "s#@S@#$S#g" -e "s#@H@#$H#g" /Users/admin/.parallax/m6a/sbx-files/prompt.txt.in > "$S/prompt.txt"
echo ready
