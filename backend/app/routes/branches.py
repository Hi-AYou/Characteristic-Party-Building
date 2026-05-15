from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from app import db
from app.models.branch import Branch
from app.utils.decorators import role_required

branches_bp = Blueprint("branches", __name__, url_prefix="/api/branches")


def _get_claims():
    return get_jwt()


@branches_bp.route("/", methods=["GET"])
@jwt_required()
def list_branches():
    claims = _get_claims()
    role = claims.get("role")
    branch_id = claims.get("branch_id")

    if role == "super_admin":
        branches = Branch.query.order_by(Branch.name).all()
    else:
        branches = Branch.query.filter_by(id=branch_id).all()

    return jsonify([b.to_dict() for b in branches]), 200


@branches_bp.route("/summary", methods=["GET"])
@jwt_required()
def branches_summary():
    claims = _get_claims()
    role = claims.get("role")
    branch_id = claims.get("branch_id")

    if role == "super_admin":
        branches = Branch.query.order_by(Branch.name).all()
    else:
        branches = Branch.query.filter_by(id=branch_id).all()

    return jsonify([b.summary_dict() for b in branches]), 200


@branches_bp.route("/", methods=["POST"])
@role_required("super_admin")
def create_branch():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "支部名称不能为空"}), 400
    if Branch.query.filter_by(name=name).first():
        return jsonify({"error": "支部名称已存在"}), 409
    branch = Branch(name=name, description=data.get("description", ""))
    db.session.add(branch)
    db.session.commit()
    return jsonify(branch.to_dict()), 201


@branches_bp.route("/<int:branch_id>", methods=["PUT"])
@role_required("super_admin")
def update_branch(branch_id):
    branch = Branch.query.get_or_404(branch_id)
    data = request.get_json()
    if "name" in data:
        branch.name = data["name"].strip()
    if "description" in data:
        branch.description = data["description"]
    db.session.commit()
    return jsonify(branch.to_dict()), 200


@branches_bp.route("/<int:branch_id>", methods=["DELETE"])
@role_required("super_admin")
def delete_branch(branch_id):
    branch = Branch.query.get_or_404(branch_id)
    if branch.members.count() > 0:
        return jsonify({"error": "该支部下还有党员，无法删除"}), 400
    db.session.delete(branch)
    db.session.commit()
    return jsonify({"message": "删除成功"}), 200
