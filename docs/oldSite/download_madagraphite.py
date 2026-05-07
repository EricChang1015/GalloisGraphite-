import argparse
import collections
import hashlib
import os
import re
import sys
import time
from dataclasses import dataclass
from html import unescape
from urllib.parse import urldefrag, urljoin, urlparse

import requests
from bs4 import BeautifulSoup


USER_AGENT = "offline-mirror/1.0 (+https://example.invalid)"


def _safe_relpath(url_path: str) -> str:
    # Normalize and avoid writing outside output dir.
    if not url_path or url_path.endswith("/"):
        url_path = (url_path or "/") + "index.html"
    if url_path.startswith("/"):
        url_path = url_path[1:]
    url_path = re.sub(r"[\\:*?\"<>|]", "_", url_path)
    url_path = url_path.replace("..", "_")
    return url_path


def _hash_suffix(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:10]


@dataclass(frozen=True)
class FetchResult:
    url: str
    final_url: str
    status_code: int
    content_type: str
    content: bytes


def fetch(session: requests.Session, url: str, timeout_s: int) -> FetchResult:
    r = session.get(url, timeout=timeout_s, allow_redirects=True)
    ct = r.headers.get("content-type", "").split(";")[0].strip().lower()
    return FetchResult(
        url=url,
        final_url=r.url,
        status_code=r.status_code,
        content_type=ct,
        content=r.content,
    )


