from app import db
from datetime import datetime


class Branch(db.Model):
    """党支部"""
    __tablename__ = "branches"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    members = db.relationship("Member", backref="branch", lazy="dynamic")
    users = db.relationship("User", backref="branch", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def summary_dict(self):
        """含各阶段人数的概况"""
        members = self.members.all()
        counts = {
            "入党申请人": 0,
            "积极分子": 0,
            "发展对象": 0,
            "预备党员": 0,
            "正式党员": 0,
        }
        for m in members:
            stage = m.current_stage
            if stage in counts:
                counts[stage] += 1

        # 找支书
        secretary = (
            self.users.filter_by(role="secretary").first()
        )
        return {
            **self.to_dict(),
            "total_members": len(members),
            "stage_counts": counts,
            "secretary_name": secretary.real_name if secretary else "",
            "secretary_username": secretary.username if secretary else "",
        }
