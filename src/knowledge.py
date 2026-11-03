"""Builds what AnuRAG may know: worker/src/knowledge.json, generated only from content.py.

Everything here is public on the site, except FAYBLE_DETAIL, which content.py keeps for the chat only.
If a fact isn't in content.py, the bot can't say it.
Run through build.py, or on its own with `python3 src/knowledge.py`.
"""

import json
import re
from pathlib import Path

from content import CATEGORIES, EDUCATION, FAYBLE_DETAIL, PERSON, PROJECTS, ROLES, SKILLS, TESTIMONIAL, TRACKS, USED_EXTRA

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "worker" / "src" / "knowledge.json"

# Which repo docs the bot may read, by project. Only these files.
GITHUB = "https://github.com/AnuragBhandary"
DOCS = {
    "showtime": ("Event-Ticketing-Platform", ["README.md", "docs/DESIGN.md", "docs/BENCHMARKS.md"]),
    "cloud-platform": ("Cloud-Native-Platform", ["README.md", "docs/DESIGN.md", "docs/BENCHMARKS.md", "docs/AWS.md"]),
    "job-scheduler": ("Distributed-Job-Scheduler", ["README.md", "docs/DESIGN.md", "docs/BENCHMARKS.md"]),
    "cdc-pipeline": ("CDC-Pipeline", ["README.md", "docs/DESIGN.md", "docs/RESULTS.md"]),
    "event-streaming": ("Real-Time-Event-Streaming", ["README.md", "docs/DESIGN.md", "docs/BENCHMARKS.md"]),
    "consumer-benchmark": ("Streaming-Consumer-Benchmark", ["README.md", "docs/DESIGN.md", "docs/RESULTS.md"]),
    "rag-qa": ("Financial-RAG-QA", ["README.md", "docs/DESIGN.md", "docs/RESULTS.md"]),
    "fraud-detection": ("Fraud-Detection-MLOps", ["README.md", "docs/DESIGN.md", "docs/RESULTS.md"]),
    "ab-testing": ("Product-Analytics-AB-Testing", ["README.md", "docs/DESIGN.md", "docs/RESULTS.md"]),
    "analytics-warehouse": ("Ecommerce-Analytics-Warehouse", ["README.md", "docs/DESIGN.md", "docs/RESULTS.md"]),
    "taxi-postgres-tuning": ("NYC-Taxi-Postgres-Tuning", ["README.md", "docs/DESIGN.md", "docs/RESULTS.md"]),
}
MAX_WORDS = 220
# Local demo logins shouldn't reach a visitor through the bot.
SKIP_LINE = re.compile(r"admin-password", re.I)


def pairs(rows):
    return " ".join(f"{a}: {b}." for a, b in rows)


def name(slug):
    # "Showtime: Event Ticketing" reads as just "Showtime" inside a question.
    return PROJECTS[slug]["title"].split(":")[0]


# Questions offered as buttons under an answer, so a visitor can go one level deeper without typing.
FAYBLE_ASKS = {
    "fayble-commentary": "How did the Fayble commentary pipeline work?",
    "fayble-voices": "How did he design the commentator voices?",
    "fayble-archery": "What did he build for archery videos?",
    "fayble-kafka": "How did he use Kafka at Fayble?",
    "fayble-teamwork": "How did he work with the Fayble team?",
}


def project_asks(slug):
    n = name(slug)
    return [f"How does {n} work?", f"What were the results of {n}?", f"Why did he build {n}?"]


def fayble_asks(skip=""):
    return [q for k, q in FAYBLE_ASKS.items() if k != skip][:3]


def project_chunks(slug, p):
    url = f"work/{slug}/"
    yield {
        "id": f"{slug}-overview", "title": p["title"], "url": url, "follow": project_asks(slug),
        "text": " ".join([p["kicker"] + ".", p["oneliner"], *p["why"], *p["problem"], p["flow_note"],
                          "Stack: " + ", ".join(p["stack"]) + ".", "Code: " + p["repo"]]),
    }
    if p["guarantees"]:
        yield {"id": f"{slug}-design", "title": f"{p['title']}: design and guarantees", "url": url,
               "follow": project_asks(slug), "text": pairs(p["guarantees"])}
    yield {"id": f"{slug}-results", "title": f"{p['title']}: measured results", "url": url, "follow": project_asks(slug),
           "text": " ".join(f"{b}: {a}." for a, b in p["metrics"]) + " " + pairs(p["results"])}


def skill_chunks():
    for key, cards in SKILLS.items():
        lines = []
        for card in cards:
            names = [item[0] for item in card["items"]]
            lines.append(f"{card['title']}: " + ", ".join(names + card.get("tags", [])) + ".")
            if card.get("note"):
                lines.append(card["note"])
        yield {"id": f"skills-{key}", "title": f"Skills ({CATEGORIES[key]['label']})", "url": "#skills",
               "follow": ["Which projects best show his skills?", "Tell me about his work at Fayble",
                          "List all of Anurag's projects"],
               "text": " ".join(lines)}


