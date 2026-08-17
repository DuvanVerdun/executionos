import json
from datetime import datetime

from main import create_app
from extensions import db
from models import Session

USER_ID = 1  # duvan
HISTORY_FILE = r"C:\Users\diedu\Work\dev\projects\ExecutionOS\backend\duvan-verdun-executionos-history.json"


def time_string_to_seconds(time_str: str) -> int:
    """Convert 'HH:MM:SS' string to total seconds."""
    hours, minutes, seconds = time_str.split(":")
    return int(hours) * 3600 + int(minutes) * 60 + int(seconds)


def import_history() -> None:
    app = create_app()

    with app.app_context():
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            entries = json.load(f)

        imported = 0
        skipped = 0
        failed = 0

        for entry in entries:
            try:
                parsed_date = datetime.fromisoformat(entry["date"].replace("Z", "+00:00"))
                mission = entry["mission"]
                existing = Session.query.filter_by(  # type: ignore
                    user_id=USER_ID,
                    date=parsed_date,
                    mission=mission
                ).first()

                if existing:
                    skipped += 1
                    continue

                new_session = Session(
                    user_id=USER_ID,
                    date=parsed_date,
                    mission=mission,
                    target_time_seconds=time_string_to_seconds(entry["targetTimeSeconds"]),
                    actual_time_seconds=time_string_to_seconds(entry["actualTimeSeconds"]),
                )

                db.session.add(new_session)
                db.session.commit()
                imported += 1

            except Exception as e:
                db.session.rollback()
                failed += 1
                print(f"Failed to import to entry: {entry.get('mission', 'unknown')} — {e}")

        print(f"\nDone. Imported: {imported}, Skipped (already existed): {skipped}, Failed: {failed}")


if __name__ == "__main__":
    import_history()
