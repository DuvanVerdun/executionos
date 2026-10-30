from typing import Any

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate

from executionos.auth.routes import auth_bp
from executionos.config import configure
from executionos.dashboard.routes import dashboard_bp
from executionos.extensions import db, jwt
from executionos.feedback import feedback_bp
from executionos.rooms.routes import rooms_bp
from executionos.sessions.routes import sessions_bp


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    """Create and configure the Flask application and connect every feature."""
    app = Flask(__name__)
    configure(app, test_config)

    db.init_app(app)
    Migrate(app, db)
    CORS(app, supports_credentials=True, origins=["https://executionos-mvp.netlify.app", "http://localhost:5500"])
    jwt.init_app(app)

    for blueprint in (auth_bp, sessions_bp, dashboard_bp, rooms_bp, feedback_bp):
        app.register_blueprint(blueprint)

    return app
