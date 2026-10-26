#!/usr/bin/env python3
"""抽出済みテキスト（plain）から問題と解答例を構造化して content-src/questions/<setId>.json を作る。

使い方:
  .venv/bin/python -I scripts/parse_questions.py 2026r08 \
      --qs work/text/2026r08_qs.plain.txt --ans work/text/2026r08_ans.plain.txt \
      --year 令和8年度 --session 公開問題 --url https://... --b-from 13

出力は「下書き」。stem / choices は機械的に結合したもので、改行位置・表・図は人（Claude）が
ページ画像を見ながら直す前提（parse.status = "auto"）。既存ファイルがある場合、
explanation / tags / flags / stemHtml / case.html / figures など人手で入れた値は引き継ぐ。
"""
import argparse
import json
import pathlib
import re
import unicodedata

LABELS = "アイウエオカキクケコ"
HEADING_RE = re.compile(r"^\s*問\s*([0-9０-９]+)\s*(.*)$")
PAGE_RE = re.compile(r"^<<<PAGE (\d+)>>>$")
FOOTER_RE = re.compile(r"^\s*(－\s*\d+\s*－|-\s*\d+\s*-|©.*情報処理推進機構.*|〔\s*メ\s*モ\s*用\s*紙\s*〕)\s*$")
CHOICE_LINE_RE = re.compile(r"^\s*([アイウエオカキクケコ])(?:\s+(.*))?\s*$")
INLINE_SPLIT_RE = re.compile(r"(?:^|\s+)([アイウエオカキクケコ])\s+")
FIGURE_RE = re.compile(r"(次の図|図\s*[0-9０-９]|図のよう|図に示|図中)")
TABLE_RE = re.compile(r"(次の表|表\s*[0-9０-９]|表のとおり|表に示|表中)")


def z2h(s: str) -> str:
    return unicodedata.normalize("NFKC", s)


def join_lines(lines):
    """PDF の行を段落に結合する。日本語同士は詰め、英数字同士は空白 1 つで繋ぐ。
    先頭が全角スペース・箇条書き・注記の行は段落の始まりとして改行を残す。"""
    out = []
    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            if out and not out[-1].endswith("\n"):
                out[-1] = out[-1] + "\n"
            continue
        starts_para = bool(re.match(r"^(　|　|・|注\s*[0-9０-９]*\)|\(|（|〔|【|[0-9０-９]+[\.．]\s)", line))
        stripped = line.strip()
        if not out or out[-1].endswith("\n") or starts_para:
            out.append(stripped + ("\n" if starts_para and out and not out[-1].endswith("\n") and False else ""))
            if starts_para and len(out) >= 2 and not out[-2].endswith("\n"):
                out[-2] = out[-2] + "\n"
            continue
        prev = out[-1]
        if re.search(r"[A-Za-z0-9,.)]$", prev) and re.match(r"^[A-Za-z0-9(]", stripped):
            out[-1] = prev + " " + stripped
        else:
            out[-1] = prev + stripped
    text = "".join(p if p.endswith("\n") else p + "\n" for p in out)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_choices(lines):
    """選択肢行のリスト → [{key, text}]。1 行に複数の選択肢（ア 10.0 イ 10.16）も分割する。"""
    choices = []
    cur = None
    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            continue
        m = CHOICE_LINE_RE.match(line)
        if m:
            body = m.group(2) or ""
            # 同一行に次のラベルが続く場合（ア xxx イ yyy）
            segs = []
            key = m.group(1)
            pos = 0
            for im in INLINE_SPLIT_RE.finditer(body):
                nxt = im.group(1)
                expected = LABELS[LABELS.index(key) + 1] if LABELS.index(key) + 1 < len(LABELS) else None
                if nxt == expected:
                    segs.append((key, body[pos:im.start()].strip()))
                    key = nxt
                    pos = im.end()
            segs.append((key, body[pos:].strip()))
            for k, t in segs:
                cur = {"key": k, "lines": [t]}
                choices.append(cur)
        elif cur is not None:
            cur["lines"].append(line.strip())
    result = []
    for c in choices:
        result.append({"key": c["key"], "text": join_lines(c["lines"]).replace("\n", "")})
    return result


def parse_answers(path: pathlib.Path):
    text = path.read_text(encoding="utf-8")
    ans = {}
    for m in re.finditer(r"問\s*([0-9０-９]+)\s+([アイウエオカキクケコ])", text):
        ans[int(z2h(m.group(1)))] = m.group(2)
    return ans


def parse_questions(path: pathlib.Path):
    """テキスト → [{no, heading_rest, lines:[(page, line)], page_start, page_end}]"""
    blocks = []
    page = 0
    cur = None
    for raw in path.read_text(encoding="utf-8").splitlines():
        pm = PAGE_RE.match(raw)
        if pm:
            page = int(pm.group(1))
            continue
        if FOOTER_RE.match(raw):
            continue
        hm = HEADING_RE.match(raw)
        if hm:
            no = int(z2h(hm.group(1)))
            # 「問1」が本文中に出る誤検出を避ける: 連番で増えるときだけ新ブロック
            if cur is None or no == cur["no"] + 1:
                cur = {"no": no, "lines": [], "page_start": page, "page_end": page}
                blocks.append(cur)
                rest = hm.group(2).strip()
                if rest:
                    cur["lines"].append(rest)
                continue
        if cur is not None:
            cur["lines"].append(raw)
            cur["page_end"] = page
    return blocks


