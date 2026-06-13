from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

DATA_FILE = "sessions.json"


def load_sessions():
    """Load existing sessions from JSON file"""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return []


def save_sessions(sessions):
    """Save sessions to JSON file"""
    with open(DATA_FILE, "w") as f:
        json.dump(sessions, f, indent=2)


@app.route("/api/save-session", methods=["POST"])
def save_session():
    """Receive session data and save to JSON"""
    try:
        data = request.json
        sessions = load_sessions()
        sessions.append(data)
        save_sessions(sessions)
        return jsonify({
            "success": True,
            "message": "Session saved",
            "total_sessions": len(sessions)
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400


@app.route("/api/get-sessions", methods=["GET"])
def get_sessions():
    """Retrieve all saved sessions"""
    sessions = load_sessions()
    return jsonify({
        "success": True,
        "total_sessions": len(sessions),
        "sessions": sessions
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
