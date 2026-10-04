import urllib.request, re

UA = {'User-Agent': 'Mozilla/5.0'}
html = urllib.request.urlopen(urllib.request.Request('https://www.cacna1a.org', headers=UA)).read().decode('utf-8', errors='ignore')
matches = re.findall(r'href=["\'](/[^"\']+|https?://[^"\']+)["\']', html)
for m in matches:
    if any(k in m.lower() for k in ['registry', 'cords', 'research', 'patient']):
        print(m)
