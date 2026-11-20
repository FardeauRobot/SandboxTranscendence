#!/usr/bin/env python3
"""
labo -- lance et arrête les morceaux du projet depuis un petit panneau terminal.

    ./labo            le panneau (j/k, ↵, q)
    ./labo status     l'état, une ligne par service
    ./labo stop       arrête tout ce que le labo a lancé (la base reste)

Stdlib seulement, ANSI brut comme nav. Les services tournent détachés : quitter le
panneau ne les arrête pas. Leur pid est dans .labo/run/, leurs logs dans .labo/logs/.

La base du labo est un conteneur à part (port 5433), PAS le compose de l'équipe : le
clone ~/Desktop/Transcendence a le même nom de projet compose et le même conteneur, un
`docker compose up` ici réutiliserait sa base.
"""

from __future__ import annotations

import os
import re
import select
import signal
import socket
import subprocess
import sys
import termios
import time
import tty
import unicodedata
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEAM = ROOT / "transcendence"
BACK = TEAM / "apps" / "backend"
STATE = ROOT / ".labo"
RUN = STATE / "run"
LOGS = STATE / "logs"

PG_NAME = "labo_transcendence_pg"
PG_VOLUME = "labo_transcendence_pg"
PG_PORT = 5433

# id, nom, dossier, commande, port, url, dépendances
SERVICES = [
    dict(id="db", name="Base de données", port=PG_PORT, url=None, deps=[], docker=True),
    dict(id="api", name="API équipe (Adonis)", cwd=BACK, cmd=["npm", "run", "dev"],
         port=3333, url="http://localhost:3333", deps=["db"]),
    dict(id="front", name="Front équipe", cwd=TEAM / "apps" / "frontend",
         cmd=["npm", "run", "dev", "--", "--port", "5173", "--strictPort"],
         port=5173, url="http://localhost:5173", deps=["api"]),
    dict(id="aura", name="Aura (bac à sable)", cwd=ROOT / "sandbox",
         cmd=["npm", "run", "dev", "--", "--port", "5174", "--strictPort"],
         port=5174, url="http://localhost:5174", deps=[]),
]
# Actions ponctuelles : tournent jusqu'au bout, log dans .labo/logs/<id>.log.
# prettier remet schema.ts dans sa forme commitée : migration:run le régénère sans formatage.
ACTIONS = [
    dict(id="migrate", name="Migrations (codegen + migrate)", cwd=BACK, deps=["db"],
         cmd=["sh", "-c", "node ace codegen && node ace migration:run && "
                          "npx prettier --write database/schema.ts >/dev/null && echo '✓ migrations à jour'"]),
    dict(id="install", name="npm install (équipe + Aura)", cwd=ROOT, deps=[],
         cmd=["sh", "-c", "(cd transcendence && npm ci) && (cd sandbox && npm install) && echo '✓ installé'"]),
]
BY_ID = {s["id"]: s for s in SERVICES + ACTIONS}


# ---------------------------------------------------------------- état

def port_open(port: int) -> bool:
    # Vite et Adonis écoutent sur « localhost », que macOS résout souvent en ::1 seulement.
    for family, addr in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        with socket.socket(family) as s:
            s.settimeout(0.05)
            if s.connect_ex((addr, port)) == 0:
                return True
    return False


def read_pid(sid: str) -> int | None:
    try:
        pid = int((RUN / f"{sid}.pid").read_text())
        os.kill(pid, 0)
        return pid
    except (OSError, ValueError):
        return None


def docker(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["docker", *args], capture_output=True, text=True)


def db_state() -> str:
    r = docker("inspect", "-f", "{{.State.Running}}", PG_NAME)
    if r.returncode != 0:
        if "Cannot connect" in r.stderr or "daemon" in r.stderr:
            return "docker éteint"
        return "absente"
    return "en marche" if r.stdout.strip() == "true" else "arrêtée"


def state(s: dict) -> str:
    """'en marche' | 'démarre' | 'arrêté' | 'occupé' | 'fini' | 'échec' | état docker."""
    if s.get("docker"):
        return db_state()
    pid = read_pid(s["id"])
    if "port" not in s:  # action
        if pid:
            return "en cours"
        f = RUN / f"{s['id']}.exit"
        if f.exists():
            return "fini" if f.read_text().strip() == "0" else "échec"
        return ""
    up = port_open(s["port"])
    if pid:
        return "en marche" if up else "démarre"
    return "occupé" if up else "arrêté"


def running(st: str) -> bool:
    return st in ("en marche", "démarre", "en cours")


# ---------------------------------------------------------------- actions

