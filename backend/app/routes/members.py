from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import db
from app.models.member import Member
from app.utils.decorators import role_required
from app.utils.progress import get_progress_alerts
from app.utils.file_handler import import_from_file, export_members_to_excel, generate_template_excel
from datetime import date, datetime

members_bp = Blueprint("members", __name__, url_prefix="/api/members")

# 允许批量修改的字段白名单
BATCH_ALLOWED_FIELDS = {
    "application_date", "youth_league_graduation_date",
    "activist_confirmed_date", "activist_committee_filing_date",
    "activist_training_graduation_date",
    "dev_target_confirmed_date", "dev_training_graduation_date",
    "probationary_committee_pre_review_date", "probationary_committee_approval_date",
    "probationary_date", "party_oath_date",
    "full_member_committee_pre_review_date", "full_member_branch_meeting_date",
    "full_member_committee_approval_date", "full_member_date",
    "expected_graduation",
    "is_overseas", "retain_party_membership",
}

DATE_FIELDS = [
    "birthdate", "application_date", "youth_league_graduation_date",
    "activist_confirmed_date", "activist_committee_filing_date",
    "activist_training_graduation_date",
    "dev_target_confirmed_date", "dev_training_graduation_date",
    "probationary_committee_pre_review_date", "probationary_committee_approval_date",
    "probationary_date", "party_oath_date",
    "full_member_committee_pre_review_date", "full_member_branch_meeting_date",
    "full_member_committee_approval_date", "full_member_date",
]
STRING_FIELDS = [
    "name", "gender", "department", "major", "education_type",
    "phone", "email", "party_role_in_branch",
    "notes", "expected_graduation",
]


def _build_query(claims):
    role = claims.get("role")
    branch_id = claims.get("branch_id")
    q = Member.query
    if role in ("secretary", "viewer"):
        q = q.filter_by(branch_id=branch_id)
    return q, role


def _training_status(member, kind):
    """团校 / 积极分子班 / 发展对象班 培训状态"""
    if kind == "youth_league":
        graduation, confirmed = member.youth_league_graduation_date, member.application_date
    elif kind == "activist":
        graduation = member.activist_training_graduation_date
        confirmed = member.activist_confirmed_date
    elif kind == "dev":
        graduation = member.dev_training_graduation_date
        confirmed = member.dev_target_confirmed_date
    else:
        return None
    if graduation:
        return "已结业"
    if confirmed:
        return "培训中"
    return "未培训"


def _apply_post_query_filters(members, args):
    """阶段、培训班状态等需在查询结果上二次筛选"""
    stage_filter = args.get("stages") or args.get("stage")
    if stage_filter:
        stages = [s.strip() for s in stage_filter.split(",") if s.strip()]
        if stages:
            members = [m for m in members if m.current_stage in stages]
    for param, kind in (
        ("youth_league_training_status", "youth_league"),
        ("activist_training_status", "activist"),
        ("dev_training_status", "dev"),
    ):
        status = args.get(param)
        if status:
            members = [m for m in members if _training_status(m, kind) == status]
    return members


def _apply_filters(q, args):
    # 支部（支持多个，逗号分隔）
    branch_ids = args.get("branch_ids")
    if branch_ids:
        ids = [int(x) for x in branch_ids.split(",") if x.strip()]
        if ids:
            q = q.filter(Member.branch_id.in_(ids))
    elif args.get("branch_id"):
        q = q.filter_by(branch_id=int(args["branch_id"]))

    # 学历（支持多个，逗号分隔）
    edu_types = args.get("education_types")
    if edu_types:
        types = [x.strip() for x in edu_types.split(",") if x.strip()]
        if types:
            q = q.filter(Member.education_type.in_(types))
    elif args.get("education_type"):
        q = q.filter_by(education_type=args["education_type"])

    if args.get("enrollment_year"):
        q = q.filter_by(enrollment_year=int(args["enrollment_year"]))
    if args.get("gender"):
        q = q.filter_by(gender=args["gender"])
    if args.get("department"):
        q = q.filter_by(department=args["department"])
    if args.get("party_role_in_branch"):
        q = q.filter_by(party_role_in_branch=args["party_role_in_branch"])
    if args.get("is_overseas") is not None and args.get("is_overseas") != "":
        q = q.filter_by(is_overseas=args["is_overseas"] == "true")
    if args.get("retain_party_membership") is not None and args.get("retain_party_membership") != "":
        q = q.filter_by(retain_party_membership=args["retain_party_membership"] == "true")
    if args.get("search"):
        kw = f"%{args['search']}%"
        q = q.filter(db.or_(Member.name.ilike(kw), Member.student_id.ilike(kw)))

    # 申请书日期范围
    if args.get("application_date_start"):
        q = q.filter(Member.application_date >= args["application_date_start"])
    if args.get("application_date_end"):
        q = q.filter(Member.application_date <= args["application_date_end"])

    # 拟毕业年月范围（字符串比较，格式 YYYY-MM）
    if args.get("graduation_start"):
        q = q.filter(Member.expected_graduation >= args["graduation_start"])
    if args.get("graduation_end"):
        q = q.filter(Member.expected_graduation <= args["graduation_end"])

    return q


