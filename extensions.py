"""
Flask extension instances.

Every extension is created here WITHOUT an app, then bound to one inside
the application factory in main.py via `ext.init_app(app)`.

Why the split? Because `models/user.py` needs `db`, and `main.py` needs both
`db` and the models. If `db` lived in main.py you would get a circular
import: main -> models -> main. Putting the instances in their own module
that imports nothing from the app breaks the cycle.

This is also what makes the app factory pattern possible: you can create
several app instances (development, testing) that share these definitions.
"""

from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

# ORM + session. Every model subclasses db.Model.
db = SQLAlchemy()

# Alembic wrapper. Gives us `flask db migrate` / `flask db upgrade`.
migrate = Migrate()

# Issues and verifies the JSON Web Tokens used for authentication.
jwt = JWTManager()

# Password hashing. Never store a plaintext password.
bcrypt = Bcrypt()

# Lets the Vite dev server on :5173 call this API on :5000.
cors = CORS()