def structure_block(block, kind):
    lines = block["lines"]
    # 選択肢の開始行を探す（科目B は「解答群」の次行から）
    start = None
    if kind == "B":
        for i, l in enumerate(lines):
            if re.match(r"^\s*解答群\s*$", l):
                start = i + 1
                break
    if start is None:
        # 行頭ラベルが ア から順に並ぶ最初の位置
        for i, l in enumerate(lines):
            m = CHOICE_LINE_RE.match(l)
            if m and m.group(1) == "ア":
                # 直後の数行に イ があるか
                window = "\n".join(lines[i : i + 12])
                if re.search(r"(^|\n|\s)イ\s", window):
                    start = i
                    break
    notes = []
    if start is None:
        notes.append("選択肢が見つからない")
        body, choice_lines = lines, []
    else:
        body, choice_lines = lines[:start], lines[start:]
    # 末尾の空行・「解答群」行を除く
    body = [l for l in body if not re.match(r"^\s*解答群\s*$", l)]
    choices = split_choices(choice_lines)

    q = {}
    if kind == "B":
        # 設問: 「設問」で始まる行、無ければ本文末尾の段落（「どれか。」「選べ。」で終わる）
        idx = None
        for i in range(len(body) - 1, -1, -1):
            if re.match(r"^\s*設問", body[i]):
                idx = i
                break
        if idx is None:
            joined = join_lines(body)
            paras = joined.split("\n")
            stem_paras = []
            while paras and (not stem_paras or not re.search(r"(どれか。|選べ。|選べ|答えよ。)$", stem_paras[0])):
                stem_paras.insert(0, paras.pop())
                if len(stem_paras) > 4:
                    break
            q["case"] = {"text": "\n".join(paras).strip(), "html": None}
            q["stem"] = "\n".join(stem_paras).strip()
            notes.append("設問の区切りは推定")
        else:
            q["case"] = {"text": join_lines(body[:idx]), "html": None}
            q["stem"] = join_lines(body[idx:])
    else:
        q["case"] = None
        q["stem"] = join_lines(body)
    q["choices"] = choices
    full = "\n".join(lines)
    q["needsFigure"] = bool(FIGURE_RE.search(full))
    q["hasTable"] = bool(TABLE_RE.search(full))
    if kind == "A" and len(choices) != 4:
        notes.append(f"選択肢が{len(choices)}個")
    if kind == "B" and not (4 <= len(choices) <= 8):
        notes.append(f"選択肢が{len(choices)}個")
    q["notes"] = notes
    return q


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("set_id")
    ap.add_argument("--qs", required=True)
    ap.add_argument("--ans", required=True)
    ap.add_argument("--year", required=True, help="例: 令和8年度 / サンプル問題")
    ap.add_argument("--session", required=True, help="例: 公開問題 / （2022年12月公開）")
    ap.add_argument("--part", default="科目A・B")
    ap.add_argument("--url", required=True)
    ap.add_argument("--b-from", type=int, default=10**9, help="この問番号以降を科目B とみなす")
    ap.add_argument("--out", default="content-src/questions")
    args = ap.parse_args()

    answers = parse_answers(pathlib.Path(args.ans))
    blocks = parse_questions(pathlib.Path(args.qs))
    out_path = pathlib.Path(args.out) / f"{args.set_id}.json"
    prev = {}
    if out_path.exists():
        for q in json.loads(out_path.read_text(encoding="utf-8"))["questions"]:
            prev[q["id"]] = q

    questions = []
    for b in blocks:
        kind = "B" if b["no"] >= args.b_from else "A"
        s = structure_block(b, kind)
        qid = f"{args.set_id}-{kind.lower()}-{b['no']:02d}"
        citation = f"情報セキュリティマネジメント試験 {args.year}{args.session} 問{b['no']}"
        ans = answers.get(b["no"])
        if ans is None:
            s["notes"].append("解答例なし")
        q = {
            "id": qid,
            "exam": "SG",
            "kind": kind,
            "source": {
                "setId": args.set_id, "year": args.year, "session": args.session, "part": args.part,
                "no": b["no"], "citation": citation, "url": args.url, "modified": False, "modifiedNote": "",
            },
            "pages": [b["page_start"], b["page_end"]],
            "stem": s["stem"],
            "stemHtml": None,
            "case": s["case"],
            "choices": s["choices"],
            "answer": [ans] if ans else [],
            "figures": [],
            "needsFigure": s["needsFigure"],
            "figureNote": "",
            "hasTable": s["hasTable"],
            "tags": {"sub": None, "item": None, "skill": None, "field": None},
            "explanation": {"md": "", "author": "claude", "reviewed": False},
            "flags": {"outdated": False, "note": ""},
            "difficulty": None,
            "parse": {"status": "auto", "notes": s["notes"]},
        }
        old = prev.get(qid)
        if old and old.get("parse", {}).get("status") == "reviewed":
            # 人手で整えた項目は引き継ぐ
            for k in ("stem", "stemHtml", "case", "choices", "figures", "tags", "explanation", "flags", "difficulty", "parse", "needsFigure", "hasTable"):
                q[k] = old.get(k, q[k])
        questions.append(q)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    data = {"setId": args.set_id, "source": {"year": args.year, "session": args.session, "url": args.url}, "questions": questions}
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n_a = sum(1 for q in questions if q["kind"] == "A")
    n_b = len(questions) - n_a
    issues = [(q["id"], q["parse"]["notes"]) for q in questions if q["parse"]["notes"]]
    figs = [q["id"] for q in questions if q["needsFigure"]]
    tabs = [q["id"] for q in questions if q["hasTable"]]
    print(f"{args.set_id}: {len(questions)} 問 (A {n_a} / B {n_b}) -> {out_path}")
    print(f"  図あり候補: {len(figs)} {figs}")
    print(f"  表あり候補: {len(tabs)} {tabs}")
    for qid, notes in issues:
        print(f"  ! {qid}: {', '.join(notes)}")


if __name__ == "__main__":
    main()