def _parse_date_str(s):
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _member_from_data(data, user_id):
    member = Member(
        branch_id=data["branch_id"],
        name=data["name"],
        student_id=data["student_id"],
        created_by=user_id,
        updated_by=user_id,
    )
    _update_member_fields(member, data)
    return member


def _update_member_fields(member, data):
    for f in STRING_FIELDS:
        if f in data:
            setattr(member, f, data[f])
    for f in DATE_FIELDS:
        if f in data:
            setattr(member, f, _parse_date_str(data[f]))
    if "enrollment_year" in data:
        member.enrollment_year = data["enrollment_year"]
    if "is_overseas" in data:
        member.is_overseas = bool(data["is_overseas"])
    if "retain_party_membership" in data:
        member.retain_party_membership = bool(data["retain_party_membership"])
    if "extra_data" in data and isinstance(data["extra_data"], dict):
        member.extra_data = data["extra_data"]


# ── 路由 ──────────────────────────────────────────────────────

@members_bp.route("/", methods=["GET"])
@jwt_required()
def list_members():
    claims = get_jwt()
    q, role = _build_query(claims)
    q = _apply_filters(q, request.args)
    members = q.order_by(Member.name).all()

    include_sensitive = role in ("super_admin", "secretary")

    members = _apply_post_query_filters(members, request.args)

    return jsonify({
        "total": len(members),
        "members": [m.to_dict(include_sensitive=include_sensitive) for m in members],
    }), 200


@members_bp.route("/<int:member_id>", methods=["GET"])
@jwt_required()
def get_member(member_id):
    claims = get_jwt()
    role = claims.get("role")
    branch_id = claims.get("branch_id")
    member = Member.query.get_or_404(member_id)
    if role in ("secretary", "viewer") and member.branch_id != branch_id:
        return jsonify({"error": "无权访问"}), 403
    include_sensitive = role in ("super_admin", "secretary")
    return jsonify(member.to_dict(include_sensitive=include_sensitive)), 200


@members_bp.route("/", methods=["POST"])
@jwt_required()
def create_member():
    claims = get_jwt()
    role = claims.get("role")
    if role == "viewer":
        return jsonify({"error": "权限不足"}), 403
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if role == "secretary":
        data["branch_id"] = claims.get("branch_id")
    if not data.get("name") or not data.get("student_id") or not data.get("branch_id"):
        return jsonify({"error": "姓名、学号、支部不能为空"}), 400
    if Member.query.filter_by(student_id=data["student_id"]).first():
        return jsonify({"error": "该学号已存在"}), 409
    member = _member_from_data(data, user_id)
    db.session.add(member)
    db.session.commit()
    return jsonify(member.to_dict()), 201


@members_bp.route("/<int:member_id>", methods=["PUT"])
@jwt_required()
def update_member(member_id):
    claims = get_jwt()
    role = claims.get("role")
    branch_id = claims.get("branch_id")
    if role == "viewer":
        return jsonify({"error": "权限不足"}), 403
    member = Member.query.get_or_404(member_id)
    if role == "secretary" and member.branch_id != branch_id:
        return jsonify({"error": "无权修改其他支部党员"}), 403
    user_id = int(get_jwt_identity())
    data = request.get_json()
    _update_member_fields(member, data)
    member.updated_by = user_id
    db.session.commit()
    return jsonify(member.to_dict()), 200


@members_bp.route("/<int:member_id>", methods=["DELETE"])
@jwt_required()
def delete_member(member_id):
    claims = get_jwt()
    role = claims.get("role")
    branch_id = claims.get("branch_id")
    if role == "viewer":
        return jsonify({"error": "权限不足"}), 403
    member = Member.query.get_or_404(member_id)
    if role == "secretary" and member.branch_id != branch_id:
        return jsonify({"error": "无权删除其他支部党员"}), 403
    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": "已删除"}), 200


