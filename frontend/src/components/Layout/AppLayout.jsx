import React, { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Typography, Badge, Modal, Form, Input, Button, message } from 'antd'
import {
  DashboardOutlined, TeamOutlined, ClockCircleOutlined,
  BranchesOutlined, UserOutlined, LogoutOutlined, KeyOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { changePassword } from '../../api/authApi'

const { Sider, Header, Content } = Layout
const { Text } = Typography

const ROLE_LABEL = {
  super_admin: '超级管理员',
  secretary: '党支书',
  viewer: '普通查看',
}

export default function AppLayout({ children, alertCount = 0 }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [changePwdVisible, setChangePwdVisible] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [form] = Form.useForm()

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '首页概览' },
    { key: '/members', icon: <TeamOutlined />, label: '党员信息' },
    {
      key: '/progress',
      icon: <ClockCircleOutlined />,
      label: (
        <span>
          发展进度
          {alertCount > 0 && (
            <Badge count={alertCount} size="small" style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
    },
    { key: '/branches', icon: <BranchesOutlined />, label: '支部概况' },
    ...(['super_admin', 'secretary'].includes(user?.role)
      ? [{ key: '/users', icon: <UserOutlined />, label: user?.role === 'secretary' ? '成员账号' : '用户管理' }]
      : []),
  ]

  const userMenu = {
    items: [
      { key: 'change-pwd', icon: <KeyOutlined />, label: '修改密码' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout()
        navigate('/login')
      } else if (key === 'change-pwd') {
        setChangePwdVisible(true)
      }
    },
  }

  const handleChangePwd = async (values) => {
    if (values.new_password !== values.confirm_password) {
      return message.error('两次新密码不一致')
    }
    setPwdLoading(true)
    try {
      await changePassword({ old_password: values.old_password, new_password: values.new_password })
      message.success('密码已更新')
      form.resetFields()
      setChangePwdVisible(false)
    } catch (err) {
      message.error(err.response?.data?.error || '修改失败')
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 'bold', fontSize: collapsed ? 12 : 14,
          borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0 8px',
          textAlign: 'center', lineHeight: 1.4, whiteSpace: 'pre-line',
        }}>
          {collapsed ? '党支部' : '大数据学院\n党支部系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff', padding: '0 24px',
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
              <span>
                <Text strong>{user?.real_name || user?.username}</Text>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                  {ROLE_LABEL[user?.role]}
                </Text>
              </span>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ margin: 24, background: '#f5f6fa', borderRadius: 8 }}>
          {children}
        </Content>
      </Layout>

      {/* 修改密码 Modal */}
      <Modal
        title="修改密码"
        open={changePwdVisible}
        onCancel={() => { setChangePwdVisible(false); form.resetFields() }}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleChangePwd}>
          <Form.Item name="old_password" label="旧密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6, message: '至少6位' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirm_password" label="确认新密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Button onClick={() => setChangePwdVisible(false)} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit" loading={pwdLoading}>保存</Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
