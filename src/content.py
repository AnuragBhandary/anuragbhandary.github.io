"""Everything the site says lives here. Edit this file, then run `python3 src/build.py`."""

PERSON = {
    "first": "ANURAG",
    "middle": "NAVIN",
    "last": "BHANDARY",
    "full": "Anurag Navin Bhandary",
    "email": "bhandaryanurag@gmail.com",
    "github": "https://github.com/AnuragBhandary",
    "linkedin": "https://www.linkedin.com/in/bhandary-anurag",
    "leetcode": "https://leetcode.com/anuragb2901",
    "location": "Mumbai, India",
    "site": "https://anuragbhandary.github.io",
}

EDUCATION = [
    {
        "degree": "M.S. Computer Science",
        "school": "University of Texas at Arlington",
        "when": "2023 – 2025",
        "score": "GPA 3.42 / 4",
        "where": "Arlington, TX",
    },
    {
        "degree": "B.E. Electronics Engineering",
        "school": "University of Mumbai",
        "when": "2019 – 2023",
        "score": "CGPA 8.36 / 10",
        "where": "Mumbai, India",
    },
]

TESTIMONIAL = {
    "quote": "Highly adaptable and contributed across a wide range of components, from database "
             "to APIs to media pipelines. Quickly learned new concepts, delivered solid results, "
             "and consistently met timelines.",
    "name": "Alan Moskowitz",
    "role": "Founder & CEO, Fayble · managed me directly",
    "photo": "assets/img/alan-moskowitz.jpg",
    "url": "https://www.linkedin.com/in/alanmosk/",
}

# ---------------------------------------------------------------------------
# Projects. `tiles` are the cards that trail the cursor on the home page.
# ---------------------------------------------------------------------------

