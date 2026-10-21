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
        "headline": ("50,000 / 50,000", "jobs ran exactly once, workers killed mid-run"),
        "repo": "https://github.com/AnuragBhandary/Distributed-Job-Scheduler",
        "stack": ["Python 3.12", "FastAPI", "React", "PostgreSQL", "Redis Streams", "asyncio", "TypeScript", "Docker"],
        "metrics": [
            ("2,633", "retries plus 41 crash-interrupted jobs, all finished"),
            ("7.1 ms", "p95 enqueue latency"),
            ("~1,500/s", "peak jobs on one laptop"),
            ("0", "duplicate side effects, audited in SQL"),
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
            ("Dashboard", "React + TypeScript operations dashboard; a Playwright worker-kill test committed 500 / 500 jobs exactly once"),
        ],
        "images": [],
        "tiles": [
            {"kind": "metric", "big": "50,000 / 50,000", "small": "jobs ran exactly once"},
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
        "stack": ["Python 3.12", "asyncio", "FastAPI", "WebSockets", "PostgreSQL", "Redis pub/sub", "React", "TypeScript"],
        "metrics": [
            ("5M / 5M", "deliveries, every client got every event"),
            ("14,069", "reconnects survived under chaos"),
            ("5 ms", "p95 live delivery latency"),
            ("0", "duplicate or out-of-order events"),
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
            ("Browser client", "React + TypeScript client resumes from its cursor; in Playwright chaos tests every tab applied 1,502 / 1,502 events once"),
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
            ("Live", "column added mid-run, no restart"),
            ("0", "missing, extra or mismatched rows"),
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
            ("Identical", "incremental vs full rebuild hashes"),
            ("R$ 0.00", "revenue gap, source vs warehouse"),
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

    "showtime": {
        "title": "Showtime: Event Ticketing",
        "short": "Showtime",
        "kicker": "Java · Spring Boot · React",
        "oneliner": "A BookMyShow-style ticketing app with live seat maps, where a seat is never sold twice "
                    "however many people go for it at once.",
        "headline": ("50 → 1", "buyers raced for one seat, exactly 1 got it"),
        "repo": "https://github.com/AnuragBhandary/Event-Ticketing-Platform",
        "stack": ["Java 25", "Spring Boot 4", "PostgreSQL", "React", "TypeScript", "Server-Sent Events", "k6", "Playwright"],
        "metrics": [
            ("59,000+", "hold attempts in a 60 s rush"),
            ("1.6 ms", "p95 hold latency"),
            ("18 / 18", "cross-instance browser races passed"),
            ("0", "seats sold twice, audited in SQL"),
        ],
        "why": (
            "When a big concert or an IPL final goes on sale, thousands of people click the same seats in the same second. If two of them both get a confirmation, one turns up at the venue to find someone in their seat, and the ticketing company eats the refund and the anger.",
            "How do you let thousands of people grab seats at the same moment without ever selling one twice, and still show everyone the seat map changing live? I wanted to build the full app, Java backend to React frontend, and then stampede it.",
        ),
        "problem": [
            "A full ticketing app: browse events, pick seats on a live seat map, hold them for ten minutes, pay, get a booking. Spring Boot with JWT auth and roles on the backend, React and TypeScript on the front.",
            "Seats are rows in PostgreSQL. Holding locks them with FOR UPDATE SKIP LOCKED, so two buyers racing get an instant yes and an instant no. Payment is confirmed by an HMAC-signed webhook, processed exactly once, and every browser on either server sees seats change as they happen.",
        ],
        "flow": [
            ("Browser", "React seat map"),
            ("nginx", "two API instances"),
            ("Spring Boot", "JWT, holds, checkout"),
            ("PostgreSQL", "row locks + NOTIFY"),
            ("SSE", "live seats to every browser"),
        ],
        "flow_note": "Each API instance LISTENs to PostgreSQL, so a seat taken through one server shows up "
                     "instantly for buyers connected to the other.",
        "guarantees": [
            ("A seat is never sold twice", "Seat status lives on one row with check constraints; holds lock with SKIP LOCKED and never wait."),
            ("Holds expire by themselves", "An expired hold counts as free everywhere, so correctness never depends on a background job."),
            ("Payments confirm exactly once", "Webhooks are HMAC-verified and deduplicated by event id in the same transaction as the booking."),
            ("Every screen stays live", "pg_notify to LISTEN on each instance, then Server-Sent Events to each browser."),
        ],
        "results": [
            ("Rush", "200 buyers for 60 s at one 1,000-seat event: 59,119 hold attempts, 424 bookings"),
            ("Audit", "0 seats sold twice; 50 buyers racing for one seat got exactly 1 hold"),
            ("Webhooks", "The same webhook sent 5 times at once created 1 booking"),
            ("Tests", "24 integration tests (95.6% lines), 25 web tests, Playwright races 18/18"),
        ],
        "images": [],
        "tiles": [
            {"kind": "metric", "big": "50 → 1", "small": "buyers raced for one seat, 1 got it"},
            {"kind": "code", "text": "SELECT ... FROM seats\nWHERE id = ANY(:ids)\nFOR UPDATE SKIP LOCKED;"},
            {"kind": "metric", "big": "59,119", "small": "hold attempts in 60 s"},
            {"kind": "code", "text": "pg_notify('seat_changes', ...)\n-> SSE to every browser"},
            {"kind": "metric", "big": "1.6 ms", "small": "p95 hold"},
        ],
    },
    "cloud-platform": {
        "title": "Cloud-Native Platform",
        "short": "Cloud Platform",
        "kicker": "Kubernetes · Terraform · Helm",
        "oneliner": "My job queue run the way production runs it: Kubernetes built by Terraform, autoscaled "
                    "on queue depth, with a node killed mid-run and nothing lost.",
        "headline": ("20,000 / 20,000", "jobs exactly once, node killed"),
        "repo": "https://github.com/AnuragBhandary/Cloud-Native-Platform",
        "stack": ["Kubernetes", "Terraform", "Helm", "KEDA", "CloudNativePG", "PgBouncer", "Prometheus", "Grafana"],
        "metrics": [
            ("20,000", "jobs, each run exactly once"),
            ("117", "jobs taken over from a killed node, 0 duplicated"),
            ("1 → 10", "workers autoscaled on queue depth"),
            ("67", "Postgres connections, capped by PgBouncer"),
        ],
        "why": (
            "Most services don't fail in the code, they fail in how they're run: a node dies, traffic spikes, the database runs out of connections at 2 a.m. Platform and SRE teams exist to make that boring, with autoscaling, failover, and alerts that fire before customers notice.",
            "My job queue survived killed workers on a laptop. Would it survive a whole machine dying inside a real cluster, while it scaled itself up and down? I wanted to run it the way companies run services, then pull a node out from under it.",
        ),
        "problem": [
            "A five-node Kubernetes cluster created end to end by Terraform, with the job queue packaged as a Helm chart. KEDA scales the workers on Redis stream lag, CloudNativePG runs PostgreSQL with a hot replica, and Prometheus and Grafana track SLOs with burn-rate alerts.",
            "The first load test OOM-killed the PostgreSQL primary: ten autoscaled workers each opened up to 20 connections. The replica took over by itself and no job was lost. PgBouncer now keeps connections flat however many workers run.",
        ],
        "flow": [
            ("Terraform", "cluster + releases"),
            ("Gateway API", "Traefik"),
            ("jobq API", "HPA on CPU"),
            ("KEDA workers", "scale on stream lag"),
            ("PostgreSQL HA", "CloudNativePG + PgBouncer"),
        ],
        "flow_note": "The whole platform builds from nothing with one `make up`, in about 10 minutes. An AWS version of the "
                     "Terraform (VPC, EKS, ECR) is validated in CI but not applied yet.",
        "guarantees": [
            ("Node loss loses nothing", "Worker leases expire and other workers take the jobs over; fencing tokens stop the dead node's writes."),
            ("Scales on the real signal", "KEDA reads Redis stream lag, not CPU, so workers follow the backlog."),
            ("The database survives the scale-up", "PgBouncer in transaction mode caps connections at 67."),
            ("Problems page you", "SLOs with burn-rate alerts in Prometheus, dashboards in Grafana."),
        ],
        "results": [
            ("Load", "20,000 jobs at 400/s, each 500 ms of work, on a laptop cluster"),
            ("Node kill", "117 jobs taken over from the dead node, 20,000 / 20,000 done, 0 duplicates"),
            ("Autoscaling", "Workers 1 → 10 → 1; backlog drained 84 s after the first job"),
            ("Failover", "Primary OOM-killed in the first run: 18,832 accepted jobs, none lost or run twice"),
        ],
        "images": [],
        "tiles": [
            {"kind": "metric", "big": "20,000 / 20,000", "small": "exactly once"},
            {"kind": "code", "text": "# kill a jobs node mid-run\n117 jobs taken over, 0 dup"},
            {"kind": "metric", "big": "1 → 10", "small": "KEDA workers"},
            {"kind": "code", "text": "triggers:\n- type: redis-streams\n  # scale on stream lag"},
            {"kind": "metric", "big": "67", "small": "pg connections, flat"},
        ],
    },
    "fraud-detection": {
        "title": "Card Fraud Detection",
        "short": "Fraud Detection",
        "kicker": "LightGBM · MLflow · FastAPI",
        "oneliner": "A fraud model on 590,000 real card transactions, built the way production needs it: "
                    "tested on the future, priced in dollars, explained per decision.",
        "headline": ("68%", "of fraud cost saved, test month"),
        "repo": "https://github.com/AnuragBhandary/Fraud-Detection-MLOps",
        "stack": ["Python", "LightGBM", "scikit-learn", "Optuna", "MLflow", "FastAPI", "Polars", "SHAP"],
        "metrics": [
            ("0.64", "PR-AUC on the held-out month (logistic: 0.53)"),
            ("68.5%", "of fraud cost saved vs no model"),
            ("1.1 ms", "p95 API latency (8 ms with reasons)"),
            ("0", "mismatches across 14.2M live vs batch features"),
        ],
        "why": (
            "Card fraud is a race against the clock: a bank has milliseconds to approve or stop a payment, and fraud teams can only review a few percent of transactions. Models that look brilliant in a notebook often fall apart in production because they were tested on data from the same weeks they trained on.",
            "Why do fraud models that score well in notebooks disappoint in production? I wanted to build one the honest way: train on the past, test on the future, only use labels the bank would actually have by then, and turn scores into decisions that save money.",
        ),
        "problem": [
            "Vesta's IEEE-CIS data: 590,540 real e-commerce card transactions, 3.5% fraud. LightGBM trained on four months, tuned on the fifth, reported on the sixth. Customer features only look at the past, including known fraud counted only once a chargeback could have arrived, 30 days later.",
            "Scores go through a calibrated expected-cost rule (review when the expected loss beats the review cost), models are versioned in MLflow with champion/challenger promotion, and a FastAPI service returns every decision with its top five SHAP reasons.",
        ],
        "flow": [
            ("Transactions", "590k, 6 months"),
            ("Features", "past only, 30-day labels"),
            ("LightGBM", "Optuna, calibrated"),
            ("MLflow", "champion / challenger"),
            ("FastAPI", "decision + SHAP reasons"),
        ],
        "flow_note": "The same features are computed twice, vectorised for training and one event at a time for the API; "
                     "a replay proves they agree on every value.",
        "guarantees": [
            ("Tested on the future", "Train days 1-119, tune 120-151, report 152-182. A random split would have claimed PR-AUC 0.87; the honest number is 0.64."),
            ("Only labels you'd have", "Past fraud counts only after 30 days. With 7-day labels the model reaches 0.71; with 90 days, 0.57."),
            ("Decisions in dollars", "Review when p × (amount + fee) > review cost: 68.5% of fraud cost saved, vs 34% for a 0.5 cutoff."),
            ("No training/serving skew", "14.2M feature values and 5,000 API scores matched the batch pipeline exactly."),
        ],
        "results": [
            ("Model", "Test PR-AUC 0.644, ROC-AUC 0.936; +0.116 over logistic regression (95% CI +0.105 to +0.128)"),
            ("Cost", "$540k → $170k on the test month, 9% of transactions reviewed, 85% of fraud dollars caught"),
            ("Serving", "5,000 HTTP requests: p95 1.1 ms, 8.2 ms with SHAP reasons"),
            ("Drift", "Score PSI stayed under 0.11 while weekly PR-AUC fell from 0.81 to about 0.6: drift metrics alone would miss it"),
        ],
        "images": [],
        "tiles": [
            {"kind": "metric", "big": "0.87 → 0.64", "small": "random split vs honest"},
            {"kind": "code", "text": "review if p * (amount + 20)\n          > 10  # dollars"},
            {"kind": "metric", "big": "68.5%", "small": "fraud cost saved"},
            {"kind": "code", "text": "labels usable after 30 days\n# a chargeback takes weeks"},
            {"kind": "metric", "big": "1.1 ms", "small": "p95 score"},
        ],
    },
    "rag-qa": {
        "title": "Financial RAG QA",
        "short": "RAG QA",
        "kicker": "RAG · pgvector · LangGraph",
        "oneliner": "Question answering over 57,638 finance answers where every sentence cites its source, "
                    "and every design choice was measured before it was kept.",
        "headline": ("+72%", "retrieval quality vs BM25"),
        "repo": "https://github.com/AnuragBhandary/Financial-RAG-QA",
        "stack": ["Python", "PostgreSQL", "pgvector", "PyTorch", "sentence-transformers", "LangGraph", "FastAPI", "Ollama"],
        "metrics": [
            ("0.25 → 0.43", "nDCG@10 on 648 held-out questions"),
            ("80% → 93%", "answer sentences backed by their citations"),
            ("−14%", "what the textbook reranker did to quality"),
            ("1.7 ms", "HNSW search, 99.65% of exact recall"),
        ],
        "why": (
            "Companies are putting chatbots on top of their documents, and the costly failure is a confident answer that cites nothing or cites the wrong thing. In finance a made-up number isn't a typo, it's a liability.",
            "Does the standard RAG recipe actually work, or do people just assume it does? I wanted to measure every piece against human relevance labels, keep only what helped, and make the model show where each sentence came from.",
        ),
        "problem": [
            "A RAG service over FiQA, a personal-finance Q&A corpus with 648 held-out questions people labelled for relevance. BM25 and dense embeddings in PostgreSQL with pgvector, fused, reranked, and handed to a local LLM that must cite a passage for every sentence.",
            "The measurement changed the design: the off-the-shelf reranker made results worse, so I fine-tuned the embedding model on FiQA's training questions and fused the reranker's order with the retriever's instead of replacing it. A LangGraph agent adds a self-check that drops unsupported sentences.",
        ],
        "flow": [
            ("Question", "embedded + BM25"),
            ("pgvector", "HNSW, 57,638 docs"),
            ("Fusion", "RRF + reranker"),
            ("LLM", "cite every sentence"),
            ("Check", "LangGraph self-check"),
        ],
        "flow_note": "Served through FastAPI with streaming answers and as an MCP server, so other AI tools can use it.",
        "guarantees": [
            ("Measured against humans", "Every retriever variant scored on 648 human-labelled questions, with paired significance tests."),
            ("Kept only what helped", "The textbook reranker cut nDCG by 14%; fine-tuning the embedder and fusing ranks added +7% over dense (p < 0.001)."),
            ("Every sentence cites", "Citations are parsed and checked; unsupported sentences are flagged."),
            ("Faithfulness, measured", "An LLM judge scores whether each sentence is backed by its citation: 69% with BM25, 80% final, 93% with the agent."),
        ],
        "results": [
            ("Retrieval", "nDCG@10 BM25 0.253 → dense 0.406 → final 0.435 (+72% vs BM25)"),
            ("Faithfulness", "150 questions: 69.1% BM25, 80.2% final, 93.4% agent (4× the LLM calls)"),
            ("Speed", "Retrieval p95 95 ms; first token p95 2.3 s on a local 8B model"),
            ("Tests", "61 tests, 93% coverage, CI on every push"),
        ],
        "images": [],
        "tiles": [
            {"kind": "metric", "big": "+72%", "small": "nDCG@10 vs BM25"},
            {"kind": "code", "text": "ORDER BY embedding <=> $1\nLIMIT 100;  -- HNSW"},
            {"kind": "metric", "big": "−14%", "small": "the textbook reranker"},
            {"kind": "code", "text": "Interest compounds monthly [2].\nYour bank sets the rate [4]."},
            {"kind": "metric", "big": "93%", "small": "sentences supported"},
        ],
    },
    "ab-testing": {
        "title": "Product Analytics & A/B Testing",
        "short": "A/B Testing",
        "kicker": "BigQuery · dbt · Statistics",
        "oneliner": "Google's GA4 store data modelled in BigQuery, and an A/B testing toolkit tested on thousands "
                    "of simulated experiments before reading out a real 14M-user one.",
        "headline": ("+27% → +19.5%", "a confounded lift, corrected"),
        "repo": "https://github.com/AnuragBhandary/Product-Analytics-AB-Testing",
        "stack": ["BigQuery", "dbt", "SQL", "Python", "SciPy", "scikit-learn", "Evidence"],
        "metrics": [
            ("4.3M", "GA4 events modelled in dbt"),
            ("314", "duplicated purchases caught (6.3% of revenue)"),
            ("29.7% → 1.5%", "false positives: daily peeking vs sequential test"),
            ("14M", "users in the real experiment read out"),
        ],
        "why": (
            "Product teams ship or kill features on A/B test results. Peek at the dashboard every morning, pick a noisy metric, or miss that the groups weren't comparable, and you'll launch things that do nothing and kill things that work.",
            "Can you actually trust an A/B test result? I wanted to build the statistics myself, prove they behave on thousands of fake experiments, and then read out a real one where the obvious answer turned out to be wrong.",
        ),
        "problem": [
            "Google's public GA4 ecommerce export modelled in BigQuery with dbt: sessions, checkout funnel, retention cohorts, channels and products, with tests that reconcile revenue against an independent deduplication of the raw events.",
            "Then an experimentation toolkit (SRM checks, power, CUPED, the delta method, sequential tests, doubly robust estimation), validated by simulation on real GA4 users before reading out Criteo's 14-million-user randomised ad experiment. Results are published on an Evidence dashboard.",
        ],
        "flow": [
            ("GA4 export", "BigQuery public data"),
            ("dbt", "13 models, 27 tests"),
            ("Marts", "funnel, cohorts, users"),
            ("Simulations", "A/A, power, peeking"),
            ("Readout", "Criteo, AIPW"),
        ],
        "flow_note": "The dashboard is a static Evidence site, rebuilt and deployed to GitHub Pages by CI.",
        "guarantees": [
            ("Revenue to the cent", "dbt tests reconcile purchases against a separate deduplication of the raw events."),
            ("Tests that hold 5%", "A/A simulations on real users: false positives between 4.1% and 5.7%."),
            ("Peeking is priced in", "Daily looks push false positives to 29.7%; mSPRT keeps them at 1.5%."),
            ("Balance checked, not assumed", "Criteo's split passed SRM but covariates were imbalanced, so four adjusted estimators replace the naive lift."),
        ],
        "results": [
            ("GA4", "360,129 sessions, 4,922 purchases; 314 duplicate purchases worth 6.3% of revenue caught"),
            ("Metric choice", "Detecting +10%: revenue per user needs 190 days, add-to-cart rate 17"),
            ("Criteo", "Naive visit lift +27.1%; doubly robust +19.5% (four estimators agree, +19.2% to +20.5%)"),
            ("Tests", "33 Python tests, 93% coverage; sqlfluff and dbt parse in CI"),
        ],
        "images": [],
        "tiles": [
            {"kind": "metric", "big": "29.7%", "small": "false positives, daily peeking"},
            {"kind": "code", "text": "SELECT COUNT(*) ... \nQUALIFY ROW_NUMBER() OVER (...) = 1"},
            {"kind": "metric", "big": "+27% → +19.5%", "small": "confounded lift, fixed"},
            {"kind": "metric", "big": "190 vs 17", "small": "days to detect +10%"},
            {"kind": "code", "text": "aipw = mu1 - mu0 + ipw_residuals"},
        ],
    },
}

# ---------------------------------------------------------------------------
# Categories: the tabs of the work section. A project can appear in more than one;
# its first category is where its detail page's "next project" cycles.
# ---------------------------------------------------------------------------

CATEGORIES = {
    "software": {
        "label": "Software",
        "blurb": "Backend and full-stack systems that stay correct when things crash.",
        "projects": ["showtime", "cloud-platform", "job-scheduler", "cdc-pipeline"],
        # Smaller "More projects" list under the featured rows; their pages stay in the next/prev chain.
        "more": ["event-streaming", "consumer-benchmark"],
    },
    "data": {
        "label": "Data",
        "blurb": "Pipelines, warehouses and analysis where the numbers reconcile.",
        "projects": ["analytics-warehouse", "cdc-pipeline", "ab-testing", "taxi-postgres-tuning"],
    },
    "ai": {
        "label": "AI / ML",
        "blurb": "Models and LLM systems measured the way production will judge them.",
        "projects": ["fraud-detection", "rag-qa", "ab-testing"],
    },
}


def home_category(slug):
    """The category whose list a project's detail page belongs to (first one listing it)."""
    for key, c in CATEGORIES.items():
        if slug in c["projects"] + c.get("more", []):
            return key
    raise KeyError(slug)


# ---------------------------------------------------------------------------
# Tracks: three entry URLs. Every track shows every category; the track sets the
# headline, the tab that opens first, the about text, skills and the resume the fax prints.
# Each resume links to its own track URL.
# ---------------------------------------------------------------------------

EXPERIENCE_BASE = [
    "Built the audio pipeline for a real-time AI sports commentary system: dual-commentator speech "
    "with ElevenLabs, stitched per play into continuous broadcast audio.",
    "Benchmarked Gemini against Groq for commentary generation and redesigned generation around one "
    "emotion per play, cutting audio-generation time about threefold.",
    "Automated archery match production with ffmpeg: commentary, crossfades, multi-channel audio "
    "and per-play metadata into finished match videos.",
    "Integrated Kafka into the animation flow, replaying 19 games (about 1,274 messages) through an "
    "ordered, de-duplicated path served over FastAPI and WebSockets.",
]

TRACKS = {
    "software": {
        "prefix": "",
        "title": "Anurag Bhandary · Software Engineer",
        "description": "Software engineer working in Python and Java: backend and full-stack systems, "
                       "event-driven services and platforms that stay correct under failure.",
        "role": "Software Engineer",
        "tagline": "Python · Java · React · systems that stay correct",
        "tab": "software",
        "resume": "resume/Anurag-Bhandary-Software.pdf",
        "preview": "assets/img/resume-Software.png",
        "terminal": [
            "whoami",
            "> software engineer. python, java, react, postgres, kafka.",
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
            ("focus", "Backend, full stack & real-time systems"),
            ("based in", "Mumbai, India (IST)"),
            ("education", "M.S. Computer Science"),
            ("currently", "Open to work · relocation worldwide"),
        ],
        "experience": EXPERIENCE_BASE,
    },
    "data": {
        "prefix": "data/",
        "title": "Anurag Bhandary · Data Engineer",
        "description": "Data engineer and analyst working in SQL and Python: pipelines, warehouses, "
                       "replicas and experiments that are tested and reconciled.",
        "role": "Data Engineer",
        "tagline": "SQL · pipelines · warehouses you can trust",
        "tab": "data",
        "resume": "resume/Anurag-Bhandary-Data.pdf",
        "preview": "assets/img/resume-Data.png",
        "terminal": [
            "whoami",
            "> data engineer. sql, python, dbt, airflow, kafka, bigquery.",
            "cat focus.txt",
            "> numbers you can reconcile to the cent.",
        ],
        "about": [
            "I'm a data engineer who cares whether the number on the dashboard is actually right. Not roughly "
            "right: reconciled against the source, to the cent, on every run.",
            "At Fayble, game events flowed through Kafka into live sports statistics and an AI commentary "
            "system. I learned there that a pipeline is only as good as its worst late-arriving record.",
            "Since then I've built a dbt warehouse fed by a live replay of 100,000 real orders, a change data "
            "capture pipeline that proves its replica is identical, a tuning study on 38 million taxi trips, "
            "and an A/B testing toolkit checked on thousands of simulated experiments. Each one comes with the "
            "checks that caught its bugs.",
        ],
        "facts": [
            ("focus", "Data engineering & analytics"),
            ("based in", "Mumbai, India (IST)"),
            ("education", "M.S. Computer Science"),
            ("currently", "Open to work · relocation worldwide"),
        ],
        "experience": [EXPERIENCE_BASE[3], EXPERIENCE_BASE[0], EXPERIENCE_BASE[1], EXPERIENCE_BASE[2]],
    },
    "ai": {
        "prefix": "ai/",
        "title": "Anurag Bhandary · AI/ML Engineer",
        "description": "AI/ML engineer working in Python: models tested on the future, priced in dollars and "
                       "explained per decision, and LLM systems measured against human labels.",
        "role": "AI/ML Engineer",
        "tagline": "Python · ML that holds up in production · measured LLM systems",
        "tab": "ai",
        "resume": "resume/Anurag-Bhandary-AIML.pdf",
        "preview": "assets/img/resume-AIML.png",
        "terminal": [
            "whoami",
            "> ml engineer. python, lightgbm, pytorch, rag, mlflow.",
            "cat focus.txt",
            "> models tested on the future, not the past.",
        ],
        # Draft in his voice; he should edit it.
        "about": [
            "I'm an ML engineer who trusts a number only after trying to break it. A model that looks great "
            "in a notebook and falls apart on next month's data isn't a model, it's a demo.",
            "At Fayble I built the LLM and text-to-speech side of a live AI commentary system: two synthetic "
            "commentators, generation designed around a latency budget, and benchmarks that decided which "
            "provider we used.",
            "Since then I've built a RAG system where every design choice was measured against human labels, a "
            "fraud model trained on the past and tested on the future, and an A/B testing toolkit that read out "
            "a 14-million-user experiment. M.S. in Computer Science from UT Arlington, with a focus on AI.",
        ],
        "facts": [
            ("focus", "Applied ML & LLM systems"),
            ("based in", "Mumbai, India (IST)"),
            ("education", "M.S. Computer Science (AI focus)"),
            ("currently", "Open to work · relocation worldwide"),
        ],
        "experience": [
            "Built the audio pipeline for a real-time AI sports commentary system, turning LLM-generated "
            "play-by-play into dual-commentator speech with ElevenLabs, stitched into continuous broadcast audio.",
            EXPERIENCE_BASE[1], EXPERIENCE_BASE[2], EXPERIENCE_BASE[3],
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
            ("Python", "python", None), ("Java", "openjdk", None), ("TypeScript", "typescript", None),
            ("SQL", None, "SQL"), ("JavaScript", "javascript", None)],
         "note": "Python is home. Java for Spring Boot and the virtual-threads benchmark."},
        {"title": "Backend & frontend", "cls": "sk-back", "items": [
            ("FastAPI", "fastapi", None), ("Spring Boot", "springboot", None), ("React", "react", None),
            ("asyncio", None, "aio"), ("WebSockets", None, "ws"), ("Tailwind CSS", "tailwindcss", None)]},
        {"title": "Distributed systems", "cls": "sk-dist", "items": [
            ("Kafka", "apachekafka", None), ("Redis", "redis", None), ("Debezium", None, "CDC"), ("nginx", "nginx", None)],
         "tags": ["idempotency", "backpressure", "leases & fencing", "row locks", "exactly-once effects"]},
        {"title": "Cloud & DevOps", "cls": "sk-data", "items": [
            ("Kubernetes", "kubernetes", None), ("Terraform", "terraform", None), ("Helm", "helm", None),
            ("Prometheus", "prometheus", None), ("Grafana", "grafana", None)],
         "tags": ["KEDA autoscaling", "SLOs", "Postgres HA"]},
        {"title": "AI & media", "cls": "sk-ai", "items": [
            ("Claude", "claude", None), ("OpenAI", "openai", None), ("Gemini", "googlegemini", None),
            ("Groq", None, "GQ"), ("ElevenLabs", "elevenlabs", None), ("ffmpeg", "ffmpeg", None)]},
        {"title": "Data, testing & tools", "cls": "sk-infra", "items": [
            ("PostgreSQL", "postgresql", None), ("Docker", "docker", None), ("GitHub Actions", "githubactions", None),
            ("Playwright", None, "PW"), ("k6", "k6", None), ("Git", "git", None)]},
    ],
    "data": [
        {"title": "Languages", "cls": "sk-lang", "items": [
            ("SQL", None, "SQL"), ("Python", "python", None), ("Java", "openjdk", None)],
         "note": "SQL first: window functions, CTEs, and reading query plans."},
        {"title": "Pipelines", "cls": "sk-back", "items": [
            ("dbt", "dbt", None), ("Airflow", "apacheairflow", None), ("Kafka", "apachekafka", None), ("Debezium", None, "CDC")],
         "tags": ["incremental loads", "SCD Type 2", "reconciliation", "data quality tests"]},
        {"title": "Databases", "cls": "sk-dist", "items": [
            ("PostgreSQL", "postgresql", None), ("MySQL", "mysql", None), ("BigQuery", "googlebigquery", None), ("Redis", "redis", None)],
         "tags": ["partitioning", "BRIN & covering indexes", "materialized views", "EXPLAIN ANALYZE"]},
        {"title": "Analysis", "cls": "sk-data", "items": [
            ("pandas", "pandas", None), ("SciPy", None, "Sci"), ("Metabase", "metabase", None), ("Evidence", None, "Ev")],
         "tags": ["A/B testing", "CUPED", "funnels", "cohorts", "star schemas"]},
        {"title": "AI", "cls": "sk-ai", "items": [
            ("Claude", "claude", None), ("OpenAI", "openai", None), ("Gemini", "googlegemini", None), ("Groq", None, "GQ")]},
        {"title": "Infra & tools", "cls": "sk-infra", "items": [
            ("Docker", "docker", None), ("AWS S3", "amazons3", None), ("GitHub Actions", "githubactions", None), ("Git", "git", None)]},
    ],
    "ai": [
        {"title": "Languages", "cls": "sk-lang", "items": [
            ("Python", "python", None), ("SQL", None, "SQL"), ("Java", "openjdk", None)],
         "note": "Python for everything ML; SQL for the features and the checks."},
        {"title": "Machine learning", "cls": "sk-back", "items": [
            ("PyTorch", "pytorch", None), ("scikit-learn", "scikitlearn", None), ("LightGBM", None, "GBM"),
            ("Optuna", None, "Op"), ("pandas", "pandas", None), ("Polars", "polars", None)],
         "tags": ["out-of-time validation", "calibration", "SHAP", "imbalanced data", "causal inference"]},
        {"title": "LLMs & retrieval", "cls": "sk-dist", "items": [
            ("LangGraph", "langchain", None), ("Hugging Face", "huggingface", None), ("Ollama", "ollama", None),
            ("pgvector", "postgresql", None), ("Claude", "claude", None), ("Gemini", "googlegemini", None)],
         "tags": ["RAG", "hybrid search", "reranking", "embedding fine-tuning", "MCP", "LLM evaluation"]},
        {"title": "MLOps & serving", "cls": "sk-data", "items": [
            ("MLflow", "mlflow", None), ("FastAPI", "fastapi", None), ("Docker", "docker", None), ("GitHub Actions", "githubactions", None)],
         "tags": ["model registry", "drift monitoring (PSI)", "online/offline parity"]},
        {"title": "Speech & media", "cls": "sk-ai", "items": [
            ("ElevenLabs", "elevenlabs", None), ("Groq", None, "GQ"), ("OpenAI", "openai", None), ("ffmpeg", "ffmpeg", None)]},
        {"title": "Data", "cls": "sk-infra", "items": [
            ("PostgreSQL", "postgresql", None), ("BigQuery", "googlebigquery", None), ("dbt", "dbt", None), ("Kafka", "apachekafka", None)]},
    ],
}

USED_EXTRA = {
    "Python": ["Fayble"], "Kafka": ["Fayble"], "FastAPI": ["Fayble"], "WebSockets": ["Fayble"],
    "Gemini": ["Fayble"], "Groq": ["Fayble"], "ElevenLabs": ["Fayble"], "ffmpeg": ["Fayble"],
    "Java": ["Showtime", "Consumer Benchmark"], "SQL": ["every project"], "GitHub Actions": ["CI on every project"],
    "LightGBM": ["Fraud Detection"], "Optuna": ["Fraud Detection"], "LangGraph": ["RAG QA"],
    "Hugging Face": ["RAG QA"], "pgvector": ["RAG QA"], "Playwright": ["Showtime", "Job Scheduler", "Event Streaming"],
    "Tailwind CSS": ["Showtime", "Job Scheduler", "Event Streaming"], "TypeScript": ["Showtime", "Job Scheduler", "Event Streaming"],
    "React": ["Showtime", "Job Scheduler", "Event Streaming"], "Evidence": ["A/B Testing"], "SciPy": ["A/B Testing"],
    "Spring Boot": ["Showtime"],
}
