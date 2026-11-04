import os
import subprocess
from PIL import Image

def generate():
    chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    if not os.path.exists(chrome):
        # Fallback check
        for path in [
            r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
            r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
            r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
        ]:
            if os.path.exists(path):
                chrome = path
                break

    svg_path = os.path.abspath('assets/logo.svg').replace('\\', '/')
    tmp_dir = os.path.abspath('target/tmp')
    os.makedirs(tmp_dir, exist_ok=True)

    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{
    width: 512px;
    height: 512px;
    background: transparent;
    overflow: hidden;
  }}
  img {{
    width: 512px;
    height: 512px;
    display: block;
  }}
</style>
</head>
<body>
<img src="file:///{svg_path}" />
</body>
</html>"""

    preview_html = os.path.join(tmp_dir, 'render.html')
    with open(preview_html, 'w', encoding='utf-8') as f:
        f.write(html_content)

    master_png = os.path.join(tmp_dir, 'master-512.png')
    cmd = [
        chrome,
        '--headless=new',
        f'--screenshot={master_png}',
        '--window-size=512,512',
        '--default-background-color=00000000',
        '--hide-scrollbars',
        preview_html
    ]
    subprocess.run(cmd, check=True)

    master_im = Image.open(master_png)
    print(f"Rendered master image: {master_im.size}")

    # Output targets:
    targets = [
        ('extension/icons/icon-16.png', 16),
        ('extension/icons/icon-48.png', 48),
        ('extension/icons/icon-128.png', 128),
        ('docs/apple-touch-icon.png', 180),
        ('docs/logo-400.png', 400),
    ]

    for path, size in targets:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        resized = master_im.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(path, format='PNG')
        print(f"Generated {path} ({size}x{size})")

    # Generate multi-size favicon.ico
    favicon_path = 'docs/favicon.ico'
    master_im.save(favicon_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"Generated {favicon_path}")

if __name__ == '__main__':
    generate()
