import React, { useState, useEffect } from 'react'
import {
  Table, Button, Space, Modal, Form, Input, Select,
  Popconfirm, message, Tag, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons'
import AppLayout from '../components/Layout/AppLayout'
import useAuthStore from '../store/authStore'
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '../api/usersApi'
import { getBranches } from '../api/branchesApi'

const { Option } = Select

const ROLE_LABELS = {
  super_admin: { label: '超级管理员', color: 'red' },
  secretary:   { label: '党支书',     color: 'blue' },
  viewer:      { label: '普通查看',   color: 'default' },
}

export default function Users() {
  const { user: currentUser } = useAuthStore()
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [users, setUsers] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)

  // 新建/编辑用户 Modal
  const [formVisible, setFormVisible] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  // 重置密码 Modal
  const [resetVisible, setResetVisible] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetForm] = Form.useForm()
  const [resetLoading, setResetLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [uRes, bRes] = await Promise.all([getUsers(), getBranches()])
      setUsers(uRes.data)
      setBranches(bRes.data)
    } catch {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // ── 新建/编辑 ─────────────────────────────────────────────
  const handleSave = async (values) => {
    try {
      if (editing) {
        await updateUser(editing.id, values)
        message.success('更新成功')
      } else {
        await createUser(values)
        message.success('创建成功')
      }
      setFormVisible(false)
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteUser(id)
      message.success('已删除')
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.error || '删除失败')
    }
  }

  const openEdit = (u) => {
    setEditing(u)
    form.setFieldsValue({
      username: u.username,
      real_name: u.real_name,
      role: u.role,
      branch_id: u.branch_id,
      is_active: u.is_active,
      password: '',
    })
    setFormVisible(true)
  }

  // ── 重置密码 ───────────────────────────────────────────────
  const openReset = (u) => {
    setResetTarget(u)
    resetForm.resetFields()
    setResetVisible(true)
  }

  const handleReset = async (values) => {
    if (values.new_password !== values.confirm_password) {
      return message.error('两次密码不一致')
    }
    setResetLoading(true)
    try {
      const res = await resetPassword(resetTarget.id, { new_password: values.new_password })
      message.success(res.data.message)
      setResetVisible(false)
    } catch (err) {
      message.error(err.response?.data?.error || '重置失败')
    } finally {
      setResetLoading(false)
    }
  }

  // ── 表格列 ─────────────────────────────────────────────────
  const columns = [
    { title: '用户名', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'real_name' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (v) => {
        const cfg = ROLE_LABELS[v] || {}
        return <Tag color={cfg.color}>{cfg.label || v}</Tag>
      },
    },
    {
      title: '所属支部',
      dataIndex: 'branch_name',
      render: (v) => v || <span style={{ color: '#ccc' }}>全院</span>,
    },
    { title: '关联学号', dataIndex: 'student_id', render: (v) => v || '-' },
    {
      title: '状态',
      dataIndex: 'is_active',
      render: (v) => v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', render: (v) => v?.slice(0, 10) },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          {/* 重置密码：对所有 viewer 显示 */}
          {record.role === 'viewer' && (
            <Button
              type="link" size="small" icon={<KeyOutlined />}
              onClick={() => openReset(record)}
            >
              重置密码
            </Button>
          )}
          {/* 编辑/删除：仅超管可见 */}
          {isSuperAdmin && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
              <Popconfirm
                title="确认删除该用户？"
                onConfirm={() => handleDelete(record.id)}
                okText="确认" cancelText="取消"
              >
                <Button type="link" size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>
            {isSuperAdmin ? '用户管理' : '本支部成员账号'}
          </h2>
          {isSuperAdmin && (
            <Button
              type="primary" icon={<PlusOutlined />}
              onClick={() => { setEditing(null); form.resetFields(); setFormVisible(true) }}
            >
              新建用户
            </Button>
          )}
        </div>

        {!isSuperAdmin && (
          <p style={{ color: '#86909c', marginBottom: 16 }}>
            以下为本支部已注册账号的党员，您可以帮助忘记密码的成员重置密码。
          </p>
        )}

        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          bordered
          size="small"
        />

        {/* ── 新建/编辑用户 Modal（仅超管） ── */}
        <Modal
          title={editing ? '编辑用户' : '新建用户（管理员/支书）'}
          open={formVisible}
          onCancel={() => setFormVisible(false)}
          onOk={() => form.submit()}
          okText="保存"
          cancelText="取消"
        >
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="username" label="用户名" rules={[{ required: !editing }]}>
              <Input disabled={!!editing} />
            </Form.Item>
            <Form.Item name="real_name" label="真实姓名">
              <Input />
            </Form.Item>
            <Form.Item
              name="password"
              label={editing ? '新密码（留空不修改）' : '密码'}
              rules={[{ required: !editing }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item name="role" label="角色" rules={[{ required: true }]}>
              <Select>
                <Option value="super_admin">超级管理员</Option>
                <Option value="secretary">党支书</Option>
              </Select>
            </Form.Item>
            <Form.Item name="branch_id" label="所属支部（超管留空）">
              <Select allowClear>
                {branches.map(b => <Option key={b.id} value={b.id}>{b.name}</Option>)}
              </Select>
            </Form.Item>
            {editing && (
              <Form.Item name="is_active" label="账号状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            )}
          </Form>
        </Modal>

        {/* ── 重置密码 Modal ── */}
        <Modal
          title={`重置密码：${resetTarget?.real_name || resetTarget?.username}`}
          open={resetVisible}
          onCancel={() => setResetVisible(false)}
          footer={null}
          destroyOnHidden
        >
          <Form form={resetForm} layout="vertical" onFinish={handleReset}>
            <Form.Item
              name="new_password"
              label="新密码"
              rules={[{ required: true }, { min: 6, message: '至少6位' }]}
            >
              <Input.Password placeholder="至少6位" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              label="确认新密码"
              rules={[{ required: true }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
              <Button onClick={() => setResetVisible(false)} style={{ marginRight: 8 }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={resetLoading}>确认重置</Button>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AppLayout>
  )
}