PROJECTS = {
    "job-scheduler": {
        "title": "Distributed Job Scheduler",
        "short": "Job Scheduler",
        "kicker": "Python · Distributed systems",
        "oneliner": "A Celery-style job queue that never runs a job's side effects twice, "
                    "even when workers are killed in the middle of a job.",
        "headline": ("0", "duplicates across 50,000 jobs"),
        "repo": "https://github.com/AnuragBhandary/Distributed-Job-Scheduler",
        "stack": ["Python 3.12", "asyncio", "FastAPI", "PostgreSQL", "Redis Streams", "Lua", "Docker"],
        "metrics": [
            ("0", "unrecovered failures in 50,000 jobs"),
            ("0", "duplicate side effects, audited in SQL"),
            ("7.1 ms", "p95 enqueue latency"),
            ("~1,500/s", "peak jobs on one laptop"),
        ],
        "why": (
            'Every product runs work in the background: sending emails, charging cards, generating reports. Workers crash, deploys restart them, networks time out. If the queue retries a half-finished job carelessly, a customer gets two emails or, worse, two charges. Payment companies, e-commerce and banks all have to solve this.',
            'How do you make sure a job runs exactly once, even if the worker dies halfway through? A repeated email is annoying; a repeated payment is a refund ticket. I wanted to build that guarantee myself, then try hard to break it.',
        ),
        "problem": [
            'A job platform in the spirit of Celery: jobs run now or on a schedule, retry with backoff, and land in a dead-letter queue when they run out of retries. PostgreSQL is the source of truth, Redis only carries hints, and every worker holds a heartbeated lease with a fencing token, so a crashed or frozen worker can never commit a job twice.',
            'The test was never “does it run jobs”. It was: kill a worker every minute for 25 minutes, fail 5% of attempts on purpose, then audit the database for duplicates.',
        ],
        "flow": [
            ("Client", "SDK or REST, idempotency key"),
            ("API", "FastAPI, rate-limited"),
            ("PostgreSQL", "source of truth"),
            ("Redis Streams", "dispatch hints only"),
            ("Workers", "leases, heartbeats, fenced commits"),
        ],
        "flow_note": "A scheduler promotes due jobs, reaps expired leases and re-sends anything "
                     "Redis lost. There is no leader: every component can run as many copies as you like.",
        "guarantees": [
            ("Accepted jobs are never lost", "Committed before the 2xx. Leases and a reaper recover dead workers; a sweeper recovers lost messages."),
            ("No duplicates from client retries", "Idempotency-Key plus a unique constraint. Same key, different body: 409."),
            ("Exactly-once effects", "A fencing token on every write. Side effects commit in the same transaction as the fenced completion."),
            ("Scales without a leader", "FOR UPDATE SKIP LOCKED and conditional updates everywhere."),
        ],
        "results": [
            ("Load", "50,000 jobs at 2,000/min, a worker SIGKILLed every minute, 5% of attempts failing"),
            ("Recovered", "2,633 retries and 41 crash-interrupted jobs, all finished"),
            ("Enqueue latency", "p95 7.1 ms, p99 8.2 ms"),
            ("Tests", "88 tests against real Postgres and Redis, 94% coverage, chaos tests with real processes"),
        ],
        "images": [],
        "tiles": [
            {"kind": "metric", "big": "0", "small": "duplicate effects"},
            {"kind": "code", "text": "UPDATE jobs SET status='done'\nWHERE id=$1\n  AND fence=$2;  -- zombie? rejected"},
            {"kind": "metric", "big": "SIGKILL", "small": "a worker, every 60 s"},
            {"kind": "metric", "big": "7.1 ms", "small": "p95 enqueue"},
            {"kind": "code", "text": "@app.task(max_attempts=5)\ndef charge(ctx, order_id): ..."},
        ],
    },
    "event-streaming": {
        "title": "Real-Time Event Streaming",
        "short": "Event Streaming",
        "kicker": "Python · WebSockets",
        "oneliner": "A live cricket scoreboard feed where 1,000 clients receive every event exactly "
                    "once and in order, through crashes and reconnects.",
        "headline": ("5M / 5M", "deliveries, 0 out of order"),
        "repo": "https://github.com/AnuragBhandary/Real-Time-Event-Streaming",
        "stack": ["Python 3.12", "asyncio", "FastAPI", "WebSockets", "PostgreSQL", "Redis pub/sub", "nginx"],
        "metrics": [
            ("5M / 5M", "deliveries, every client got every event"),
            ("0", "duplicate or out-of-order events"),
            ("14,069", "reconnects survived under chaos"),
            ("5 ms", "p95 live delivery latency"),
        ],
        "why": (
            "Live scores, delivery tracking, stock tickers and chat all push updates to millions of phones at once, and mobile connections drop all the time. During an IPL match, a score that skips a wicket or shows it twice breaks trust faster than one that's a second late.",
            'How do you push one update to a thousand screens at once, when some are on fast Wi-Fi and some are on a train? I wanted to find out how to stop one slow phone from holding everyone else back, and how a dropped phone catches up without missing a ball.',
        ),
        "problem": [
            'A live event feed, demoed as a cricket scoreboard. Producers publish events, PostgreSQL stores them in order, and every WebSocket subscriber on any of three servers receives each event exactly once, in order.',
            'Then I attacked it: random client drops, killed server instances and killed Redis connections, with 1,000 clients connected and every sequence number audited.',
        ],
        "flow": [
            ("Producers", "POST events with an event_id"),
            ("nginx", "load balancer"),
            ("3 instances", "FastAPI + WebSockets"),
            ("PostgreSQL", "ordered log + snapshots"),
            ("Redis pub/sub", "best-effort fan-out"),
        ],
        "flow_note": "Each instance tracks the last sequence number it delivered. Redis is allowed to lose, "
                     "duplicate or reorder messages: gaps are filled from PostgreSQL and duplicates dropped.",
        "guarantees": [
            ("Ordering", "Appends lock the stream's row, so sequence numbers are assigned in commit order."),
            ("Race-free resume", "A reconnecting client is registered before its history replays, and live events are buffered meanwhile."),
            ("Backpressure", "Every client has a bounded queue. One that falls behind is cut off and resumes from its cursor; nobody else slows down."),
            ("One recovery path", "Drops, crashes, deploys, slow consumers and gaps all end the same way: reconnect and resume from the cursor."),
        ],
        "results": [
            ("Load", "1,000 WebSocket clients, 3 instances, 100,000 events, continuous chaos"),
            ("Chaos", "Random client drops, 5 instance SIGKILLs, 8 Redis pub/sub kills"),
            ("Latency", "p95 5 ms, p99 14.5 ms, producer send to subscriber receive"),
            ("Headroom", "About 50,000 deliveries/s without chaos"),
        ],
        "images": [],
        "tiles": [
            {"kind": "metric", "big": "5,000,000", "small": "deliveries, none lost"},
            {"kind": "code", "text": "close(4008)  # slow consumer\n# client resumes from its cursor"},
            {"kind": "metric", "big": "14,069", "small": "reconnects survived"},
            {"kind": "score", "big": "MI 186/4", "small": "18.2 ov · live"},
            {"kind": "metric", "big": "5 ms", "small": "p95 delivery"},
        ],
    },
    "consumer-benchmark": {
        "title": "Streaming Consumer Benchmark",
        "short": "asyncio vs Virtual Threads",
        "kicker": "Java 21 · Python · Kafka",
        "oneliner": "The same fan-out server written twice, Java 21 virtual threads and Python asyncio, "
                    "measured by one harness up to 20,000 connections.",
        "headline": ("87 → 2.3 ms", "p50 at 20k connections"),
        "repo": "https://github.com/AnuragBhandary/Streaming-Consumer-Benchmark",
        "stack": ["Java 21", "Virtual threads", "Python asyncio", "uvloop", "Kafka", "JMH", "Docker"],
        "metrics": [
            ("20,000", "socket connections held"),
            ("320k/s", "deliveries in the saturation test"),
            ("87 → 2.3 ms", "p50 at 20k connections after one fix"),
            ("0", "duplicates or gaps, in every run"),
        ],
        "why": (
            "Teams pick Python asyncio or Java for high-concurrency services mostly on opinion. Java 21's virtual threads changed that trade-off: simple blocking code that can hold tens of thousands of connections. The choice decides how many servers you pay for and how fast users get their data.",
            'Python asyncio or Java 21 virtual threads: which should a team pick for a service holding thousands of connections? People argue for both. I wanted numbers instead, even if they went against Python, the language I use most.',
        ),
        "problem": [
            'The hot path of my streaming platform, Kafka in and thousands of TCP sockets out, written twice: Java 21 with one virtual thread per connection, and Python asyncio on uvloop.',
            'Both pass the same conformance suite against real Kafka, and one load harness drives them. Every run starts from a cold container, discards the warm-up window and audits every sequence number.',
        ],
        "flow": [
            ("Kafka producer", "open-loop load"),
            ("Kafka", "the event log"),
            ("Server", "Java 21 VT  or  Python asyncio"),
            ("Client swarm", "up to 20k sockets"),
            ("Report", "latency, CPU, memory, audit"),
        ],
        "flow_note": "Same protocol, same harness, same 2 CPUs and 1 GiB per server. Only the concurrency model changes.",
        "guarantees": [],
        "results": [
            ("Up to 5,000 connections", "Both about 2 ms p50. Java p99 4-5 ms, Python 5-10 ms"),
            ("10,000 connections", "Java p99 8 ms. Python on one process: p99 253 ms (one core at 100%)"),
            ("20,000 connections", "Java with 2 dispatch threads: p50 2.5 ms. Python on 2 processes: p50 184 ms"),
            ("Memory per connection", "Java about 28 KiB (+190 MiB JVM). Python about 12 KiB (+45 MiB)"),
        ],
        "images": [
            ("assets/img/work/scaling_p99.png", "p99 latency as connections grow, Java vs Python", "p99 latency as connections grow."),
            ("assets/img/work/scaling_memory.png", "Memory as connections grow, Java vs Python", "Memory as connections grow."),
        ],
        "tiles": [
            {"kind": "img", "src": "assets/img/work/scaling_p99.png"},
            {"kind": "metric", "big": "87 → 2.3 ms", "small": "one fix, p50"},
            {"kind": "code", "text": "Thread.ofVirtual()\n  .start(() -> serve(socket));"},
            {"kind": "metric", "big": "20,000", "small": "connections"},
            {"kind": "img", "src": "assets/img/work/scaling_memory.png"},
        ],
    },
    "cdc-pipeline": {
        "title": "CDC Pipeline",
        "short": "CDC Pipeline",
        "kicker": "Kafka · Debezium · PostgreSQL",
        "oneliner": "Streams every MySQL insert, update and delete through Debezium and Kafka into "
                    "PostgreSQL, then proves the copy is identical, even after crashes.",
        "headline": ("141 ms", "p95 replication lag"),
        "repo": "https://github.com/AnuragBhandary/CDC-Pipeline",
        "stack": ["MySQL 8.4", "Debezium 3.0", "Kafka 3.9", "Python", "PostgreSQL 16", "Docker"],
        "metrics": [
            ("141 ms", "p95 lag, MySQL commit to Postgres commit"),
            ("1,000,021", "row changes replayed at 3,100/s"),
            ("0", "missing, extra or mismatched rows"),
            ("Live", "column added mid-run, no restart"),
        ],
        "why": (
            'Companies keep their live database separate from analytics, search and reporting. Nightly copies are always a day stale, and writing to two places from app code slowly drifts apart. Change data capture is how fintech and e-commerce teams keep those copies in sync within milliseconds, without silently getting balances or reports wrong.',
            'How do you keep a second copy of a live database in sync within milliseconds, and know it is right instead of hoping? I wanted to stream every change across, crash the pipeline midway, then prove the copy matched row by row.',
        ),
        "problem": [
            "Debezium reads MySQL's binlog and publishes every row change to Kafka. A sink I wrote applies the changes to PostgreSQL idempotently, keyed on primary key and binlog position, and evolves the schema on the fly.",
            'At the end of every run it waits for catch-up and compares every table row by row, plus a SHA-256 per table.',
        ],
        "flow": [
            ("MySQL", "8 writer processes"),
            ("Debezium", "reads the binlog"),
            ("Kafka", "keyed by primary key"),
            ("3 sinks", "idempotent apply"),
            ("PostgreSQL", "verified replica"),
        ],
        "flow_note": "Each target row stores the binlog position that wrote it, so replaying an old change is a no-op.",
        "guarantees": [
            ("Per-row ordering", "Debezium keys by primary key, so each row lives in one partition, handled by one consumer at a time."),
            ("Replays are no-ops", "ON CONFLICT ... WHERE target.position < incoming.position."),
            ("No loss on crash", "Commit PostgreSQL first, then the Kafka offset. At-least-once delivery, idempotent apply."),
            ("Schema changes without downtime", "New columns are added in the same transaction as the data, under an advisory lock."),
        ],
        "results": [
            ("Run", "1,000,021 changes at 3,100/s, 3 sinks, a column added at 500k, a sink SIGKILLed at 700k"),
            ("Lag", "p50 89 ms, p95 141 ms, p99 183 ms"),
            ("Verification", "All 5 tables identical, row by row and by SHA-256, across 440k rows"),
            ("Tests", "33 tests, 93% coverage, including kills inside and between commits"),
        ],
        "images": [],
        "tiles": [
            {"kind": "code", "text": "ON CONFLICT (id) DO UPDATE ...\nWHERE t.pos < EXCLUDED.pos;"},
            {"kind": "metric", "big": "141 ms", "small": "p95 lag"},
            {"kind": "metric", "big": "SHA-256", "small": "source = replica"},
            {"kind": "code", "text": "ALTER TABLE orders\n  ADD COLUMN coupon ...;  -- live"},
            {"kind": "metric", "big": "1,000,021", "small": "changes"},
        ],
    },
    "analytics-warehouse": {
        "title": "E-Commerce Analytics Warehouse",
        "short": "Analytics Warehouse",
        "kicker": "dbt · Airflow · PostgreSQL",
        "oneliner": "100,000 real orders replayed as a live source into a dbt star schema that is tested "
                    "and reconciled to the cent on every run.",
        "headline": ("85 / 85", "dbt tests, every load"),
        "repo": "https://github.com/AnuragBhandary/Ecommerce-Analytics-Warehouse",
        "stack": ["MySQL 8.4", "Python", "PostgreSQL 16", "dbt", "Airflow", "Metabase", "Docker"],
        "metrics": [
            ("99,441", "orders, 597,649 source changes"),
            ("85 / 85", "dbt tests passed on every load"),
            ("R$ 0.00", "revenue gap, source vs warehouse"),
            ("Identical", "incremental vs full rebuild hashes"),
        ],
        "why": (
            'Every e-commerce company runs on dashboards fed by a warehouse loaded from the live database. Late updates, crashed loads and customers who change address make those numbers quietly disagree with reality, and business decisions get made on them anyway.',
            "Can a dashboard number be trusted to the cent, even when orders arrive late, loads crash halfway and customers move house? I wanted to build the whole path from a live database to a chart, and stop any run whose numbers don't add up.",
        ),
        "problem": [
            'The Olist dataset is a static snapshot, so I built a simulator that replays its own timeline into MySQL: orders arrive, get approved, ship and get delivered, and reviews come in later.',
            'A Python loader moves changes into PostgreSQL incrementally, dbt models them into a star schema, Airflow runs it every ten minutes, and every run is tested and reconciled against the source before anyone reads a number.',
        ],
        "flow": [
            ("Simulator", "replays business time"),
            ("MySQL", "operational source"),
            ("Python EL", "watermark + lookback"),
            ("PostgreSQL", "raw → dbt star schema"),
            ("Metabase", "dashboards on marts"),
        ],
        "flow_note": "Airflow runs extract → snapshot → dbt run → dbt test → reconcile. A failing test stops the "
                     "run before anyone reads a bad number.",
        "guarantees": [
            ("No change is missed", "An updated_at watermark with a lookback window that re-reads recent history for late commits."),
            ("Reruns are idempotent", "MERGE applies only newer versions. A rerun with no new data applies 0 rows."),
            ("A crash leaves nothing half-loaded", "Data and watermark commit in one transaction. Tested with SIGKILL mid-load."),
            ("Orders join the address at purchase time", "SCD Type 2 customer snapshots and a point-in-time join."),
        ],
        "results": [
            ("Run", "The full dataset replayed in 27 ticks of 30 business days"),
            ("Every tick", "85/85 dbt tests and 32/32 reconciliation checks passed"),
            ("Revenue", "R$ 15,843,553.24 in the source and the marts, to the cent"),
            ("Finding", "Orders 8+ days late average a 1.7 review score, against 4.3 when on time"),
        ],
        "images": [
            ("assets/img/work/metabase-revenue.png", "Metabase revenue dashboard", "Revenue dashboard, built through Metabase's API."),
            ("assets/img/work/metabase-delivery-performance.png", "Delivery performance dashboard", "Late deliveries vs review scores."),
        ],
        "tiles": [
            {"kind": "img", "src": "assets/img/work/metabase-revenue.png"},
            {"kind": "metric", "big": "R$ 15,843,553.24", "small": "matched to the cent"},
            {"kind": "code", "text": "dbt build\n✓ 85 of 85 tests passed"},
            {"kind": "img", "src": "assets/img/work/metabase-cohort-retention.png"},
            {"kind": "metric", "big": "1.7 ★", "small": "avg review when 8+ days late"},
        ],
    },
    "taxi-postgres-tuning": {
        "title": "Postgres Tuning on 38M Taxi Trips",
        "short": "Postgres Tuning",
        "kicker": "PostgreSQL · SQL · MySQL",
        "oneliner": "Twelve analytical questions over every 2023 NYC taxi trip, taken from a 488 ms median "
                    "to 19 ms with exactly the same answers.",
        "headline": ("25×", "faster median query"),
        "repo": "https://github.com/AnuragBhandary/NYC-Taxi-Postgres-Tuning",
        "stack": ["PostgreSQL 16", "MySQL 8.4", "SQL", "Python", "Docker"],
        "metrics": [
            ("38.3M", "trips, all of 2023"),
            ("488 → 19 ms", "median query"),
            ("19 s → 0.45 s", "whole 12-query suite"),
            ("12 / 12", "answers identical to baseline"),
        ],
        "why": (
            "As tables grow, analysts' queries slow down and dashboards start timing out. The usual fix is a bigger, pricier server. Knowing how partitioning, the right indexes and precomputed views work can make the same hardware answer in milliseconds.",
            'How much faster can the same queries get on the same machine, without changing a single answer? Everyone says “just add an index”. I wanted to read the query plans on 38 million real rows and see which changes actually matter, and what each one costs.',
        ),
        "problem": [
            'Every yellow-taxi trip of 2023 (38 million rows, 4.5 GB) loaded into PostgreSQL, and twelve questions an analyst would really ask.',
            'Each question ran against a plain table, then a tuned design with partitions, BRIN and covering indexes and materialized views, measured with EXPLAIN (ANALYZE, BUFFERS) and checked to return exactly the same rows. Then the same suite ran on MySQL.',
        ],
        "flow": [
            ("TLC Parquet", "12 monthly files"),
            ("COPY", "normalised load"),
            ("Partitions", "one per month"),
            ("Indexes + MVs", "BRIN, covering, rollups"),
            ("12 queries", "timed, plans saved"),
        ],
        "flow_note": "Every plan is committed to the repo, so each speed-up can be traced to the exact change in the plan.",
        "guarantees": [
            ("Partition pruning + BRIN (832 kB)", "One week of March: 580k pages read down to 12k."),
            ("Covering index", "Midtown to JFK for a full year: 356 ms to 7.7 ms, index-only, 0 heap fetches."),
            ("Materialized view", "Revenue per month for the year: 4,959 ms to 25 ms."),
            ("Histogram rollup", "Exact tip-percentage quartiles: 2,412 ms to 10.8 ms, no 7.9M-row sort."),
        ],
        "results": [
            ("Median query", "Baseline 488 ms, tuned 19.4 ms (25×), MySQL 8.4 47.2 ms"),
            ("Whole suite", "Baseline 19.0 s, tuned 0.45 s (42×), MySQL 2.16 s"),
            ("Cost", "3.4 GB of indexes and a 44 s concurrent view refresh, documented"),
            ("Tests", "41 tests, 95% coverage, on a committed 41k-trip sample"),
        ],
        "images": [],
        "tiles": [
            {"kind": "metric", "big": "25×", "small": "faster median"},
            {"kind": "code", "text": "CREATE INDEX ... USING brin\n  (pickup_at);  -- 832 kB"},
            {"kind": "metric", "big": "38,310,226", "small": "trips"},
            {"kind": "code", "text": "Index Only Scan\n  Heap Fetches: 0"},
            {"kind": "metric", "big": "488 → 19 ms", "small": "median query"},
        ],
    },
}

