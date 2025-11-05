# app.py
from flask import Flask, redirect, url_for
from dotenv import load_dotenv
import os

from modules.admin_routes import admin_bp
from modules.user_routes import user_bp
from modules.api_routes import api_bp
from modules.document_routes import document_bp

import user_credentials, user_exam

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "fallback_secret_key")

# ----------------------------
# REGISTER BLUEPRINTS
# ----------------------------
app.register_blueprint(admin_bp)
app.register_blueprint(user_bp)
app.register_blueprint(api_bp)
app.register_blueprint(document_bp)

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")


@app.route('/')
def home():
    return redirect(url_for('admin_bp.admin_login'))


if __name__ == '__main__':
    user_credentials.init_db()
    user_exam.init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