def ensure_parent(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def write_bytes(path: str, data: bytes) -> None:
    ensure_parent(path)
    with open(path, "wb") as f:
        f.write(data)


def is_same_site(url: str, allowed_hosts: set[str]) -> bool:
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        return False
    host = (p.hostname or "").lower()
    if host in allowed_hosts:
        return True
    # allow www variant
    if host.startswith("www.") and host[4:] in allowed_hosts:
        return True
    return False


def guess_ext(content_type: str) -> str:
    return {
        "text/html": ".html",
        "text/css": ".css",
        "application/javascript": ".js",
        "text/javascript": ".js",
        "application/json": ".json",
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "application/pdf": ".pdf",
        "font/woff": ".woff",
        "font/woff2": ".woff2",
    }.get(content_type, "")


def local_path_for(url: str, out_dir: str, primary_host: str) -> str:
    p = urlparse(url)
    path = p.path
    rel = _safe_relpath(path)

    # Keep host separation if multiple (e.g., www).
    host = (p.hostname or primary_host).lower()
    if host != primary_host:
        rel = os.path.join(host, rel)

    # Preserve query by hashing to avoid collisions.
    if p.query:
        base, ext = os.path.splitext(rel)
        if not ext:
            ext = guess_ext("")
        rel = f"{base}__q_{_hash_suffix(p.query)}{ext}"
    return os.path.join(out_dir, rel)


def rel_link(from_file: str, to_file: str) -> str:
    rel = os.path.relpath(to_file, os.path.dirname(from_file))
    return rel.replace("\\", "/")


def extract_links(html: str, base_url: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")

    found: list[tuple[str, str]] = []
    # tag, attribute pairs we want to rewrite + crawl
    for tag, attr in [
        ("a", "href"),
        ("img", "src"),
        ("script", "src"),
        ("link", "href"),
        ("source", "src"),
        ("iframe", "src"),
    ]:
        for el in soup.find_all(tag):
            v = el.get(attr)
            if not v:
                continue
            v = unescape(v).strip()
            if v.startswith("data:") or v.startswith("mailto:") or v.startswith("tel:") or v.startswith("javascript:"):
                continue
            abs_url = urljoin(base_url, v)
            abs_url, _frag = urldefrag(abs_url)
            found.append((v, abs_url))
    return found


def rewrite_html_links(html_bytes: bytes, base_url: str, src_file: str, out_dir: str, primary_host: str) -> tuple[bytes, list[str]]:
    html = html_bytes.decode("utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")
    discovered: list[str] = []

    for tag, attr in [
        ("a", "href"),
        ("img", "src"),
        ("script", "src"),
        ("link", "href"),
        ("source", "src"),
        ("iframe", "src"),
    ]:
        for el in soup.find_all(tag):
            v = el.get(attr)
            if not v:
                continue
            v2 = unescape(v).strip()
            if v2.startswith("data:") or v2.startswith("mailto:") or v2.startswith("tel:") or v2.startswith("javascript:"):
                continue
            abs_url = urljoin(base_url, v2)
            abs_url, _ = urldefrag(abs_url)
            discovered.append(abs_url)
            if not is_same_site(abs_url, {primary_host, f"www.{primary_host}"}):
                continue
            dst_file = local_path_for(abs_url, out_dir, primary_host)
            el[attr] = rel_link(src_file, dst_file)

    out = str(soup).encode("utf-8")
    return out, discovered


def main() -> int:
    ap = argparse.ArgumentParser(description="Mirror madagraphite.com for offline viewing.")
    ap.add_argument("--start", default="http://madagraphite.com/", help="Start URL")
    ap.add_argument("--out", default="madagraphite.com-mirror", help="Output directory")
    ap.add_argument("--max-pages", type=int, default=5000, help="Max HTML pages to crawl")
    ap.add_argument("--timeout", type=int, default=30, help="HTTP timeout seconds")
    ap.add_argument("--delay-ms", type=int, default=200, help="Delay between requests (politeness)")
    args = ap.parse_args()

    start = args.start
    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    start_p = urlparse(start)
    primary_host = (start_p.hostname or "madagraphite.com").lower()
    allowed_hosts = {primary_host, f"www.{primary_host}"}

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    q = collections.deque([start])
    seen: set[str] = set()
    html_pages = 0
    assets = 0

    while q:
        url = q.popleft()
        if url in seen:
            continue
        seen.add(url)

        if not is_same_site(url, allowed_hosts):
            continue

        try:
            res = fetch(session, url, args.timeout)
        except Exception as e:
            print(f"[ERR] fetch {url}: {e}", file=sys.stderr)
            continue

        if res.status_code >= 400:
            print(f"[WARN] {res.status_code} {url}", file=sys.stderr)
            continue

        final_url = res.final_url
        dst = local_path_for(final_url, out_dir, primary_host)

        ct = res.content_type
        if ct == "text/html" or dst.endswith(".html") or dst.endswith(".htm") or (ct.startswith("text/") and b"<html" in res.content[:4096].lower()):
            if html_pages >= args.max_pages:
                continue
            rewritten, discovered = rewrite_html_links(res.content, final_url, dst, out_dir, primary_host)
            write_bytes(dst, rewritten)
            html_pages += 1
            for u in discovered:
                if is_same_site(u, allowed_hosts) and u not in seen:
                    q.append(u)
        else:
            # If no extension, add one based on content-type.
            base, ext = os.path.splitext(dst)
            if not ext:
                ext2 = guess_ext(ct)
                if ext2:
                    dst = base + ext2
            write_bytes(dst, res.content)
            assets += 1

        if args.delay_ms > 0:
            time.sleep(args.delay_ms / 1000.0)

        if (html_pages + assets) % 50 == 0:
            print(f"[OK] saved: pages={html_pages}, assets={assets}, queue={len(q)}, seen={len(seen)}")

    # Write a convenience entry file.
    index_src = local_path_for(start, out_dir, primary_host)
    entry = os.path.join(out_dir, "OFFLINE_START.html")
    if os.path.exists(index_src):
        rel = rel_link(entry, index_src)
        html = f"""<!doctype html>
<meta charset="utf-8">
<title>madagraphite.com (offline)</title>
<meta http-equiv="refresh" content="0; url={rel}">
<p>Redirecting to <a href="{rel}">{rel}</a>…</p>
"""
        write_bytes(entry, html.encode("utf-8"))

    print(f"Done. Output: {out_dir}")
    print(f"Pages: {html_pages}, Assets: {assets}, Total URLs seen: {len(seen)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

