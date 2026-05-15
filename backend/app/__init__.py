import os
from flask import Flask, send_from_directory, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS

db = SQLAlchemy()
jwt = JWTManager()

# 前端构建产物路径（相对于 backend 目录）
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), '../../frontend/dist')


def create_app():
    app = Flask(__name__, static_folder=None)

    # 加载配置
    from app.config import get_config
    app.config.from_object(get_config())

    # 初始化扩展
    db.init_app(app)
    jwt.init_app(app)

    # ── JWT token 有效性回调：检查密码是否在 token 签发后被更改 ──
    @jwt.token_in_blocklist_loader
    def check_token_revoked(jwt_header, jwt_payload):
        """
        如果用户的密码在 token 签发之后被修改过，则该 token 视为已失效。
        返回 True 表示 token 被拉黑（请求将收到 401）。
        """
        from app.models.user import User
        from datetime import datetime, timezone

        user_id = jwt_payload.get("sub")
        iat = jwt_payload.get("iat")  # token 签发时间（Unix 时间戳）
        if not user_id or not iat:
            return False

        user = User.query.get(int(user_id))
        if not user:
            return True  # 用户已被删除，token 失效

        if user.password_changed_at is None:
            return False  # 从未改过密码，token 有效

        # 将 password_changed_at（naive UTC）转为时间戳比较
        changed_ts = user.password_changed_at.replace(
            tzinfo=timezone.utc
        ).timestamp()
        return iat < changed_ts  # token 签发早于最近改密 → 失效

    CORS(
        app,
        resources={r"/api/*": {
            "origins": app.config["CORS_ORIGINS"],
            "supports_credentials": True,
            "allow_headers": ["Content-Type", "Authorization"],
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        }},
    )

    # 注册蓝图
    from app.routes.auth import auth_bp
    from app.routes.branches import branches_bp
    from app.routes.members import members_bp
    from app.routes.users import users_bp
    from app.routes.dashboard import dashboard_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(branches_bp)
    app.register_blueprint(members_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(dashboard_bp)

    # ── 托管前端静态文件 ──────────────────────────────────────
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        dist = os.path.abspath(FRONTEND_DIST)
        full = os.path.join(dist, path)
        # 如果是真实存在的文件（js/css/图片等），直接返回
        if path and os.path.exists(full) and os.path.isfile(full):
            return send_from_directory(dist, path)
        # 其他所有路由（React Router 的页面路由）返回 index.html
        return send_file(os.path.join(dist, 'index.html'))

    # 建表
    with app.app_context():
        db.create_all()
        _seed_initial_data()

    return app


def _seed_initial_data():
    """首次运行时创建超管账号和示例支部"""
    from app.models.user import User
    from app.models.branch import Branch
    import bcrypt

    if User.query.count() > 0:
        return  # 已有数据，跳过

    # 创建示例支部
    branches = [
        Branch(name="2025级专硕第一党支部", description="大数据学院2025级专硕第一党支部"),
        Branch(name="2025级专硕第二党支部", description="大数据学院2025级专硕第二党支部"),
        Branch(name="2024级学硕党支部", description="大数据学院2024级学硕党支部"),
    ]
    for b in branches:
        db.session.add(b)
    db.session.flush()

    # 创建超级管理员
    hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode("utf-8")
    admin = User(
        username="admin",
        password_hash=hashed,
        real_name="系统管理员",
        role="super_admin",
        branch_id=None,
    )
    db.session.add(admin)
    db.session.commit()
    print("✅ 种子数据已创建：admin / admin123")
