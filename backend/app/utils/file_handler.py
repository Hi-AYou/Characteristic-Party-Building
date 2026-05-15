import io
import pandas as pd
from datetime import date

COLUMN_MAP = {
    "姓名": "name", "学号": "student_id", "性别": "gender",
    "院系": "department", "专业": "major", "出生日期": "birthdate",
    "学历层次": "education_type", "学历": "education_type",
    "入学年份": "enrollment_year", "入学年级": "enrollment_year",
    "拟毕业年月": "expected_graduation",
    "联系电话": "phone", "手机": "phone", "电话": "phone",
    "邮箱": "email", "电子邮件": "email",
    "政治面貌": "political_status", "当前政治面貌": "political_status",
    "党内职务": "party_role_in_branch", "党支部内职务": "party_role_in_branch",
    "是否海外交流": "is_overseas", "是否在海外": "is_overseas",
    "备注": "notes",
    # 发展进度日期
    "递交入党申请书日期": "application_date", "申请书日期": "application_date",
    "团校结业日期": "youth_league_graduation_date", "团校结业": "youth_league_graduation_date",
    "积极分子确立日期": "activist_confirmed_date", "确立积极分子日期": "activist_confirmed_date",
    "积极分子培训班结业日期": "activist_training_graduation_date",
    "积极分子培训结业": "activist_training_graduation_date",
    "发展对象确立日期": "dev_target_confirmed_date", "确立发展对象日期": "dev_target_confirmed_date",
    "发展对象培训班结业日期": "dev_training_graduation_date",
    "发展对象培训结业": "dev_training_graduation_date",
    "预备党员日期": "probationary_date", "成为预备党员日期": "probationary_date",
    "正式党员日期": "full_member_date", "转为正式党员日期": "full_member_date",
}

DATE_FIELDS = {
    "birthdate", "application_date", "youth_league_graduation_date",
    "activist_confirmed_date", "activist_training_graduation_date",
    "dev_target_confirmed_date", "dev_training_graduation_date",
    "probationary_date", "full_member_date",
}
BOOL_FIELDS = {"is_overseas"}
INT_FIELDS = {"enrollment_year"}


def _parse_date(val):
    if pd.isna(val) or val == "" or val is None:
        return None
    if isinstance(val, date):
        return val
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y年%m月%d日", "%Y%m%d"):
        try:
            from datetime import datetime
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _parse_bool(val):
    if pd.isna(val) or val is None:
        return False
    return str(val).strip().lower() in ("是", "1", "true", "yes", "y")


def import_members_from_df(df, branch_id, user_id):
    from app import db
    from app.models.member import Member

    success, errors = 0, []
    col_to_field = {}
    extra_cols = []
    for col in df.columns:
        stripped = str(col).strip()
        if stripped in COLUMN_MAP:
            col_to_field[col] = COLUMN_MAP[stripped]
        else:
            extra_cols.append(col)

    for idx, row in df.iterrows():
        row_num = idx + 2
        try:
            name, student_id = "", ""
            for col, field in col_to_field.items():
                if field == "name":
                    name = str(row[col]).strip()
                if field == "student_id":
                    student_id = str(row[col]).strip()

            if not name or not student_id or name == "nan" or student_id == "nan":
                errors.append({"row": row_num, "reason": "姓名或学号为空，跳过"})
                continue

            member = Member.query.filter_by(student_id=student_id).first()
            if member is None:
                member = Member(student_id=student_id, branch_id=branch_id)

            member.name = name
            member.branch_id = branch_id
            member.created_by = member.created_by or user_id
            member.updated_by = user_id

            for col, field in col_to_field.items():
                if col not in df.columns:
                    continue
                val = row[col]
                if field in DATE_FIELDS:
                    setattr(member, field, _parse_date(val))
                elif field in BOOL_FIELDS:
                    setattr(member, field, _parse_bool(val))
                elif field in INT_FIELDS:
                    try:
                        setattr(member, field, int(val) if not pd.isna(val) else None)
                    except (ValueError, TypeError):
                        pass
                else:
                    if not pd.isna(val):
                        setattr(member, field, str(val).strip())

            extra = {str(c): str(row[c]) for c in extra_cols if not pd.isna(row[c])}
            if extra:
                member.extra_data = {**(member.extra_data or {}), **extra}

            db.session.add(member)
            success += 1
        except Exception as e:
            errors.append({"row": row_num, "reason": str(e)})

    db.session.commit()
    return success, errors


