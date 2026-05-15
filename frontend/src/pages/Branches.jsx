import React, { useState, useEffect } from 'react'
import {
  Table, Button, Space, Modal, Form, Input, Popconfirm, message, Tag,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import AppLayout from '../components/Layout/AppLayout'
import useAuthStore from '../store/authStore'
import { getBranchesSummary, createBranch, updateBranch, deleteBranch } from '../api/branchesApi'

const STAGE_KEYS = ['入党申请人','积极分子','发展对象','预备党员','正式党员']

export default function Branches() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  const fetchBranches = async () => {
    setLoading(true)
    try {
      const res = await getBranchesSummary()
      setBranches(res.data)
    } catch {
      message.error('获取支部数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBranches() }, [])

  const handleSave = async (values) => {
    try {
      if (editing) {
        await updateBranch(editing.id, values)
        message.success('更新成功')
      } else {
        await createBranch(values)
        message.success('创建成功')
      }
      setFormVisible(false)
      fetchBranches()
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteBranch(id)
      message.success('已删除')
      fetchBranches()
    } catch (err) {
      message.error(err.response?.data?.error || '删除失败')
    }
  }

  const openEdit = (branch) => {
    setEditing(branch)
    form.setFieldsValue({ name: branch.name, description: branch.description })
    setFormVisible(true)
  }

  const columns = [
    { title: '支部名称', dataIndex: 'name', width: 200 },
    { title: '党支书', dataIndex: 'secretary_name', width: 100, render: v => v || '-' },
    ...STAGE_KEYS.map(k => ({
      title: k,
      width: 90,
      render: (_, r) => {
        const cnt = r.stage_counts?.[k] || 0
        return cnt > 0 ? <Tag>{cnt}</Tag> : <span style={{ color: '#ccc' }}>0</span>
      },
    })),
    {
      title: '合计',
      dataIndex: 'total_members',
      width: 70,
      render: v => <strong>{v}</strong>,
    },
    { title: '简介', dataIndex: 'description', ellipsis: true },
    ...(isSuperAdmin ? [{
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title="确认删除？该支部下须无党员才能删除。"
            onConfirm={() => handleDelete(record.id)}
            okText="确认" cancelText="取消"
          >
            <Button type="link" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ]

  return (
    <AppLayout>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>各支部概况</h2>
          {isSuperAdmin && (
            <Button
              type="primary" icon={<PlusOutlined />}
              onClick={() => { setEditing(null); form.resetFields(); setFormVisible(true) }}
            >
              新建支部
            </Button>
          )}
        </div>

        <Table
          dataSource={branches}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          bordered
          summary={(data) => {
            const totals = STAGE_KEYS.reduce((acc, k) => {
              acc[k] = data.reduce((s, r) => s + (r.stage_counts?.[k] || 0), 0)
              return acc
            }, {})
            const grand = data.reduce((s, r) => s + (r.total_members || 0), 0)
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell><strong>合计</strong></Table.Summary.Cell>
                <Table.Summary.Cell />
                {STAGE_KEYS.map(k => (
                  <Table.Summary.Cell key={k}>
                    <strong>{totals[k]}</strong>
                  </Table.Summary.Cell>
                ))}
                <Table.Summary.Cell><strong>{grand}</strong></Table.Summary.Cell>
                <Table.Summary.Cell />
                {isSuperAdmin && <Table.Summary.Cell />}
              </Table.Summary.Row>
            )
          }}
        />

        <Modal
          title={editing ? '编辑支部' : '新建支部'}
          open={formVisible}
          onCancel={() => setFormVisible(false)}
          onOk={() => form.submit()}
          okText="保存"
          cancelText="取消"
        >
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="name" label="支部名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label="简介">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AppLayout>
  )
}
