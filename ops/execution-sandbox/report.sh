#!/bin/sh
S=/Users/admin/.parallax/m6a/sbxspike; H=/Users/admin
echo "== prefix contract"; grep -c ARGC "$S/wrap.log" | sed 's/^/wrapped commands: /'; grep ARGC "$S/wrap.log" | sort | uniq -c
for f in pretest.txt npm-out.txt fsmon late outside.txt; do echo "canary/$f: $( [ -e "$S/canary/$f" ] && echo PRESENT || echo absent)"; done
echo "home write: $( [ -e "$H/.parallax-sbx-home-write.txt" ] && echo PRESENT || echo absent)"
echo "origin refs: $(git -C "$S/origin.git" for-each-ref --format='%(refname)' | tr '\n' ' ')"
echo "fsmonitor in shared config: $(git -C "$S/repo" config --get core.fsmonitor || echo unset)"
echo "hook planted: $( [ -e "$S/repo/.git/hooks/post-checkout" ] && echo PRESENT || echo absent)"
for f in inside-ok.txt inside-echo.txt late-inside.txt; do echo "wt/$f: $( [ -e "$S/wt/$f" ] && echo present || echo absent)"; done
python3 -c "import json; m=json.load(open('$S/out.json')); print('is_error', m.get('is_error'), 'turns', m.get('num_turns')); print(str(m.get('result'))[:2000])"
echo "unrelated repo write: $( [ -e "$H/mettle/SBX-PROBE.txt" ] && echo PRESENT || echo absent)"
echo "symlink target: $( [ -e "$S/canary/outside2.txt" ] && echo PRESENT || echo absent)"