def start_db() -> str:
    st = db_state()
    if st == "docker éteint":
        return "Docker n'est pas lancé."
    if st == "absente":
        env = BACK / ".env"
        if not env.exists():
            return "transcendence/apps/backend/.env manquant (copie .env.example, POSTGRES_PORT=5433)."
        r = docker("run", "-d", "--name", PG_NAME, "--restart", "unless-stopped",
                   "-p", f"127.0.0.1:{PG_PORT}:5432", "-v", f"{PG_VOLUME}:/var/lib/postgresql",
                   "--env-file", str(env), "postgres:18-alpine")
    else:
        r = docker("start", PG_NAME)
    return "" if r.returncode == 0 else r.stderr.strip().splitlines()[-1]


def wait_db(timeout: float = 20) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if docker("exec", PG_NAME, "pg_isready", "-U", "postgres").returncode == 0:
            return True
        time.sleep(0.5)
    return False


def start(sid: str, seen: set | None = None) -> str:
    s = BY_ID[sid]
    seen = seen if seen is not None else set()
    if sid in seen:
        return ""
    seen.add(sid)
    for d in s["deps"]:
        if not running(state(BY_ID[d])):
            err = start(d, seen)
            if err:
                return err
        if d == "db" and not wait_db():
            return "La base ne répond pas."
    if s.get("docker"):
        return start_db()
    st = state(s)
    if running(st):
        return ""
    if st == "occupé":
        return f"Le port {s['port']} est déjà pris par un autre programme."
    RUN.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    (RUN / f"{sid}.exit").unlink(missing_ok=True)
    log = open(LOGS / f"{sid}.log", "w")
    cmd = s["cmd"]
    if "port" not in s:  # action : on note le code de sortie
        exit_file = RUN / f"{sid}.exit"
        cmd = ["sh", "-c", '"$@"; echo $? > "$0"', str(exit_file), *cmd]
    p = subprocess.Popen(cmd, cwd=s["cwd"], stdout=log, stderr=subprocess.STDOUT,
                         stdin=subprocess.DEVNULL, start_new_session=True,
                         env={**os.environ, "FORCE_COLOR": "0", "NO_COLOR": "1"})
    (RUN / f"{sid}.pid").write_text(str(p.pid))
    return ""


