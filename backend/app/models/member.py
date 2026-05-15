from app import db
from datetime import datetime, date


class Member(db.Model):
    """党员信息"""
    __tablename__ = "members"

    id = db.Column(db.Integer, primary_key=True)
    branch_id = db.Column(
        db.Integer, db.ForeignKey("branches.id"), nullable=False, index=True
    )

    # ── 基本信息 ──────────────────────────────────────────────
    name = db.Column(db.String(50), nullable=False)
    student_id = db.Column(db.String(30), unique=True, nullable=False, index=True)
    gender = db.Column(db.String(10), default="")
    department = db.Column(db.String(100), default="")
    major = db.Column(db.String(100), default="")
    birthdate = db.Column(db.Date, nullable=True)
    education_type = db.Column(db.String(10), default="")   # 本科/硕士/博士
    enrollment_year = db.Column(db.Integer, nullable=True)
    expected_graduation = db.Column(db.String(7), nullable=True)  # 拟毕业年月 YYYY-MM
    phone = db.Column(db.String(20), default="")            # 敏感
    email = db.Column(db.String(120), default="")           # 敏感
    political_status = db.Column(db.String(30), default="") # 政治面貌（手动维护）
    party_role_in_branch = db.Column(db.String(50), default="")
    is_overseas = db.Column(db.Boolean, default=False)

    # ── 发展进度日期 ──────────────────────────────────────────
    application_date = db.Column(db.Date, nullable=True)                    # 递交入党申请书
    youth_league_graduation_date = db.Column(db.Date, nullable=True)        # 团校结业
    activist_confirmed_date = db.Column(db.Date, nullable=True)             # 积极分子确立
    activist_training_graduation_date = db.Column(db.Date, nullable=True)   # 积极分子培训班结业
    dev_target_confirmed_date = db.Column(db.Date, nullable=True)           # 发展对象确立
    dev_training_graduation_date = db.Column(db.Date, nullable=True)        # 发展对象培训班结业
    probationary_date = db.Column(db.Date, nullable=True)                   # 预备党员
    full_member_date = db.Column(db.Date, nullable=True)                    # 正式党员

    # ── 其他 ──────────────────────────────────────────────────
    extra_data = db.Column(db.JSON, default=dict)
    notes = db.Column(db.Text, default="")
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    updated_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    @property
    def current_stage(self):
        if self.full_member_date:
            return "正式党员"
        if self.probationary_date:
            return "预备党员"
        if self.dev_target_confirmed_date:
            return "发展对象"
        if self.activist_confirmed_date:
            return "积极分子"
        if self.application_date:
            return "入党申请人"
        return "无"

    def to_dict(self, include_sensitive=True):
        # 获取操作人用户名
        updated_by_username = None
        if self.updated_by:
            from app.models.user import User
            u = User.query.get(self.updated_by)
            updated_by_username = u.username if u else None

        d = {
            "id": self.id,
            "branch_id": self.branch_id,
            "branch_name": self.branch.name if self.branch else "",
            "name": self.name,
            "student_id": self.student_id,
            "gender": self.gender,
            "department": self.department,
            "major": self.major,
            "birthdate": self.birthdate.isoformat() if self.birthdate else None,
            "education_type": self.education_type,
            "enrollment_year": self.enrollment_year,
            "expected_graduation": self.expected_graduation,
            "political_status": self.political_status,
            "party_role_in_branch": self.party_role_in_branch,
            "is_overseas": self.is_overseas,
            "current_stage": self.current_stage,
            # 发展进度日期
            "application_date": self.application_date.isoformat() if self.application_date else None,
            "youth_league_graduation_date": self.youth_league_graduation_date.isoformat() if self.youth_league_graduation_date else None,
            "activist_confirmed_date": self.activist_confirmed_date.isoformat() if self.activist_confirmed_date else None,
            "activist_training_graduation_date": self.activist_training_graduation_date.isoformat() if self.activist_training_graduation_date else None,
            "dev_target_confirmed_date": self.dev_target_confirmed_date.isoformat() if self.dev_target_confirmed_date else None,
            "dev_training_graduation_date": self.dev_training_graduation_date.isoformat() if self.dev_training_graduation_date else None,
            "probationary_date": self.probationary_date.isoformat() if self.probationary_date else None,
            "full_member_date": self.full_member_date.isoformat() if self.full_member_date else None,
            "extra_data": self.extra_data or {},
            "notes": self.notes,
            "updated_by": self.updated_by,
            "updated_by_username": updated_by_username,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_sensitive:
            d["phone"] = self.phone
            d["email"] = self.email
        return d
