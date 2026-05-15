import React, { useEffect, useState } from 'react'
import {
  Modal, Form, Input, Select, DatePicker, Row, Col,
  Switch, message, Button, Divider, Tag,
} from 'antd'
import dayjs from 'dayjs'
import useAuthStore from '../store/authStore'
import { createMember, updateMember } from '../api/membersApi'

const { Option } = Select

const POLITICAL_STATUS_OPTIONS = [
  '入党申请人', '入党积极分子', '发展对象', '中共预备党员', '正式党员',
]

function TrainingStatusTag({ graduationDate, confirmedDate }) {
  if (graduationDate) return <Tag color="success">已结业</Tag>
  if (confirmedDate)  return <Tag color="processing">培训中</Tag>
  return <Tag color="default">未参加</Tag>
}

// 普通日期字段（不含培训班结业，单独处理）
const DATE_FIELDS = [
  'birthdate', 'application_date',
  'activist_confirmed_date', 'dev_target_confirmed_date',
  'probationary_date', 'full_member_date',
]

// 三个培训班结业日期字段
const TRAINING_FIELDS = [
  { field: 'youth_league_graduation_date',          label: '团校',          confirmedField: 'application_date' },
  { field: 'activist_training_graduation_date',     label: '积极分子培训班', confirmedField: 'activist_confirmed_date' },
  { field: 'dev_training_graduation_date',          label: '发展对象培训班', confirmedField: 'dev_target_confirmed_date' },
]

