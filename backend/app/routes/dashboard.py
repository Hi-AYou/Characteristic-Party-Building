from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from app.models.branch import Branch
from app.models.member import Member
from app.utils.progress import get_stage_counts, get_progress_alerts

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dashboard_bp.route("/stats", methods=["GET"])
@jwt_required()
def stats():
    claims = get_jwt()
    role = claims.get("role")
    branch_id = claims.get("branch_id")

    if role == "super_admin":
        # 全院统计
        total_counts = get_stage_counts()
        # 各支部统计
        branches = Branch.query.all()
        branch_stats = []
        for b in branches:
            branch_stats.append({
                "branch_id": b.id,
                "branch_name": b.name,
                **get_stage_counts(b.id),
            })
    else:
        total_counts = get_stage_counts(branch_id)
        branch_stats = []

    # 预警数量（用于 badge）
    alert_branch_id = None if role == "super_admin" else branch_id
    alerts = get_progress_alerts(alert_branch_id)
    alert_counts = {
        "pending_activist": len(alerts["pending_activist"]),
        "pending_dev_target": len(alerts["pending_dev_target"]),
        "pending_probationary": len(alerts["pending_probationary"]),
        "pending_full_member": len(alerts["pending_full_member"]),
        "total": alerts["total_alerts"],
    }

    return jsonify({
        "stage_counts": total_counts,
        "branch_stats": branch_stats,
        "alert_counts": alert_counts,
    }), 200
