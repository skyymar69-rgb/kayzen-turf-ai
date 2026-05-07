"""
Job de capture des snapshots de cotes PMU.
À scheduler 7× par course : J-1 18h, J-6h, J-2h, J-1h, J-30m, J-15m, J-5m, closing.

Usage :
  python jobs/capture_odds.py --date 2026-05-08
  python jobs/capture_odds.py --date today   # capture toutes les courses du jour
"""
from __future__ import annotations

import argparse
import asyncio
import os
from datetime import datetime, timezone, date, timedelta

import httpx
import psycopg

PMU_BASE = "https://offline.turfinfo.api.pmu.fr/rest/client/7/programme"
DB_URL = os.environ.get("DATABASE_URL", "")


def today_str() -> str:
    return date.today().strftime("%d%m%Y")


def parse_pmu_datetime(heure_depart: int | None) -> datetime | None:
    if not heure_depart:
        return None
    ts = heure_depart / 1000
    return datetime.fromtimestamp(ts, tz=timezone.utc)


async def fetch_programme(client: httpx.AsyncClient, date_str: str) -> dict:
    url = f"{PMU_BASE}/{date_str}"
    r = await client.get(url, headers={"User-Agent": "kayzen-turf-ai/1.0"})
    r.raise_for_status()
    return r.json()


async def capture_snapshot(date_str: str, conn) -> int:
    """
    Capture un snapshot complet des cotes pour une journée.
    Retourne le nombre de lignes insérées.
    """
    async with httpx.AsyncClient(timeout=15) as client:
        data = await fetch_programme(client, date_str)

    now = datetime.now(timezone.utc)
    rows: list[tuple] = []

    for reunion in data.get("programme", {}).get("reunions", []):
        pays = reunion.get("pays", {}).get("code", "")
        if pays != "FRA":
            continue

        for course in reunion.get("courses", []):
            heure_depart = parse_pmu_datetime(course.get("heureDepart"))
            mtu = (
                int((heure_depart - now).total_seconds() // 60)
                if heure_depart
                else None
            )

            r_num = reunion.get("numOfficiel", 0)
            c_num = course.get("numExterne", 0)
            race_id = f"{date_str}-R{r_num}C{c_num}"

            for partant in course.get("participants", []):
                cote_data = partant.get("dernierRapportDirect", {})
                cote = cote_data.get("rapport")
                if cote is None or float(cote) <= 1.0:
                    continue

                horse_id = str(partant.get("numPmu", 0))
                rows.append(
                    (race_id, horse_id, float(cote), now, mtu, None, "simple_gagnant")
                )

                # Cote place si disponible
                cote_place = partant.get("dernierRapportPlace", {}).get("rapport")
                if cote_place and float(cote_place) > 1.0:
                    rows.append(
                        (race_id, horse_id, float(cote_place), now, mtu, None, "simple_place")
                    )

    if not rows:
        print(f"[capture_odds] No rows for {date_str}")
        return 0

    async with conn.cursor() as cur:
        await cur.executemany(
            """
            INSERT INTO odds_snapshots
                (race_id, horse_id, odds, observed_at, minutes_to_off, pool_eur, bet_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            rows,
        )
    await conn.commit()
    print(f"[capture_odds] {date_str} @ {now.isoformat()[:19]} — {len(rows)} snapshots captured")
    return len(rows)


async def main(date_str: str):
    if date_str == "today":
        date_str = today_str()
    elif date_str == "yesterday":
        date_str = (date.today() - timedelta(days=1)).strftime("%d%m%Y")

    if not DB_URL:
        raise RuntimeError("DATABASE_URL not set")

    async with await psycopg.AsyncConnection.connect(DB_URL) as conn:
        n = await capture_snapshot(date_str, conn)
        print(f"Done — {n} rows for {date_str}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default="today", help="DDMMYYYY or 'today'/'yesterday'")
    args = parser.parse_args()
    asyncio.run(main(args.date))
