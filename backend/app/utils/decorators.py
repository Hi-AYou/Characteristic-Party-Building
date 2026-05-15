from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt


def role_required(*allowed_roles):
    """验证 JWT 并检查角色"""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get("role") not in allowed_roles:
                return jsonify({"error": "权限不足"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def branch_access_required(fn):
    """
    支书只能操作本支部的资源。
    使用时需要在路由函数中从 URL 参数或请求体取得 branch_id，
    本装饰器在 JWT 中校验。
    超管可操作任意支部。
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        role = claims.get("role")
        token_branch_id = claims.get("branch_id")

        # 从 URL kwargs 或者 request.json 获取 branch_id
        resource_branch_id = kwargs.get("branch_id")

        if role == "super_admin":
            return fn(*args, **kwargs)

        if role in ("secretary", "viewer") and resource_branch_id is not None:
            if token_branch_id != resource_branch_id:
                return jsonify({"error": "无权访问其他支部数据"}), 403

        return fn(*args, **kwargs)
    return wrapper
