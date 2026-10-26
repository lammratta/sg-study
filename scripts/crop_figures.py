#!/usr/bin/env python3
"""content-src/figures.json の指定に従い、ページ画像から図を切り出して content-src/figures/*.webp を作り、
該当する問題 JSON の figures / needsFigure を更新する。

figures.json の形式:
[
  {
    "id": "2026r08-a-11",                       # 問題 id
    "pagesDir": "work/text/2026r08_qs_pages",   # ページ画像のフォルダ
    "page": 6,                                   # ページ番号（pNNN.png の NNN）
    "box": [0.08, 0.22, 0.92, 0.52],             # [left, top, right, bottom] をページ幅・高さに対する割合 0〜1 で指定
    "alt": "ビッグデータの収集から活用までのフロー図",
    "position": "stem"                           # stem（問題文の後）/ case（本文の後）
  }
]

使い方: .venv/bin/python -I scripts/crop_figures.py [--only 2026r08-a-11]
"""
import argparse
import json
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPEC = ROOT / "content-src" / "figures.json"
OUT = ROOT / "content-src" / "figures"
QDIR = ROOT / "content-src" / "questions"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="この id だけ処理する")
    ap.add_argument("--max-width", type=int, default=1200)
    args = ap.parse_args()

    specs = json.loads(SPEC.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    # id -> (file, question) の索引
    index = {}
    for f in sorted(QDIR.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        for q in data["questions"]:
            index[q["id"]] = (f, data, q)

    touched = set()
    for spec in specs:
        if args.only and spec["id"] != args.only:
            continue
        src = ROOT / spec["pagesDir"] / f"p{spec['page']:03d}.png"
        img = Image.open(src)
        w, h = img.size
        l, t, r, b = spec["box"]
        crop = img.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
        if crop.width > args.max_width:
            ratio = args.max_width / crop.width
            crop = crop.resize((args.max_width, int(crop.height * ratio)), Image.LANCZOS)
        name = spec.get("src") or f"{spec['id']}.webp"
        crop.save(OUT / name, "WEBP", quality=85)
        print(f"{spec['id']}: {src.name} {crop.size} -> content-src/figures/{name}")
        if spec["id"] not in index:
            print(f"  ! 問題 {spec['id']} が見つからない")
            continue
        f, data, q = index[spec["id"]]
        figs = [x for x in q.get("figures", []) if x.get("src") != name]
        figs.append({"src": name, "alt": spec.get("alt", ""), "position": spec.get("position", "stem")})
        q["figures"] = figs
        q["needsFigure"] = False
        touched.add(f)
    for f in touched:
        data = json.loads(f.read_text(encoding="utf-8"))
        # 同じファイルを再読込して該当問題だけ差し替える（他のフィールドは保持）
        for q in data["questions"]:
            if q["id"] in index and index[q["id"]][0] == f:
                q["figures"] = index[q["id"]][2]["figures"]
                q["needsFigure"] = index[q["id"]][2]["needsFigure"]
        f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"updated {f.name}")


if __name__ == "__main__":
    main()