def used_in():
    """Which project proves which skill, worked out the same way as the site's tooltips."""
    used = {}
    for p in PROJECTS.values():
        for name in p["stack"]:
            used.setdefault(name, []).append(p["short"])
    for name, where in USED_EXTRA.items():
        used.setdefault(name, []).extend(w for w in where if w not in used.get(name, []))
    return " ".join(f"{name} used in {', '.join(where)}." for name, where in used.items())


def clean(markdown):
    lines = [line for line in markdown.splitlines() if not SKIP_LINE.search(line)]
    text = "\n".join(lines)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    return re.sub(r"<[^>]+>", "", text)


def sized(body):
    """Split one section on blank lines so no passage runs past MAX_WORDS."""
    part, count = [], 0
    for para in re.split(r"\n\s*\n", body):
        words = len(para.split())
        if part and count + words > MAX_WORDS:
            yield "\n\n".join(part)
            part, count = [], 0
        part.append(para.strip())
        count += words
    if part:
        yield "\n\n".join(part)


def doc_chunks(slug, repo, path):
    """One document cut at its headings, each passage titled with where it came from."""
    source = ROOT.parent / repo / path
    project = PROJECTS[slug]["short"]
    name = Path(path).stem.replace("README", "overview").replace("-", " ").lower()
    sections = re.split(r"^(#{1,3} .+)$", clean(source.read_text()), flags=re.M)
    heading, n = "", 0
    for piece in sections:
        if re.match(r"#{1,3} ", piece):
            heading = piece.lstrip("# ").strip()
        elif piece.strip():
            for body in sized(piece.strip()):
                n += 1
                yield {"id": f"{slug}-doc-{name}-{n}", "title": f"{project} {name}: {heading}".rstrip(": "),
                       "url": f"{GITHUB}/{repo}/blob/main/{path}", "follow": project_asks(slug), "text": body}


def featured():
    """One lead project per area, plus a second software one: the site's own front page picks."""
    picks = [CATEGORIES["software"]["projects"][0], CATEGORIES["software"]["projects"][1],
             CATEGORIES["data"]["projects"][0], CATEGORIES["ai"]["projects"][0]]
    return list(dict.fromkeys(picks))


def tour():
    """The "tour" passage, and the fixed short reply to "give me the quick tour" that the worker sends without a model."""
    stack = lambda s: ", ".join(PROJECTS[s]["kicker"].split(" · ")[:2])
    edu = EDUCATION[0]
    lines = [f"• {name(s)} ({stack(s)}): {PROJECTS[s].get('tour', PROJECTS[s]['oneliner'])}" for s in featured()]
    text = (f"Quick tour, overview, summary and introduction. {PERSON['full']} is a "
            f"{TRACKS['software']['role'].lower()} with an {edu['degree']} from {edu['school']}. At Fayble Inc. he "
            "built the audio side of an AI sports commentary system, automated archery match video production and "
            "replayed game data through Kafka. Featured projects: "
            + " ".join(f"{PROJECTS[s]['title']}: {PROJECTS[s]['oneliner']}" for s in featured()))
    answer = (f"Anurag Bhandary has an {edu['degree']} from UT Arlington and builds backend, data and AI / ML "
              "systems. The short version:\n\n"
              "• Work: a one-year founding-team internship at Fayble Inc., an AI sports simulation startup. He built "
              "the audio side of its AI sports commentary, where simulated games were turned into spoken "
              "broadcast-style commentary.\n" + "\n".join(lines) +
              "\n\nPick one below to go deeper, or ask about anything else.")
    follow = ["Tell me about his work at Fayble", f"How does {name(featured()[0])} work?",
              "Which projects best show his skills?", "List all of Anurag's projects"]
    return text, answer, follow


