import urllib.request, re

html = urllib.request.urlopen(urllib.request.Request('https://hpo.jax.org/', headers={'User-Agent': 'Mozilla/5.0'})).read().decode('utf-8')
matches = re.findall(r'href=["\']([^"\']+)["\']', html)
for m in matches:
    print(m)
