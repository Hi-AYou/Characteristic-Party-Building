import React, { useState } from 'react'
import { Form, Input, Button, Card, Typography, message, Alert } from 'antd'
import {
  UserOutlined, IdcardOutlined, LockOutlined, SolutionOutlined,
} from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/authApi'

const { Title, Text } = Typography

export default function Register() {
  const [loading, setLoading] = useState(false)
  const [successBranch, setSuccessBranch] = useState(null)
  const navigate = useNavigate()

  const onFinish = async (values) => {
    if (values.password !== values.confirm_password) {
      return message.error('两次输入的密码不一致')
    }
    setLoading(true)
    try {
      const res = await register({
        real_name:  values.real_name,
        student_id: values.student_id,
        username:   values.username,
        password:   values.password,
      })
      setSuccessBranch(res.data.branch_name)
    } catch (err) {
      message.error(err.response?.data?.error || '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1677ff 0%, #003eb3 100%)',
    }}>
      <Card style={{ width: 420, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: '#1677ff' }}>复旦大学大数据学院</Title>
          <Text type="secondary">党支部信息管理系统 · 党员注册</Text>
        </div>

        {successBranch ? (
          <div>
            <Alert
              type="success"
              showIcon
              message="注册成功！"
              description={
                <span>
                  您已成功注册并加入 <strong>{successBranch}</strong>。
                  现在可以用您设置的用户名登录查看本支部信息。
                </span>
              }
              style={{ marginBottom: 16 }}
            />
            <Button type="primary" block onClick={() => navigate('/login')}>
              前往登录
            </Button>
          </div>
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              message="仅限已录入系统的党员注册"
              description="您的姓名和学号须与系统中的党员信息一致，否则无法注册。"
              style={{ marginBottom: 20 }}
            />

            <Form onFinish={onFinish} layout="vertical" size="large" autoComplete="off">
              <Form.Item
                name="real_name"
                label="真实姓名"
                rules={[{ required: true, message: '请输入真实姓名（与学籍一致）' }]}
              >
                <Input prefix={<SolutionOutlined />} placeholder="请输入真实姓名" />
              </Form.Item>

              <Form.Item
                name="student_id"
                label="学号"
                rules={[{ required: true, message: '请输入学号' }]}
              >
                <Input prefix={<IdcardOutlined />} placeholder="请输入学号" />
              </Form.Item>

              <Form.Item
                name="username"
                label="登录用户名"
                rules={[
                  { required: true, message: '请设置登录用户名' },
                  { min: 3, message: '用户名至少3位' },
                  { pattern: /^[a-zA-Z0-9_一-龥]+$/, message: '用户名只能包含字母、数字、下划线或中文' },
                ]}
              >
                <Input prefix={<UserOutlined />} placeholder="自定义登录用户名" />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请设置密码' }, { min: 6, message: '密码至少6位' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="至少6位" />
              </Form.Item>

              <Form.Item
                name="confirm_password"
                label="确认密码"
                rules={[{ required: true, message: '请再次输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="再次输入密码" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 8 }}>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  注册
                </Button>
              </Form.Item>

              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">已有账号？</Text>{' '}
                <Link to="/login">返回登录</Link>
              </div>
            </Form>
          </>
        )}
      </Card>
    </div>
  )
}
