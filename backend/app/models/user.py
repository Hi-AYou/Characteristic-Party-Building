from app import db
from datetime import datetime


class User(db.Model):
    """系统用户（超管/支书/普通查看）"""
    __tablename__ = "users"

    ROLES = ("super_admin", "secretary", "viewer")

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    real_name = db.Column(db.String(50), default="")
    role = db.Column(
        db.Enum(*ROLES, name="user_role"), nullable=False, default="viewer"
    )
    # 超管 branch_id 为 None；支书/viewer 绑定支部
    branch_id = db.Column(
        db.Integer, db.ForeignKey("branches.id"), nullable=True
    )
    # viewer 自助注册时记录对应的学号，防止重复注册
    student_id = db.Column(db.String(30), nullable=True, unique=True, index=True)
    is_active = db.Column(db.Boolean, default=True)
    # 记录最近一次密码变更时间，用于使旧 token 立即失效
    password_changed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def update_password(self, new_hash: str):
        """统一的密码更新方法，同时刷新 password_changed_at"""
        self.password_hash = new_hash
        self.password_changed_at = datetime.utcnow()

    def to_dict(self, include_sensitive=False):
        d = {
            "id": self.id,
            "username": self.username,
            "real_name": self.real_name,
            "role": self.role,
            "branch_id": self.branch_id,
            "branch_name": self.branch.name if self.branch else None,
            "student_id": self.student_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        return d

