"""Fetch my LeetCode stats into assets/data/leetcode.json.

Run by .github/workflows/leetcode.yml every 6 hours (LeetCode's API can't be called from a
browser because of CORS, so the site reads this file instead). Run by hand: python3 src/leetcode.py
"""

import json
import time
import urllib.request
from pathlib import Path

USERNAME = "anuragb2901"
OUT = Path(__file__).resolve().parent.parent / "assets" / "data" / "leetcode.json"

QUERY = """
query($u: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $u) {
    profile { ranking }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    userCalendar { streak totalActiveDays submissionCalendar }
  }
}
"""


def main():
    body = json.dumps({"query": QUERY, "variables": {"u": USERNAME}}).encode()
    req = urllib.request.Request(
        "https://leetcode.com/graphql", data=body,
        headers={"Content-Type": "application/json", "Referer": "https://leetcode.com",
                 "User-Agent": "Mozilla/5.0 (portfolio stats)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)["data"]
    u = data["matchedUser"]
    solved = {x["difficulty"]: x["count"] for x in u["submitStatsGlobal"]["acSubmissionNum"]}
    total = {x["difficulty"]: x["count"] for x in data["allQuestionsCount"]}
    cal = {int(k): v for k, v in json.loads(u["userCalendar"]["submissionCalendar"] or "{}").items()}
    cutoff = time.time() - 371 * 86400
    out = {
        "username": USERNAME,
        "updated": int(time.time()),
        "ranking": u["profile"]["ranking"],
        "solved": {k: solved.get(k, 0) for k in ("All", "Easy", "Medium", "Hard")},
        "total": {k: total.get(k, 0) for k in ("All", "Easy", "Medium", "Hard")},
        "streak": u["userCalendar"]["streak"],
        "activeDays": u["userCalendar"]["totalActiveDays"],
        "calendar": {str(k): v for k, v in sorted(cal.items()) if k >= cutoff},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print("solved", out["solved"], "days", len(out["calendar"]))


if __name__ == "__main__":
    main()
