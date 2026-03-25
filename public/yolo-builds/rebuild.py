import os, json, glob, re

os.chdir('/Users/admin/.openclaw/workspace/yolo-builds')

builds = []
dirs = sorted(glob.glob('2026-*'))
for d in dirs:
    if not os.path.isdir(d):
        continue
    match = re.match(r'(\d{4}-\d{2}-\d{2})-(.*)', d)
    if not match:
        continue
    date_str, slug = match.groups()
    name = slug.replace('-', ' ').title()
    desc = ''
    readme = os.path.join(d, 'README.md')
    if os.path.exists(readme):
        with open(readme) as f:
            lines = f.readlines()
            for line in lines:
                line = line.strip()
                if line and not line.startswith('#'):
                    desc = line[:200]
                    break
    files = os.listdir(d)
    html_files = [f for f in files if f.endswith('.html')]
    has_html = len(html_files) > 0
    builds.append({
        'id': slug,
        'name': name,
        'date': date_str,
        'slug': slug,
        'description': desc,
        'files': files,
        'hasDemo': has_html,
        'demoFile': html_files[0] if html_files else None,
        'fileCount': len(files)
    })

with open('builds.json', 'w') as f:
    json.dump(builds, f, indent=2)

print(f'Rebuilt builds.json: {len(builds)} entries')