# ---------------------------------------------------------------------------
# Tracks: `/` is software (public), `/data/` is unlisted.
# ---------------------------------------------------------------------------

TRACKS = {
    "software": {
        "prefix": "",
        "noindex": False,
        "title": "Anurag Bhandary · Backend Engineer",
        "description": "Backend engineer working in Python: async services, event-driven systems and "
                       "pipelines that stay correct under failure.",
        "role": "Backend Engineer",
        "tagline": "Python · async services · event-driven systems",
        "projects": ["job-scheduler", "event-streaming", "consumer-benchmark", "cdc-pipeline"],
        "resume": "resume/Anurag-Bhandary-Software.pdf",
        "terminal": [
            "whoami",
            "> backend engineer. python, asyncio, kafka, postgres.",
            "cat focus.txt",
            "> systems that stay correct when things crash.",
        ],
        "about": [
            "I'm a backend engineer who likes systems that stay calm under load. Queues, streams, and "
            "services where a hundred milliseconds is a design constraint rather than a rounding error.",
            "At Fayble I owned the audio side of an AI commentary system. Two synthetic commentators, an "
            "intensity model driven by game state, and per play speech stitched into continuous broadcast "
            "output. The interesting part was never the prompt, it was the latency budget. I benchmarked "
            "providers, cut a TTS call per sentence down to one per play, and got generation roughly three "
            "times faster without losing the live feel.",
            "Lately I've been building in Java and Spring Boot alongside Python, mostly event-driven services "
            "with Kafka, Postgres and Redis behind them. M.S. in Computer Science from UT Arlington. Off hours "
            "I'm on LeetCode or pulling apart whatever showed up in the data and AI space that week.",
        ],
        "facts": [
            ("focus", "Backend & real-time systems"),
            ("based in", "Mumbai, India (IST)"),
            ("education", "M.S. Computer Science"),
            ("currently", "Open to work · relocation worldwide"),
        ],
        "stack": [
            ("lang", "Python (primary) · SQL · Java · JavaScript"),
            ("backend", "FastAPI · asyncio · WebSockets · REST"),
            ("systems", "Kafka · Redis · Debezium · idempotency · backpressure"),
            ("data", "PostgreSQL · MySQL"),
            ("ai", "Claude · OpenAI · Gemini · Groq · ElevenLabs · ffmpeg"),
            ("infra", "Docker · AWS S3 · GitHub Actions · Linux"),
        ],
        "experience": [
            "Built the audio pipeline for a real-time AI sports commentary system: dual-commentator speech "
            "with ElevenLabs, stitched per play into continuous broadcast audio.",
            "Benchmarked Gemini against Groq, measured about 10× lower latency with Groq, and redesigned "
            "generation around one emotion per play, cutting audio time about threefold.",
            "Automated archery match production with ffmpeg: commentary, crossfades, multi-channel audio "
            "and per-play metadata into finished match videos.",
            "Integrated Kafka into the animation flow, replaying 19 games (about 1,274 messages) through an "
            "ordered, de-duplicated path served over FastAPI and WebSockets.",
        ],
    },
    "data": {
        "prefix": "data/",
        "noindex": True,
        "title": "Anurag Bhandary · Data Engineer",
        "description": "Data engineer working in SQL and Python: pipelines, warehouses and replicas "
                       "that are tested and reconciled.",
        "role": "Data Engineer",
        "tagline": "SQL · pipelines · warehouses you can trust",
        "projects": ["analytics-warehouse", "cdc-pipeline", "taxi-postgres-tuning"],
        "resume": "resume/Anurag-Bhandary-Data.pdf",
        "terminal": [
            "whoami",
            "> data engineer. sql, python, dbt, airflow, kafka.",
            "cat focus.txt",
            "> numbers you can reconcile to the cent.",
        ],
        "about": [
            "I'm a data engineer who cares whether the number on the dashboard is actually right. Not roughly "
            "right: reconciled against the source, to the cent, on every run.",
            "At Fayble, game events flowed through Kafka into live sports statistics and an AI commentary "
            "system. I learned there that a pipeline is only as good as its worst late-arriving record.",
            "Since then I've built a dbt warehouse fed by a live replay of 100,000 real orders, a change data "
            "capture pipeline that proves its replica is identical, and a tuning study on 38 million taxi trips. "
            "Each one comes with the checks that caught its bugs.",
        ],
        "facts": [
            ("focus", "Data engineering & analytics"),
            ("based in", "Mumbai, India (IST)"),
            ("education", "M.S. Computer Science"),
            ("currently", "Open to work · relocation worldwide"),
        ],
        "stack": [
            ("sql", "Window functions · CTEs · query tuning · EXPLAIN"),
            ("lang", "SQL · Python (pandas, SQLAlchemy) · Java"),
            ("db", "PostgreSQL (partitioning, indexing, MVs) · MySQL 8"),
            ("pipelines", "dbt · Airflow · Kafka · Debezium (CDC)"),
            ("modeling", "Star schemas · SCD Type 2 · data quality tests"),
            ("tools", "Metabase · Docker · AWS S3 · Git"),
        ],
        "experience": [
            "Integrated Kafka into the platform's animation flow and sports-statistics delivery, replaying "
            "19 games (about 1,274 events) through an ordered path that rejected duplicates.",
            "Built the audio pipeline for a real-time AI sports commentary system: dual-commentator speech "
            "with ElevenLabs, stitched per play into continuous broadcast audio.",
            "Measured Gemini against Groq, found Groq about 10× faster, and restructured generation around one "
            "emotion per play, cutting audio time about threefold.",
            "Automated archery match production with ffmpeg, joining commentary, multi-channel audio and "
            "structured per-play metadata into finished match videos.",
        ],
    },
}

