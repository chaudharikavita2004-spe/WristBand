"""Static checks: migrations enable RLS on every table; frontend files and API calls resolve."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "database" / "migrations"
FRONT = ROOT / "frontend"


def sql():
    return "\n".join(p.read_text() for p in sorted(MIG.glob("*.sql")))


def test_migrations_are_numbered_and_present():
    names = [p.name for p in sorted(MIG.glob("*.sql"))]
    assert names and all(re.match(r"^\d{3}_", n) for n in names)


def test_every_table_has_rls():
    s = sql().lower()
    tables = re.findall(r"create table if not exists public\.(\w+)", s)
    assert len(tables) >= 10
    for t in tables:
        assert f"alter table public.{t} enable row level security" in s, t
        assert f"on public.{t}" in s, f"no policy for {t}"


def test_frontend_local_references_exist():
    for html in FRONT.glob("*.html"):
        for ref in re.findall(r'(?:src|href)="([^"#:]+)"', html.read_text()):
            assert (FRONT / ref).exists(), f"{html.name} -> {ref}"


def test_frontend_api_calls_match_backend_routes(app):
    rules = [r.rule for r in app.url_map.iter_rules()]
    patterns = [re.compile("^" + re.sub(r"<[^>]+>", "[^/]+", r) + "$") for r in rules]
    js = "\n".join(p.read_text() for p in FRONT.rglob("*.js"))
    calls = set(re.findall(r"api\.\w+\(\s*[`'\"](/[^`'\"?]*)", js))
    assert calls, "no API calls found"
    for c in calls:
        path = "/api" + re.sub(r"\$\{[^}]+\}", "x", c)
        assert any(p.match(path) for p in patterns), f"frontend calls missing route {path}"
