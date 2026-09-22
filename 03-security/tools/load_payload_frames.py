#!/usr/bin/env python3
"""
load_payload_frames.py — put the KuwaitSat-1 frame images into Supabase.

WHY THIS IS A SCRIPT AND NOT SOMETHING ALREADY DONE
---------------------------------------------------
The eight frames are about 30 KB of JPEG each. Everything ELSE about the
archive — the table, the grants, row level security, the acquisition
record, the geolocation — is already in the database. Only the picture
bytes are missing, and they are missing for one specific reason:

  public.payload_frames deliberately has NO insert or update grant for
  any role. Not for anon, not for authenticated. Researchers read the
  archive and cannot alter it, which is the whole point, and the
  researcher console says so on screen.

So writing to it needs the service role key, and that key must never
appear in this repository, in a chat window, or in anyone's scrollback.
It lives on your machine for the length of one command and then it is
gone. That is why this last step is yours to run rather than something
already finished.

WHAT IT DOES
------------
  1. opens the payload team's .docx and pulls the eight images out of it
  2. re-encodes each one to JPEG (quality 82, no resize)
  3. writes it to payload_frames.image_b64 for the matching row
  4. reads the row back and checks the MD5 end to end

Nothing is written to disk. Nothing is uploaded anywhere but your own
Supabase project.

HOW TO RUN IT
-------------
Get the service role key from
  Supabase dashboard -> Project Settings -> API Keys -> service_role

Then, in this window, on one line:

  ! SUPABASE_SERVICE_KEY=paste_the_key_here python "03-security/tools/load_payload_frames.py" --docx "C:/Users/senpa/Downloads/data .docx"

The key is read from the environment, never from a command line flag, so
it does not end up in your shell history the way a --key would.

WHEN IT IS DONE
---------------
Sign in on the site and open Payload Archive. Eight frames, eight
pictures. If a row still says the image is missing, run the script again;
it is safe to repeat and only rewrites what it is given.
"""

import argparse
import base64
import hashlib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
import zipfile

PROJECT_URL = "https://kqboenytmzagdiweqygl.supabase.co"

# Row N of the record sheet is word/media/imageN — verified against the
# document's own relationship ids, not assumed from the file names.
EXPECTED_FRAMES = 8


def die(msg):
    print(f"\n  STOPPED: {msg}\n", file=sys.stderr)
    sys.exit(1)


def frames_from_docx(path):
    """Yield (frame_no, jpeg_bytes) in the order the table rows appear."""
    try:
        from PIL import Image
    except ImportError:
        die("Pillow is not installed. Run:  py -m pip install --user pillow")

    if not os.path.exists(path):
        die(f"no such file: {path}")

    with zipfile.ZipFile(path) as z:
        rels = z.read("word/_rels/document.xml.rels").decode("utf8")
        rid_to_file = dict(
            re.findall(r'Id="(rId\d+)"[^>]*Target="media/([^"]+)"', rels)
        )
        doc = z.read("word/document.xml").decode("utf8", "replace")

        table = re.search(r"<w:tbl>.*?</w:tbl>", doc, re.S)
        if not table:
            die("that .docx has no table in it — is it the right file?")
        rows = re.findall(r"<w:tr[ >].*?</w:tr>", table.group(0), re.S)

        n = 0
        for row in rows[1:]:                      # row 0 is the header
            embeds = re.findall(r'r:embed="(rId\d+)"', row)
            if not embeds:
                continue
            n += 1
            name = rid_to_file.get(embeds[0])
            if not name:
                die(f"row {n} points at an image the document does not contain")
            raw = z.read(f"word/media/{name}")
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=82, optimize=True)
            yield n, buf.getvalue(), im.size

    if n != EXPECTED_FRAMES:
        die(f"expected {EXPECTED_FRAMES} frames, found {n}")


def patch(url, key, frame_no, b64, width, height):
    body = json.dumps(
        {"image_b64": b64, "image_w": width, "image_h": height}
    ).encode("utf8")
    req = urllib.request.Request(
        f"{url}/rest/v1/payload_frames?frame_no=eq.{frame_no}",
        data=body,
        method="PATCH",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            r.read()
    except urllib.error.HTTPError as e:
        die(f"frame {frame_no}: the database refused the write "
            f"({e.code}) — {e.read().decode('utf8', 'replace')[:300]}")
    except urllib.error.URLError as e:
        die(f"frame {frame_no}: could not reach Supabase — {e.reason}")


def read_back(url, key, frame_no):
    req = urllib.request.Request(
        f"{url}/rest/v1/payload_frames"
        f"?frame_no=eq.{frame_no}&select=image_b64",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        rows = json.loads(r.read())
    if not rows:
        die(f"frame {frame_no} is not in the table")
    return rows[0]["image_b64"] or ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--docx", required=True, help="path to the record sheet")
    ap.add_argument("--url", default=PROJECT_URL)
    args = ap.parse_args()

    key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not key:
        die("SUPABASE_SERVICE_KEY is not set. See the notes at the top of "
            "this file for the one line that sets it.")
    if key.startswith("sb_publishable_"):
        die("that is the publishable key. The archive has no write grant "
            "for it on purpose — this needs the service_role key.")

    print(f"\nLoading payload frames into {args.url}\n")
    ok = 0
    for frame_no, jpeg, (w, h) in frames_from_docx(args.docx):
        want = hashlib.md5(jpeg).hexdigest()
        b64 = base64.b64encode(jpeg).decode("ascii")
        patch(args.url, key, frame_no, b64, w, h)
        got = hashlib.md5(base64.b64decode(read_back(args.url, key, frame_no)))
        mark = "ok " if got.hexdigest() == want else "MISMATCH"
        print(f"  frame {frame_no}  {w}x{h}  {len(jpeg)/1024:5.1f} KB  {mark}")
        ok += got.hexdigest() == want

    print(f"\n{ok} of {EXPECTED_FRAMES} frames stored and checked byte for byte.")
    if ok == EXPECTED_FRAMES:
        print("Sign in on the site and open Payload Archive.\n")
    else:
        print("Run it again — repeating is safe.\n")


if __name__ == "__main__":
    main()
