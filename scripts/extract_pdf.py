#!/usr/bin/env python3
"""PDF からテキスト（layout / plain の 2 種類）と、必要ならページ画像を取り出す。

使い方:
  .venv/bin/python -I scripts/extract_pdf.py raw/2026r08_qs.pdf work/text --images --scale 2

出力:
  <out_dir>/<stem>.layout.txt   位置関係を保った抽出（問番号・選択肢の判定に使う）
  <out_dir>/<stem>.plain.txt    通常の抽出（本文の読み取りに使う）
  <out_dir>/<stem>_pages/pNNN.png  --images 指定時のページ画像（図表の切り出し用）
ページ区切りは "<<<PAGE n>>>" の行。
"""
import argparse
import pathlib

from pypdf import PdfReader


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("out_dir")
    ap.add_argument("--images", action="store_true", help="ページ画像も出力する")
    ap.add_argument("--scale", type=float, default=2.0, help="画像の拡大率（72dpi 基準）")
    args = ap.parse_args()

    pdf = pathlib.Path(args.pdf)
    out = pathlib.Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(pdf))
    stem = pdf.stem

    for mode in ("layout", "plain"):
        parts = []
        for i, page in enumerate(reader.pages, 1):
            try:
                if mode == "layout":
                    text = page.extract_text(extraction_mode="layout")
                else:
                    text = page.extract_text()
            except Exception as exc:  # noqa: BLE001
                text = f"<<extract error: {exc}>>"
            parts.append(f"\n<<<PAGE {i}>>>\n{text or ''}")
        (out / f"{stem}.{mode}.txt").write_text("".join(parts), encoding="utf-8")
    print(f"{stem}: {len(reader.pages)} pages -> {out}")

    if args.images:
        import pypdfium2 as pdfium

        doc = pdfium.PdfDocument(str(pdf))
        img_dir = out / f"{stem}_pages"
        img_dir.mkdir(exist_ok=True)
        for i in range(len(doc)):
            bitmap = doc[i].render(scale=args.scale)
            bitmap.to_pil().save(img_dir / f"p{i + 1:03d}.png")
        print(f"  images -> {img_dir} ({len(doc)} pages)")


if __name__ == "__main__":
    main()