def stop(sid: str) -> str:
    s = BY_ID[sid]
    if s.get("docker"):
        r = docker("stop", PG_NAME)
        return "" if r.returncode == 0 else r.stderr.strip()
    pid = read_pid(sid)
    if not pid:
        return "Pas lancé par le labo." if state(s) == "occupé" else ""
    try:
        os.killpg(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    for _ in range(30):
        if read_pid(sid) is None:
            break
        time.sleep(0.1)
    else:
        try:
            os.killpg(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    (RUN / f"{sid}.pid").unlink(missing_ok=True)
    return ""


ANSI_RX = re.compile(r"\x1b(\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07|[@-Z\\-_]|c)")


def log_tail(sid: str, n: int) -> list[str]:
    try:
        data = (LOGS / f"{sid}.log").read_bytes()[-16384:].decode(errors="replace")
    except OSError:
        return []
    data = ANSI_RX.sub("", data)
    lines = [ln.split("\r")[-1] for ln in data.splitlines() if ln.strip()]
    return lines[-n:]


# ---------------------------------------------------------------- dessin

def hexc(h: str, bg: bool = False) -> str:
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    return f"\x1b[{48 if bg else 38};2;{r};{g};{b}m"


RESET, BOLD, DIM = "\x1b[0m", "\x1b[1m", "\x1b[2m"
C_BORDER, C_TITLE, C_SEL = hexc("#5c6370"), hexc("#e5c07b"), hexc("#61afef")
C_ON, C_OFF, C_WARN, C_ERR = hexc("#98c379"), hexc("#5c6370"), hexc("#e5c07b"), hexc("#e06c75")
C_ROWBG = hexc("#2c313a", bg=True)


def width(text: str) -> int:
    return sum(0 if unicodedata.combining(c) else 1 for c in text)


def fit(text: str, w: int) -> str:
    out, n = "", 0
    for c in text:
        cw = 0 if unicodedata.combining(c) else 1
        if n + cw > w:
            break
        out, n = out + c, n + cw
    return out + " " * (w - n)


def state_style(st: str) -> tuple[str, str]:
    if st in ("en marche", "fini"):
        return C_ON, "●"
    if st in ("démarre", "en cours"):
        return C_WARN, "◐"
    if st in ("occupé", "échec", "docker éteint"):
        return C_ERR, "✕"
    return C_OFF, "○"


def render(sel: int, states: dict, msg: str) -> str:
    cols, rows = os.get_terminal_size()
    w = max(40, min(cols - 2, 72))
    inner = w - 2
    items = SERVICES + ACTIONS
    out = ["\x1b[H\x1b[2J"]
    title = " Transcendence · labo "
    out.append(f"{C_BORDER}╭─{C_TITLE}{BOLD}{title}{RESET}{C_BORDER}{'─' * (inner - 1 - width(title))}╮{RESET}")

    def row(text: str, style: str = "", plain: str | None = None) -> None:
        plain = text if plain is None else plain
        pad = inner - width(plain)
        out.append(f"{C_BORDER}│{RESET}{style}{text}{' ' * max(pad, 0)}{RESET}{C_BORDER}│{RESET}")

    for i, s in enumerate(items):
        if i == len(SERVICES):
            row(f"{C_BORDER}  {'─' * (inner - 4)}", plain="  " + "─" * (inner - 4))
        st = states.get(s["id"], "")
        col, dot = state_style(st)
        cur = "❯" if i == sel else " "
        port = f":{s['port']}" if "port" in s else ""
        name = fit(s["name"], inner - 26)
        plain = f" {cur} {dot} {name} {port:<7}{st:<12}"
        text = (f" {C_SEL}{cur}{RESET} {col}{dot}{RESET} "
                f"{BOLD if i == sel else ''}{name}{RESET} {DIM}{port:<7}{RESET}{col}{st:<12}{RESET}")
        row(text, C_ROWBG if i == sel else "", plain)
    out.append(f"{C_BORDER}╰{'─' * inner}╯{RESET}")
    out.append(f"{DIM}  ↵ lancer/arrêter · o ouvrir · a tout l'équipe · x tout arrêter · q quitter{RESET}")
    if msg:
        out.append(f"  {C_ERR}{msg}{RESET}")
    # le log du service sélectionné, sur la place qui reste
    sid = items[sel]["id"]
    room = rows - len(out) - 2
    if room > 2 and sid != "db":
        lines = log_tail(sid, room)
        if lines:
            out.append(f"{C_BORDER}  ── log {sid} {'─' * (inner - 9 - len(sid))}{RESET}")
            out += [f"{DIM}  {fit(ln, cols - 3).rstrip()}{RESET}" for ln in lines]
    return "\r\n".join(out)


# ---------------------------------------------------------------- boucle

def read_key(timeout: float) -> str:
    r, _, _ = select.select([sys.stdin], [], [], timeout)
    if not r:
        return ""
    k = os.read(sys.stdin.fileno(), 8).decode(errors="ignore")
    return {"\x1b[A": "k", "\x1b[B": "j", "\r": "enter", "\n": "enter"}.get(k, k)


def tui() -> None:
    items = SERVICES + ACTIONS
    sel, msg = 0, ""
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    sys.stdout.write("\x1b[?1049h\x1b[?25l")
    try:
        tty.setraw(fd)
        while True:
            states = {s["id"]: state(s) for s in items}
            sys.stdout.write(render(sel, states, msg))
            sys.stdout.flush()
            k = read_key(1.0)
            if not k:
                continue
            msg = ""
            s = items[sel]
            if k in ("q", "\x03"):
                break
            elif k == "j":
                sel = (sel + 1) % len(items)
            elif k == "k":
                sel = (sel - 1) % len(items)
            elif k in ("enter", " ", "l"):
                if running(states[s["id"]]):
                    msg = stop(s["id"])
                else:
                    msg = "…"
                    sys.stdout.write(render(sel, states, "lancement…"))
                    sys.stdout.flush()
                    msg = start(s["id"])
            elif k == "o":
                if s.get("url"):
                    webbrowser.open(s["url"])
                else:
                    msg = "Rien à ouvrir pour ça."
            elif k == "a":
                sys.stdout.write(render(sel, states, "lancement de l'équipe…"))
                sys.stdout.flush()
                msg = start("front")
            elif k == "x":
                for t in reversed(SERVICES):
                    if not t.get("docker"):
                        stop(t["id"])
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)
        sys.stdout.write("\x1b[?25h\x1b[?1049l")
        sys.stdout.flush()
    on = [s["name"] for s in SERVICES if running(state(s))]
    if on:
        print("Toujours en marche : " + ", ".join(on) + "  (./labo stop pour arrêter)")


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "status":
        for s in SERVICES + ACTIONS:
            st = state(s)
            if st:
                port = f":{s['port']}" if "port" in s else ""
                print(f"{s['id']:<8} {port:<6} {st}")
        return 0
    if cmd == "stop":
        for s in reversed(SERVICES):
            if not s.get("docker"):
                stop(s["id"])
        print("Arrêté (la base reste en marche : docker stop " + PG_NAME + ").")
        return 0
    if cmd in ("start",) and len(argv) > 2:
        err = start(argv[2])
        print(err or f"{argv[2]} lancé.")
        return 1 if err else 0
    if cmd:
        print(__doc__.strip())
        return 2
    if not sys.stdin.isatty():
        print("Le panneau demande un terminal. Essaie : ./labo status")
        return 1
    tui()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