@members_bp.route("/batch-update", methods=["PATCH"])
@jwt_required()
def batch_update():
    """批量修改多名党员的指定字段"""
    claims = get_jwt()
    role = claims.get("role")
    branch_id = claims.get("branch_id")
    if role == "viewer":
        return jsonify({"error": "权限不足"}), 403

    data = request.get_json()
    ids = data.get("ids", [])
    fields = data.get("fields", {})

    if not ids:
        return jsonify({"error": "未指定党员"}), 400
    if not fields:
        return jsonify({"error": "未指定修改字段"}), 400

    # 校验字段白名单
    bad_fields = set(fields.keys()) - BATCH_ALLOWED_FIELDS
    if bad_fields:
        return jsonify({"error": f"不允许批量修改字段：{bad_fields}"}), 400

    user_id = int(get_jwt_identity())
    updated = 0
    for mid in ids:
        member = Member.query.get(mid)
        if not member:
            continue
        if role == "secretary" and member.branch_id != branch_id:
            continue  # 支书跳过越权记录
        for f, v in fields.items():
            if f in DATE_FIELDS:
                setattr(member, f, _parse_date_str(v))
            elif f in ("is_overseas", "retain_party_membership"):
                setattr(member, f, bool(v))
            else:
                setattr(member, f, v)
        member.updated_by = user_id
        updated += 1

    db.session.commit()
    return jsonify({"message": f"已更新 {updated} 条记录"}), 200


@members_bp.route("/template", methods=["GET"])
@jwt_required()
def download_template():
    """下载 Excel 导入模板"""
    buf = generate_template_excel()
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="党员信息导入模板.xlsx",
    )


@members_bp.route("/import", methods=["POST"])
@jwt_required()
def import_members():
    claims = get_jwt()
    role = claims.get("role")
    if role == "viewer":
        return jsonify({"error": "权限不足"}), 403
    if "file" not in request.files:
        return jsonify({"error": "未上传文件"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "文件名为空"}), 400
    user_id = int(get_jwt_identity())
    if role == "secretary":
        branch_id = claims.get("branch_id")
    else:
        branch_id = request.form.get("branch_id")
        if not branch_id:
            return jsonify({"error": "超管导入需指定 branch_id"}), 400
        branch_id = int(branch_id)
    success, errors = import_from_file(file, branch_id, user_id)
    return jsonify({
        "message": f"成功导入 {success} 条记录",
        "success_count": success,
        "errors": errors,
    }), 200


@members_bp.route("/export", methods=["GET"])
@jwt_required()
def export_members():
    claims = get_jwt()
    role = claims.get("role")
    if role == "viewer":
        return jsonify({"error": "权限不足"}), 403

    q, _ = _build_query(claims)
    q = _apply_filters(q, request.args)
    members = q.order_by(Member.name).all()

    members = _apply_post_query_filters(members, request.args)

    # 按预警类型筛选（从 progress 模块过滤）
    alert_type = request.args.get("alert_type")
    as_of_str = request.args.get("as_of_date")
    if alert_type:
        as_of = date.fromisoformat(as_of_str) if as_of_str else date.today()
        # 取出对应预警列表中的 id 集合
        branch_ids_param = request.args.get("branch_ids")
        b_ids = [int(x) for x in branch_ids_param.split(",") if x.strip()] if branch_ids_param else None
        alerts = get_progress_alerts(branch_ids=b_ids, as_of_date=as_of)
        alert_ids = {m["id"] for m in alerts.get(alert_type, [])}
        members = [m for m in members if m.id in alert_ids]

    include_sensitive = role in ("super_admin", "secretary")
    buf = export_members_to_excel(members, include_sensitive=include_sensitive)
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="党员信息.xlsx",
    )


@members_bp.route("/progress", methods=["GET"])
@jwt_required()
def member_progress():
    claims = get_jwt()
    role = claims.get("role")
    branch_id = claims.get("branch_id")
    if role == "viewer":
        return jsonify({"error": "权限不足"}), 403

    # 解析 as_of_date
    as_of_str = request.args.get("as_of_date")
    as_of = date.fromisoformat(as_of_str) if as_of_str else date.today()

    # 超管支持多支部（逗号分隔）
    if role == "super_admin":
        branch_ids_param = request.args.get("branch_ids")
        if branch_ids_param:
            b_ids = [int(x) for x in branch_ids_param.split(",") if x.strip()]
        else:
            b_ids = None
        alerts = get_progress_alerts(branch_ids=b_ids, as_of_date=as_of)
    else:
        alerts = get_progress_alerts(branch_id=branch_id, as_of_date=as_of)

    return jsonify(alerts), 200
