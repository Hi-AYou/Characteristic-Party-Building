from app.routes.auth import auth_bp
from app.routes.branches import branches_bp
from app.routes.members import members_bp
from app.routes.users import users_bp
from app.routes.dashboard import dashboard_bp

__all__ = ["auth_bp", "branches_bp", "members_bp", "users_bp", "dashboard_bp"]
