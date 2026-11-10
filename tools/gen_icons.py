"""生成 PWA 所需尺寸的 PNG 图标（紫色渐变 + 观字）"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
FONT_PATH = 'C:/Windows/Fonts/msyh.ttc'


def gradient_bg(size, color1, color2):
    img = Image.new('RGB', (size, size))
    draw = ImageDraw.Draw(img)
    r1, g1, b1 = color1
    r2, g2, b2 = color2
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(r1 + (r2 - r1) * t)
        g = int(g1 + (g2 - g1) * t)
        b = int(b1 + (b2 - b1) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    return img


def make_icon(size, out_name, text='观'):
    img = gradient_bg(size, (76, 29, 149), (124, 58, 237))
    draw = ImageDraw.Draw(img)
    font_size = int(size * 0.52)
    font = ImageFont.truetype(FONT_PATH, font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1]
    draw.text((x, y), text, fill=(255, 255, 255), font=font)
    out = os.path.join(OUT_DIR, out_name)
    img.save(out)
    print(f'[OK] {out_name}  {size}x{size}')


if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    make_icon(192, 'icon-192.png')
    make_icon(512, 'icon-512.png')
    make_icon(180, 'apple-touch-icon.png')
    print('图标生成完成')
