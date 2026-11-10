"""给所有 HTML 添加 iOS PWA 适配标签"""
import os
import re

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FILES = ['index.html', 'auth.html', 'bazi.html', 'tarot.html', 'dream.html',
         'zodiac.html', 'history.html', 'settings.html', 'admin.html']

IOS_TAGS = ('<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
            '  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">')

for name in FILES:
    path = os.path.join(BASE, name)
    if not os.path.exists(path):
        print(f'跳过（不存在）: {name}')
        continue
    with open(path, encoding='utf-8') as f:
        content = f.read()
    if 'apple-mobile-web-app-capable' in content:
        print(f'跳过（已存在）: {name}')
        continue
    new_content, n = re.subn(
        r'(<meta name="theme-color"[^>]*>)',
        lambda m: m.group(1) + '\n  ' + IOS_TAGS,
        content, count=1
    )
    if n == 0:
        new_content, n = re.subn(r'(<head>)', lambda m: m.group(1) + '\n  ' + IOS_TAGS, content, count=1)
    if n > 0:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'[OK] {name}')
    else:
        print(f'✗ 未找到插入位置: {name}')