export default function MemberForm({ visible, viewOnly, initialValues, branches, onClose, onSuccess }) {
  const [form] = Form.useForm()
  const { user } = useAuthStore()
  const isEdit = !!initialValues?.id

  // 培训班结业 Switch 状态
  const [trainingStatus, setTrainingStatus] = useState({
    youth_league_graduation_date: false,
    activist_training_graduation_date: false,
    dev_training_graduation_date: false,
  })

  useEffect(() => {
    if (!visible) return
    if (initialValues) {
      const vals = { ...initialValues }
      DATE_FIELDS.forEach(f => {
        if (vals[f]) vals[f] = dayjs(vals[f])
      })
      TRAINING_FIELDS.forEach(({ field }) => {
        if (vals[field]) vals[field] = dayjs(vals[field])
      })
      if (vals.expected_graduation) {
        vals.expected_graduation = dayjs(vals.expected_graduation, 'YYYY-MM')
      }
      form.setFieldsValue(vals)
      // 同步培训班 Switch
      const ts = {}
      TRAINING_FIELDS.forEach(({ field }) => {
        ts[field] = !!initialValues[field]
      })
      setTrainingStatus(ts)
    } else {
      form.resetFields()
      setTrainingStatus({
        youth_league_graduation_date: false,
        activist_training_graduation_date: false,
        dev_training_graduation_date: false,
      })
      if (user?.role !== 'super_admin') {
        form.setFieldValue('branch_id', user?.branch_id)
      }
    }
  }, [visible, initialValues])

  const onFinish = async (values) => {
    const data = { ...values }
    DATE_FIELDS.forEach(f => {
      if (data[f]) data[f] = data[f].format('YYYY-MM-DD')
    })
    TRAINING_FIELDS.forEach(({ field }) => {
      if (data[field]) {
        data[field] = data[field].format('YYYY-MM-DD')
      } else {
        data[field] = null  // Switch 关闭 → 清空日期
      }
    })
    if (data.expected_graduation) {
      data.expected_graduation = data.expected_graduation.format('YYYY-MM')
    }
    try {
      if (isEdit) {
        await updateMember(initialValues.id, data)
        message.success('更新成功')
      } else {
        await createMember(data)
        message.success('新增成功')
      }
      onSuccess()
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  const toggleTraining = (field, checked) => {
    setTrainingStatus(s => ({ ...s, [field]: checked }))
    if (!checked) form.setFieldValue(field, null)
  }

  return (
    <Modal
      title={viewOnly ? '查看党员信息' : (isEdit ? '编辑党员' : '新增党员')}
      open={visible}
      onCancel={onClose}
      width={860}
      footer={viewOnly ? [<Button key="close" onClick={onClose}>关闭</Button>] : null}
      destroyOnHidden
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto', paddingRight: 8 } }}
    >
      <Form form={form} layout="vertical" onFinish={onFinish} disabled={viewOnly}>

        {/* ── 基本信息 ─────────────────────────────────── */}
        <Divider orientation="left" style={{ fontSize: 13, color: '#86909c', margin: '4px 0 12px' }}>基本信息</Divider>
        <Row gutter={16}>
          {user?.role === 'super_admin' && (
            <Col span={12}>
              <Form.Item name="branch_id" label="党支部" rules={[{ required: true }]}>
                <Select placeholder="选择党支部">
                  {branches.map(b => <Option key={b.id} value={b.id}>{b.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          )}
          <Col span={12}>
            <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="student_id" label="学号" rules={[{ required: true }]}>
              <Input disabled={isEdit} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="gender" label="性别">
              <Select allowClear>
                <Option value="男">男</Option>
                <Option value="女">女</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="birthdate" label="出生日期">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="education_type" label="学历层次">
              <Select allowClear>
                {['本科','硕士','博士'].map(v => <Option key={v} value={v}>{v}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="department" label="院系">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="major" label="专业">
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="enrollment_year" label="入学年份">
              <Input type="number" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="expected_graduation" label="拟毕业年月">
              <DatePicker picker="month" style={{ width: '100%' }} format="YYYY-MM" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="is_overseas" label="是否海外交流" valuePropName="checked">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="联系电话">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="邮箱">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="political_status" label="政治面貌">
              <Select allowClear placeholder="请选择">
                {POLITICAL_STATUS_OPTIONS.map(o => <Option key={o} value={o}>{o}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="party_role_in_branch" label="党支部内职务">
              <Input placeholder="如：党支书、组织委员" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── 发展进度日期 ────────────────────────────── */}
        <Divider orientation="left" style={{ fontSize: 13, color: '#86909c', margin: '4px 0 12px' }}>发展进度</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="application_date" label="递交入党申请书日期">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="activist_confirmed_date" label="确定为入党积极分子日期">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dev_target_confirmed_date" label="确定为发展对象日期">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="probationary_date" label="接收为预备党员日期">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="full_member_date" label="转正为正式党员日期">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
        </Row>

        {/* ── 培训班结业情况 ──────────────────────────── */}
        <Divider orientation="left" style={{ fontSize: 13, color: '#86909c', margin: '4px 0 12px' }}>培训班结业情况</Divider>
        <Row gutter={16}>
          {TRAINING_FIELDS.map(({ field, label, confirmedField }) => (
            <Col span={24} key={field} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 120, flexShrink: 0 }}>{label}</span>
                {/* 查看模式：直接显示状态 Tag */}
                {viewOnly ? (
                  <>
                    <TrainingStatusTag
                      graduationDate={initialValues?.[field]}
                      confirmedDate={initialValues?.[confirmedField]}
                    />
                    {initialValues?.[field] && (
                      <span style={{ color: '#86909c', fontSize: 13 }}>
                        {initialValues[field]}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Switch
                      checkedChildren="已结业" unCheckedChildren="未结业"
                      checked={trainingStatus[field]}
                      onChange={checked => toggleTraining(field, checked)}
                    />
                    {trainingStatus[field] && (
                      <Form.Item name={field} style={{ margin: 0, flex: 1 }}>
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="结业日期" />
                      </Form.Item>
                    )}
                  </>
                )}
              </div>
            </Col>
          ))}
        </Row>

        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={2} />
        </Form.Item>

        {!viewOnly && (
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={onClose} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" htmlType="submit">{isEdit ? '保存' : '新增'}</Button>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