ROLES = [
    ("Software Developer (Founding Team)", "Jan 2026 – Jun 2026"),
    ("Software Development Intern", "Jul 2025 – Dec 2025"),
]


# ---------------------------------------------------------------------------
# Skills (bento cards). Each item is (name, simple-icons slug or None, glyph if no icon).
# "Used in" is worked out from the project stacks; USED_EXTRA adds work outside the projects.
# ---------------------------------------------------------------------------

SKILLS = {
    "software": [
        {"title": "Languages", "cls": "sk-lang", "items": [
            ("Python", "python", None), ("SQL", None, "SQL"), ("Java", "openjdk", None), ("JavaScript", "javascript", None)],
         "note": "Python is home. Java for the virtual-threads benchmark and DSA."},
        {"title": "Backend & APIs", "cls": "sk-back", "items": [
            ("FastAPI", "fastapi", None), ("asyncio", None, "aio"), ("WebSockets", None, "ws"),
            ("REST APIs", None, "{ }"), ("Pydantic", "pydantic", None)]},
        {"title": "Distributed systems", "cls": "sk-dist", "items": [
            ("Kafka", "apachekafka", None), ("Redis", "redis", None), ("Debezium", None, "CDC"), ("nginx", "nginx", None)],
         "tags": ["idempotency", "backpressure", "leases & fencing", "event replay", "exactly-once effects"]},
        {"title": "Data", "cls": "sk-data", "items": [
            ("PostgreSQL", "postgresql", None), ("MySQL", "mysql", None)],
         "tags": ["partitioning", "indexing", "row locks"]},
        {"title": "AI & media", "cls": "sk-ai", "items": [
            ("Claude", "claude", None), ("OpenAI", "openai", None), ("Gemini", "googlegemini", None),
            ("Groq", None, "GQ"), ("ElevenLabs", "elevenlabs", None), ("ffmpeg", "ffmpeg", None)]},
        {"title": "Infra & tools", "cls": "sk-infra", "items": [
            ("Docker", "docker", None), ("AWS S3", "amazons3", None), ("GitHub Actions", "githubactions", None),
            ("Linux", "linux", None), ("Git", "git", None), ("uv", "uv", None)]},
    ],
    "data": [
        {"title": "Languages", "cls": "sk-lang", "items": [
            ("SQL", None, "SQL"), ("Python", "python", None), ("Java", "openjdk", None)],
         "note": "SQL first: window functions, CTEs, and reading query plans."},
        {"title": "Pipelines", "cls": "sk-back", "items": [
            ("dbt", "dbt", None), ("Airflow", "apacheairflow", None), ("Kafka", "apachekafka", None), ("Debezium", None, "CDC")],
         "tags": ["incremental loads", "SCD Type 2", "reconciliation", "data quality tests"]},
        {"title": "Databases", "cls": "sk-dist", "items": [
            ("PostgreSQL", "postgresql", None), ("MySQL", "mysql", None), ("Redis", "redis", None)],
         "tags": ["partitioning", "BRIN & covering indexes", "materialized views", "EXPLAIN ANALYZE"]},
        {"title": "Analysis", "cls": "sk-data", "items": [
            ("pandas", "pandas", None), ("Metabase", "metabase", None), ("Excel", None, "XL")],
         "tags": ["star schemas", "cohorts"]},
        {"title": "AI", "cls": "sk-ai", "items": [
            ("Claude", "claude", None), ("OpenAI", "openai", None), ("Gemini", "googlegemini", None), ("Groq", None, "GQ")]},
        {"title": "Infra & tools", "cls": "sk-infra", "items": [
            ("Docker", "docker", None), ("AWS S3", "amazons3", None), ("GitHub Actions", "githubactions", None), ("Git", "git", None)]},
    ],
}

USED_EXTRA = {
    "Python": ["Fayble"], "Kafka": ["Fayble"], "FastAPI": ["Fayble"], "WebSockets": ["Fayble"],
    "Gemini": ["Fayble"], "Groq": ["Fayble"], "ElevenLabs": ["Fayble"], "ffmpeg": ["Fayble"],
    "Java": ["Consumer Benchmark"], "SQL": ["every project"], "GitHub Actions": ["CI on every project"],
}
