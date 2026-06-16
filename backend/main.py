from flask import Flask, request, jsonify  # type: ignore[attr-defined]
from flask_cors import CORS
import json
import os
from typing import Any, cast

app = Flask(__name__)
CORS(app)

DATA_FILE = "sessions.json"


def load_sessions() -> list[dict[str, Any]]:
    """Load existing sessions from JSON file"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return []


def save_sessions(sessions: list[dict[str, Any]]) -> None:
    """Save sessions to JSON file"""
    with open(DATA_FILE, "w") as f:
        json.dump(sessions, f, indent=2)


@app.route("/api/save-session", methods=["POST"])
def save_session() -> tuple[Any, int]:
    """Receive session data and save to JSON"""
    try:
        data: dict[str, Any] = cast(dict[str, Any], request.json)  # type: ignore
        sessions: list[dict[str, Any]] = load_sessions()
        sessions.append(data)
        save_sessions(sessions)
        return jsonify({  # type: ignore
            "success": True,
            "message": "Session saved",
            "total_sessions": len(sessions)
        }), 200
    except Exception as e:
        return jsonify({  # type: ignore
            "success": False,
            "error": str(e)
        }), 400


@app.route("/api/get-sessions", methods=["GET"])
def get_sessions() -> tuple[Any, int]:
    """Retrieve all saved sessions"""
    sessions: list[dict[str, Any]] = load_sessions()
    return jsonify({  # type: ignore
        "success": True,
        "total_sessions": len(sessions),
        "sessions": sessions
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
