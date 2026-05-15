from datetime import date, timedelta
from app.models.member import Member


def _days_since(d, as_of):
    """从 d 到 as_of 的天数"""
    if d is None:
        return None
    return (as_of - d).days


def _later(d1, d2):
    """两个条件都满足的最晚时间点"""
    if d1 is None or d2 is None:
        return None
    return max(d1, d2)


def get_progress_alerts(branch_id=None, branch_ids=None, as_of_date=None):
    """
    返回 4 类发展进度预警。
    - branch_id: 单支部（兼容旧调用）
    - branch_ids: 多支部列表（新）
    - as_of_date: 基准日期，默认今天；传入未来日期可做预判
    """
    if as_of_date is None:
        as_of_date = date.today()

    query = Member.query
    if branch_ids:
        query = query.filter(Member.branch_id.in_(branch_ids))
    elif branch_id is not None:
        query = query.filter_by(branch_id=branch_id)

    members = query.all()

    pending_activist     = []
    pending_dev_target   = []
    pending_probationary = []
    pending_full_member  = []

    for m in members:

        # ── 1. 确定为入党积极分子 ────────────────────────────
        # 条件：申请书+30天 AND 团校结业
        if (
            m.application_date
            and m.youth_league_graduation_date
            and not m.activist_confirmed_date
        ):
            earliest = _later(
                m.application_date + timedelta(days=30),
                m.youth_league_graduation_date,
            )
            days = _days_since(earliest, as_of_date)
            if days is not None and days >= 0:
                d = m.to_dict(include_sensitive=False)
                d["overdue_days"] = days
                d["eligible_since"] = earliest.isoformat()
                d["alert_type"] = "pending_activist"
                pending_activist.append(d)

        # ── 2. 确定为发展对象 ────────────────────────────────
        # 条件：积极分子+365天 AND 积极分子培训结业
        if (
            m.activist_confirmed_date
            and m.activist_training_graduation_date
            and not m.dev_target_confirmed_date
        ):
            earliest = _later(
                m.activist_confirmed_date + timedelta(days=365),
                m.activist_training_graduation_date,
            )
            days = _days_since(earliest, as_of_date)
            if days is not None and days >= 0:
                d = m.to_dict(include_sensitive=False)
                d["overdue_days"] = days
                d["eligible_since"] = earliest.isoformat()
                d["alert_type"] = "pending_dev_target"
                pending_dev_target.append(d)

        # ── 3. 接收为预备党员 ────────────────────────────────
        # 条件：发展对象确立 AND 发展对象培训结业，6个月窗口
        if (
            m.dev_target_confirmed_date
            and m.dev_training_graduation_date
            and not m.probationary_date
        ):
            window_start = _later(
                m.dev_target_confirmed_date,
                m.dev_training_graduation_date,
            )
            days = _days_since(window_start, as_of_date)
            if days is not None and 0 <= days <= 180:
                d = m.to_dict(include_sensitive=False)
                d["overdue_days"] = days
                d["days_remaining"] = 180 - days
                d["eligible_since"] = window_start.isoformat()
                d["alert_type"] = "pending_probationary"
                pending_probationary.append(d)

        # ── 4. 转正为正式党员 ────────────────────────────────
        # 条件：预备党员+365天
        if m.probationary_date and not m.full_member_date:
            eligible = m.probationary_date + timedelta(days=365)
            days = _days_since(eligible, as_of_date)
            if days is not None and days >= 0:
                d = m.to_dict(include_sensitive=False)
                d["overdue_days"] = days
                d["eligible_since"] = eligible.isoformat()
                d["alert_type"] = "pending_full_member"
                pending_full_member.append(d)

    for lst in [pending_activist, pending_dev_target, pending_probationary, pending_full_member]:
        lst.sort(key=lambda x: x.get("overdue_days", 0), reverse=True)

    return {
        "pending_activist":    pending_activist,
        "pending_dev_target":  pending_dev_target,
        "pending_probationary": pending_probationary,
        "pending_full_member": pending_full_member,
        "total_alerts": (
            len(pending_activist) + len(pending_dev_target)
            + len(pending_probationary) + len(pending_full_member)
        ),
        "as_of_date": as_of_date.isoformat(),
    }


def get_stage_counts(branch_id=None):
    query = Member.query
    if branch_id is not None:
        query = query.filter_by(branch_id=branch_id)
    members = query.all()
    counts = {
        "无": 0, "入党申请人": 0, "积极分子": 0,
        "发展对象": 0, "预备党员": 0, "正式党员": 0,
    }
    for m in members:
        stage = m.current_stage
        counts[stage] = counts.get(stage, 0) + 1
    counts["total"] = len(members)
    return counts