def import_from_file(file_obj, branch_id, user_id):
    filename = file_obj.filename.lower()
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(file_obj, dtype=str)
        else:
            df = pd.read_excel(file_obj, dtype=str, engine="openpyxl")
        df = df.dropna(how="all")
        return import_members_from_df(df, branch_id, user_id)
    except Exception as e:
        return 0, [{"row": 0, "reason": f"文件解析失败：{str(e)}"}]


# ── 导出固定列定义 ────────────────────────────────────────────
EXPORT_FIXED_COLS = [
    ("branch_name",                        "党支部"),
    ("name",                               "姓名"),
    ("student_id",                         "学号"),
    ("gender",                             "性别"),
    ("department",                         "院系"),
    ("major",                              "专业"),
    ("birthdate",                          "出生日期"),
    ("education_type",                     "学历层次"),
    ("enrollment_year",                    "入学年份"),
    ("expected_graduation",                "拟毕业年月"),
    ("phone",                              "联系电话"),
    ("email",                              "邮箱"),
    ("political_status",                   "政治面貌"),
    ("party_role_in_branch",               "党支部内职务"),
    ("is_overseas",                        "是否海外交流"),
    ("current_stage",                      "当前阶段"),
    ("application_date",                   "递交入党申请书日期"),
    ("youth_league_graduation_date",       "团校结业日期"),
    ("activist_confirmed_date",            "积极分子确立日期"),
    ("activist_training_graduation_date",  "积极分子培训班结业日期"),
    ("dev_target_confirmed_date",          "发展对象确立日期"),
    ("dev_training_graduation_date",       "发展对象培训班结业日期"),
    ("probationary_date",                  "预备党员日期"),
    ("full_member_date",                   "正式党员日期"),
    ("updated_at",                         "最后更新时间"),
    ("updated_by_username",                "操作人"),
    ("notes",                              "备注"),
]

# 模板列（与导出一致，但不含系统字段）
TEMPLATE_COLS = [
    "党支部", "姓名", "学号", "性别", "院系", "专业", "出生日期",
    "学历层次", "入学年份", "拟毕业年月", "联系电话", "邮箱",
    "政治面貌", "党支部内职务", "是否海外交流",
    "递交入党申请书日期", "团校结业日期",
    "积极分子确立日期", "积极分子培训班结业日期",
    "发展对象确立日期", "发展对象培训班结业日期",
    "预备党员日期", "正式党员日期", "备注",
]


def generate_template_excel():
    """生成空模板 Excel"""
    df = pd.DataFrame(columns=TEMPLATE_COLS)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="党员信息导入模板")
        # 设置列宽
        ws = writer.sheets["党员信息导入模板"]
        for i, col in enumerate(TEMPLATE_COLS, 1):
            ws.column_dimensions[chr(64 + i) if i <= 26 else "A" + chr(64 + i - 26)].width = max(len(col) * 2, 14)
    buf.seek(0)
    return buf


def export_members_to_excel(members, include_sensitive=True):
    extra_keys = sorted({k for m in members if m.extra_data for k in m.extra_data})
    rows = []
    for m in members:
        d = m.to_dict(include_sensitive=include_sensitive)
        row = {}
        for field, label in EXPORT_FIXED_COLS:
            if not include_sensitive and field in ("phone", "email"):
                continue
            val = d.get(field, "")
            if isinstance(val, bool):
                val = "是" if val else "否"
            # 时间字段截断到日期
            if field in ("updated_at", "created_at") and val:
                val = str(val)[:10]
            row[label] = val
        for k in extra_keys:
            row[k] = (m.extra_data or {}).get(k, "")
        rows.append(row)

    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="党员信息")
    buf.seek(0)
    return buf