def chunks():
    software = TRACKS["software"]
    text, answer, follow = tour()
    yield {"id": "tour", "title": "Quick tour of Anurag's work", "url": "#work", "text": text, "answer": answer,
           "follow": follow}
    yield {
        "id": "profile", "title": "About Anurag", "url": "#about",
        "text": f"{PERSON['full']}. Based in {PERSON['location']}. " + " ".join(software["about"])
                + " " + " ".join(TRACKS["ai"]["about"]),
    }
    yield {
        "id": "availability", "title": "Availability and location", "url": "#about",
        "text": "Job search, hiring, relocation, availability and location. " + pairs(software["facts"]),
    }
    yield {
        "id": "education", "title": "Education", "url": "#about",
        "text": "Education, where he studied, study, degrees, university, college, school, GPA. "
                + " ".join(f"{d['degree']}, {d['school']}, {d['where']}, {d['when']}, {d['score']}." for d in EDUCATION),
    }
    yield {
        "id": "experience", "title": "Experience at Fayble Inc.", "url": "#experience",
        "follow": fayble_asks(),
        "text": "Where he worked, work experience, work history, career, jobs, employers and employment at Fayble Inc. "
                + " ".join(f"{role}, {when}." for role, when in ROLES) + " " + " ".join(software["experience"]),
    }
    yield {
        "id": "testimonial", "title": f"Reference from {TESTIMONIAL['name']}", "url": "#experience",
        "follow": fayble_asks(),
        "text": f"Testimonial, reference and what his manager, boss or founder said about him. {TESTIMONIAL['name']}, {TESTIMONIAL['role']}: \"{TESTIMONIAL['quote']}\"",
    }
    yield {
        "id": "contact", "title": "Contact", "url": "#contact",
        "text": f"Contact, reach, email, hire. Email: {PERSON['email']}. GitHub: {PERSON['github']}. "
                f"LinkedIn: {PERSON['linkedin']}. LeetCode: {PERSON['leetcode']}.",
    }
    text, answer, follow = project_list()
    yield {"id": "projects", "title": "All projects", "url": "#work", "text": text, "answer": answer, "follow": follow}
    for f in FAYBLE_DETAIL:
        yield {**f, "url": "#experience", "follow": fayble_asks(f["id"])}
    yield {"id": "skills-used", "title": "Where each skill was used", "url": "#skills", "text": used_in()}
    yield from skill_chunks()
    for slug, p in PROJECTS.items():
        yield from project_chunks(slug, p)
    for slug, (repo, paths) in DOCS.items():
        for path in paths:
            yield from doc_chunks(slug, repo, path)
    yield {
        "id": "anurag-bot", "title": "Are you AI? How AnuRAG works", "url": "#top",
        "text": "Yes, AnuRAG is actually an AI chatbot, not Anurag himself. Its avatar is the hero of Anurag's game Dev Run. "
                "It is a retrieval-augmented generation (RAG) assistant named after Anurag. "
                "The site is static on GitHub Pages, so a small Cloudflare Worker holds the API key. It ranks the site's "
                "content with BM25, sends the best passages to Google Gemini, and checks the reply: every answer must "
                "cite a passage and every number must appear in the passage it cites. A sentence that fails is dropped, and an answer that mostly fails is withheld.",
    }


def project_list():
    """The "projects" passage, and the fixed reply to "list his projects" that the worker sends without a model."""
    # A project in two tabs sits under the first; the later tab only points back to it.
    stack = lambda s: PROJECTS[s]["kicker"].replace(" · ", ", ")
    seen, passage, reply = set(), [], []
    for c in CATEGORIES.values():
        lines, items = [], []
        for s in c["projects"] + c.get("more", []):
            p = PROJECTS[s]
            if s in seen:
                lines.append(f"• {p['title']} (also under {next(o['label'] for o in CATEGORIES.values() if s in o['projects'] + o.get('more', []))})")
                items.append(f"{p['title']} also counts as {c['label']}")
                continue
            seen.add(s)
            lines.append(f"• {p['title']} — {stack(s)}")
            more = " (a smaller project, not featured)" if s in c.get("more", []) else ""
            items.append(f"{p['title']}{more} ({stack(s)}; headline result: {p['headline'][0]} {p['headline'][1]})")
        reply.append(f"{c['label']}:\n" + "\n".join(lines))
        passage.append(f"{c['label']} projects: " + "; ".join(items) + ".")
    text = ("List of all projects Anurag built, with each one's stack and headline result. The site leads with the "
            "featured projects to show his skills; the ones marked smaller are listed below them. " + " ".join(passage)
            + " Work experience, alongside the projects: at Fayble Inc. he built the audio pipeline for an AI sports "
            "commentary system (Python, LLMs on Gemini and Groq, ElevenLabs), automated archery match videos with "
            "ffmpeg and 7.1 broadcast audio, and replayed game data through Kafka into SQLite and FastAPI.")
    answer = (f"Anurag has built {len(seen)} projects across software, data and AI / ML. Here they are by area, "
              "with the main skills each one uses:\n\n" + "\n\n".join(reply) +
              "\n\nAsk about any of them for the details, or which ones best show his skills.")
    return text, answer, ["Which projects best show his skills?", "Tell me about his work at Fayble",
                          f"How does {name(featured()[0])} work?"]


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(list(chunks()), ensure_ascii=False, indent=1) + "\n")
    return OUT


if __name__ == "__main__":
    print("wrote", build())
