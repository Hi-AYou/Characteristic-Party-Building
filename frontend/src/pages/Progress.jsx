import React, { useState, useEffect, useCallback } from 'react'
import {
  Tabs, Table, Tag, Select, Badge, Spin, message,
  Button, DatePicker, Row, Col, Alert, Space, Modal,
} from 'antd'
import { DownloadOutlined, LockOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import AppLayout from '../components/Layout/AppLayout'
import MemberForm from '../components/MemberForm'
import useAuthStore from '../store/authStore'
import { getProgress, exportMembers } from '../api/membersApi'
import { getBranches } from '../api/branchesApi'

const { Option } = Select

const TAB_CONFIG = [
  { key: 'pending_activist',    label: '确定为入党积极分子', color: 'blue',
    desc: '递交入党申请书满1个月且团校结业，尚未确立积极分子' },
  { key: 'pending_dev_target',  label: '确定为发展对象',     color: 'orange',
    desc: '积极分子确立满1年且积极分子培训班结业，尚未确立发展对象' },
  { key: 'pending_probationary',label: '接收为预备党员',     color: 'purple',
    desc: '已确立发展对象且培训班结业在6个月内，尚未成为预备党员' },
  { key: 'pending_full_member', label: '转正为正式党员',     color: 'red',
    desc: '预备党员满1年，尚未转为正式党员' },
]

function DaysTag({ days }) {
  if (days === undefined || days === null) return null
  if (days === 0) return <Tag color="green">0 天</Tag>
  if (days <= 30) return <Tag color="orange">{days} 天</Tag>
  return <Tag color="red">{days} 天</Tag>
}

const BASE_COLS = [
  { title: '姓名', dataIndex: 'name', width: 80, sorter: (a, b) => a.name.localeCompare(b.name) },
  { title: '学号', dataIndex: 'student_id', width: 120 },
  { title: '党支部', dataIndex: 'branch_name', width: 150, ellipsis: true },
  { title: '院系/专业', width: 160, ellipsis: true,
    render: (_, r) => `${r.department || ''} ${r.major || ''}`.trim() },
  { title: '学历', dataIndex: 'education_type', width: 60 },
  { title: '已满足天数', dataIndex: 'overdue_days', width: 110,
    render: v => <DaysTag days={v} />,
    sorter: (a, b) => (b.overdue_days || 0) - (a.overdue_days || 0) },
  { title: '条件满足起', dataIndex: 'eligible_since', width: 110 },
]

const EXTRA_COLS = {
  pending_activist: [
    { title: '递交申请书', dataIndex: 'application_date', width: 110 },
    { title: '团校结业', dataIndex: 'youth_league_graduation_date', width: 110 },
  ],
  pending_dev_target: [
    { title: '积极分子确立', dataIndex: 'activist_confirmed_date', width: 110 },
    { title: '积极分子培训结业', dataIndex: 'activist_training_graduation_date', width: 130 },
  ],
  pending_probationary: [
    { title: '发展对象确立', dataIndex: 'dev_target_confirmed_date', width: 110 },
    { title: '培训班结业', dataIndex: 'dev_training_graduation_date', width: 110 },
    { title: '剩余天数', dataIndex: 'days_remaining', width: 90,
      render: v => v != null ? `${v} 天` : '-' },
  ],
  pending_full_member: [
    { title: '预备党员日期', dataIndex: 'probationary_date', width: 110 },
  ],
}

export default function Progress() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'
  const isViewer = user?.role === 'viewer'

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])
  const [selectedBranches, setSelectedBranches] = useState([])
  const [asOfDate, setAsOfDate] = useState(dayjs())
  const [activeTab, setActiveTab] = useState('pending_activist')

  // 查看党员详情
  const [viewMember, setViewMember] = useState(null)
  const [viewVisible, setViewVisible] = useState(false)

  useEffect(() => {
    if (isSuperAdmin) getBranches().then(res => setBranches(res.data))
  }, [])

  const fetchProgress = useCallback(async () => {
    if (isViewer) return
    setLoading(true)
    try {
      const params = { as_of_date: asOfDate.format('YYYY-MM-DD') }
      if (isSuperAdmin && selectedBranches.length > 0) {
        params.branch_ids = selectedBranches.join(',')
      }
      const res = await getProgress(params)
      setData(res.data)
    } catch {
      message.error('获取进度数据失败')
    } finally {
      setLoading(false)
    }
  }, [asOfDate, selectedBranches, isViewer, isSuperAdmin])

  useEffect(() => { fetchProgress() }, [fetchProgress])

  const handleExport = async (alertType) => {
    try {
      const params = {
        alert_type: alertType,
        as_of_date: asOfDate.format('YYYY-MM-DD'),
      }
      if (isSuperAdmin && selectedBranches.length > 0) {
        params.branch_ids = selectedBranches.join(',')
      }
      const res = await exportMembers(params)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      const labelMap = Object.fromEntries(TAB_CONFIG.map(t => [t.key, t.label]))
      a.download = `${labelMap[alertType]}_${asOfDate.format('YYYYMMDD')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('导出失败')
    }
  }

  const handleNameClick = (record) => {
    setViewMember(record)
    setViewVisible(true)
  }

  const totalAlerts = data?.total_alerts || 0
  const isToday = asOfDate.isSame(dayjs(), 'day')

  // viewer 显示无权限
  if (isViewer) {
    return (
      <AppLayout>
        <div style={{ padding: 24 }}>
          <Alert
            type="warning"
            showIcon
            icon={<LockOutlined />}
            message="无查看权限"
            description="发展进度预警功能仅对党支书和管理员开放，如需了解发展进度请联系您的党支书。"
            style={{ maxWidth: 600 }}
          />
        </div>
      </AppLayout>
    )
  }

  // 筛选区域
  const filterBar = (
    <Row gutter={[12, 8]} align="middle" style={{ marginBottom: 16 }}>
      {isSuperAdmin && (
        <Col>
          <Select
            mode="multiple"
            placeholder="筛选党支部（可多选）"
            style={{ minWidth: 220 }}
            value={selectedBranches}
            onChange={setSelectedBranches}
            allowClear
            maxTagCount={2}
          >
            {branches.map(b => <Option key={b.id} value={b.id}>{b.name}</Option>)}
          </Select>
        </Col>
      )}
      <Col>
        <Space size={4}>
          <span style={{ color: '#86909c', fontSize: 13 }}>预判基准日期：</span>
          <DatePicker
            value={asOfDate}
            onChange={v => v && setAsOfDate(v)}
            allowClear={false}
            style={{ width: 140 }}
          />
          {!isToday && (
            <Button size="small" onClick={() => setAsOfDate(dayjs())}>回到今天</Button>
          )}
        </Space>
      </Col>
      {!isToday && (
        <Col>
          <Tag color="blue">
            预判模式：显示 {asOfDate.format('YYYY-MM-DD')} 前已满足条件的人员
          </Tag>
        </Col>
      )}
    </Row>
  )

  const tabItems = TAB_CONFIG.map(({ key, label, color, desc }) => {
    const list = data?.[key] || []
    const cols = [
      {
        title: '姓名', dataIndex: 'name', width: 80,
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (name, record) => (
          <a onClick={() => handleNameClick(record)} style={{ cursor: 'pointer' }}>{name}</a>
        ),
      },
      ...BASE_COLS.slice(1),
      ...(EXTRA_COLS[key] || []),
    ]

    return {
      key,
      label: (
        <span>
          {label}
          {list.length > 0 && (
            <Badge count={list.length} color={color} size="small" style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ color: '#86909c', margin: 0, fontSize: 13 }}>{desc}</p>
            <Button
              size="small" icon={<DownloadOutlined />}
              onClick={() => handleExport(key)}
              disabled={list.length === 0}
            >
              导出 Excel（{list.length} 人）
            </Button>
          </div>
          <Table
            dataSource={list}
            rowKey="id"
            columns={cols}
            size="small"
            pagination={{ pageSize: 20, showTotal: t => `共 ${t} 人` }}
            rowClassName={r =>
              r.overdue_days > 30 ? 'row-overdue-high' : r.overdue_days > 0 ? 'row-overdue-mid' : ''
            }
          />
        </div>
      ),
    }
  })

  return (
    <AppLayout alertCount={totalAlerts}>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>
            发展进度预警
            {totalAlerts > 0 && <Badge count={totalAlerts} style={{ marginLeft: 12 }} />}
          </h2>
        </div>

        {filterBar}

        {loading ? (
          <Spin size="large" style={{ display: 'block', textAlign: 'center', marginTop: 100 }} />
        ) : (
          <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
        )}

        {/* 党员详情弹窗 */}
        <MemberForm
          visible={viewVisible}
          viewOnly={true}
          initialValues={viewMember}
          branches={branches}
          onClose={() => { setViewVisible(false); setViewMember(null) }}
          onSuccess={() => {}}
        />
      </div>
    </AppLayout>
  )
}
