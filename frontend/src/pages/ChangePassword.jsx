import React, { useState } from 'react'
import { Modal, Form, Input, Button, message } from 'antd'
import { changePassword } from '../api/authApi'

export default function ChangePasswordModal({ visible, onClose }) {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const onFinish = async (values) => {
    if (values.new_password !== values.confirm_password) {
      return message.error('两次新密码不一致')
    }
    setLoading(true)
    try {
      await changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
      })
      message.success('密码已更新，请重新登录')
      form.resetFields()
      onClose()
    } catch (err) {
      message.error(err.response?.data?.error || '修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="修改密码"
      open={visible}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="old_password" label="旧密码" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6 }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="confirm_password" label="确认新密码" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>取消</Button>
          <Button type="primary" htmlType="submit" loading={loading}>保存</Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
