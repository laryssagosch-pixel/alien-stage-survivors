"""Recorta os sprites das folhas de personagem (screenshots) e remove o fundo lilás.
Uso: python tools/extract_sprites.py <pasta_com_as_folhas>   (só necessário se quiser regenerar)"""
import sys, pathlib, numpy as np
from PIL import Image
from scipy import ndimage as nd

SHEETS = {  # arquivo -> nome
    "Captura_de_tela_2026-10-28_194333.png": "sua", "Captura_de_tela_2026-10-28_194345.png": "mizi",
    "Captura_de_tela_2026-10-28_194413.png": "ivan", "Captura_de_tela_2026-10-28_194449.png": "hyuna",
    "Captura_de_tela_2026-10-28_194359.png": "luka", "Captura_de_tela_2026-10-28_194340.png": "till"}
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "chars"
H = 96
MANUAL = {  # (caixas dos sprites, caixa do retrato)
    "ivan": ([(35,50,170,262),(185,50,335,262),(30,282,175,490),(185,282,335,490),(355,282,505,490)], (343,62,503,224)),
    "luka": ([(4,22,80,113),(80,20,150,112),(4,124,78,216),(78,124,150,216),(158,122,228,208)], (150,30,222,102)),
    "till": ([(4,8,80,111),(80,10,156,111),(156,10,228,111),(10,116,78,213),(78,114,154,213),(160,116,228,213)], None),
}

def process(path, name):
    im = Image.open(path).convert("RGB"); a = np.array(im).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    q = (a // 8).reshape(-1, 3); vals, cnt = np.unique(q, axis=0, return_counts=True); bgc = vals[cnt.argmax()] * 8 + 4
    dist = np.sqrt(((a - bgc) ** 2).sum(-1)); lav = (b - g > 35) & (b > r) & (r + g + b > 450)
    if name in MANUAL:  # caixas feitas à mão + flood fill do fundo a partir das bordas
        d = OUT / name; d.mkdir(parents=True, exist_ok=True); boxes, pbox = MANUAL[name]
        for k, (x0, y0, x1, y1) in enumerate(boxes):
            c = a[y0:y1, x0:x1]; bgm = dist[y0:y1, x0:x1] < 55
            if name in ("luka", "till"):
                cl = (g > 195) & (b > 195) & (r < 200) & (g - r > 20); cl[:198] = False; bgm = bgm | cl[y0:y1, x0:x1]
            lab, _ = nd.label(bgm); edge = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1]); edge.discard(0)
            bgm = np.isin(lab, list(edge)); m = ~bgm
            l2, _ = nd.label(m); m = l2 == (np.bincount(l2.ravel())[1:].argmax() + 1); m = nd.binary_fill_holes(m)
            sp = Image.fromarray(np.dstack([c, m * 255]).astype("uint8"), "RGBA"); sp = sp.crop(sp.getbbox())
            w = max(1, round(sp.width * H / sp.height)); sp.resize((w, H), Image.NEAREST if sp.height < H else Image.BOX).save(d / f"{k}.png")
        if pbox: im.crop(pbox).resize((96, 96), Image.LANCZOS).save(d / "portrait.png")
        return len(boxes), bool(pbox)
    cloud = (g > 200) & (b > 200) & (r < 185) & (g - r > 25)
    fg = ~(lav | cloud)
    lab, n = nd.label(nd.binary_dilation(fg, iterations=2))
    sprites, portrait = [], None
    for i, sl in enumerate(nd.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h < im.height * .10 or w < im.width * .08: continue
        fill = (lab[sl] == i).mean()
        box = (sl[1].start, sl[0].start, sl[1].stop, sl[0].stop)
        if fill > .9 and .8 < w / h < 1.25: portrait = box; continue
        if sl[0].start > im.height * .9 or h > im.height * .5: continue
        sprites.append(box)
    mid = im.height * .5
    top = sorted([s for s in sprites if s[1] < mid - 20 and s[3] < mid + 40], key=lambda s: s[0])
    bot = sorted([s for s in sprites if s not in top], key=lambda s: s[0])
    d = OUT / name; d.mkdir(parents=True, exist_ok=True)
    for k, (x0, y0, x1, y1) in enumerate(top + bot):
        crop = a[y0:y1, x0:x1]; m = ~(lav | cloud)[y0:y1, x0:x1]
        m = nd.binary_fill_holes(nd.binary_opening(m, iterations=1) | m)
        lbl, _ = nd.label(m); 
        if lbl.max(): m = lbl == (np.bincount(lbl.ravel())[1:].argmax() + 1)
        rgba = np.dstack([crop, (m * 255)]).astype("uint8"); sp = Image.fromarray(rgba, "RGBA")
        bb = sp.getbbox(); sp = sp.crop(bb); w = max(1, round(sp.width * H / sp.height))
        sp.resize((w, H), Image.NEAREST if sp.height < H else Image.BOX).save(d / f"{k}.png")
    if portrait: im.crop(portrait).resize((96, 96), Image.LANCZOS).save(d / "portrait.png")
    return len(top + bot), bool(portrait)

if __name__ == "__main__":
    src = pathlib.Path(sys.argv[1])
    for f, n in SHEETS.items(): print(n, process(src / f, n))
