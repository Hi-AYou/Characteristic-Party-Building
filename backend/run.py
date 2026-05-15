import click
from app import create_app, db

app = create_app()


@app.cli.command("reset-admin")
@click.option("--username", prompt="管理员用户名", help="要重置密码的超管用户名")
@click.option("--password", prompt=True, hide_input=True,
              confirmation_prompt="再次输入新密码确认", help="新密码（至少6位）")
def reset_admin(username, password):
    """
    紧急重置超级管理员密码（须在服务器上通过 SSH 执行）。

    用法：
        flask reset-admin
        flask reset-admin --username admin --password 新密码
    """
    from app.models.user import User
    import bcrypt

    if len(password) < 6:
        click.echo("❌ 密码至少需要6位", err=True)
        raise SystemExit(1)

    with app.app_context():
        user = User.query.filter_by(username=username).first()
        if not user:
            click.echo(f"❌ 用户 '{username}' 不存在", err=True)
            raise SystemExit(1)

        if user.role != "super_admin":
            click.echo(
                f"⚠️  '{username}' 的角色是 '{user.role}'，不是超级管理员。\n"
                "   如需重置普通用户密码，请登录系统后在「用户管理」中操作。",
                err=True,
            )
            raise SystemExit(1)

        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user.update_password(hashed)
        db.session.commit()

    click.echo(f"✅ 用户 '{username}' 的密码已重置，所有已登录的旧 token 即刻失效。")
    click.echo("   请立即使用新密码登录，并妥善保管。")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
