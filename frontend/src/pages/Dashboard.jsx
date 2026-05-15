import React, { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Alert, Spin, Button } from 'antd'
import {
  TeamOutlined, StarOutlined, ApartmentOutlined,
  SolutionOutlined, CheckCircleOutlined, BellOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats } from '../api/usersApi'
import AppLayout from '../components/Layout/AppLayout'
import useAuthStore from '../store/authStore'

const STAGE_CONFIG = [
  { key: '入党申请人', icon: <TeamOutlined />, color: '#8c8c8c' },
  { key: '积极分子',  label: '确定为入党积极分子', icon: <StarOutlined />, color: '#1677ff' },
  { key: '发展对象',  label: '确定为发展对象',     icon: <ApartmentOutlined />, color: '#fa8c16' },
  { key: '预备党员',  label: '接收为预备党员',     icon: <SolutionOutlined />, color: '#722ed1' },
  { key: '正式党员',  icon: <CheckCircleOutlined />, color: '#52c41a' },
]

const ALERT_LABELS = {
  pending_activist:    '确定为入党积极分子',
  pending_dev_target:  '确定为发展对象',
  pending_probationary:'接收为预备党员',
  pending_full_member: '转正为正式党员',
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    getDashboardStats().then(res => setStats(res.data)).finally(() => setLoading(false))
  }, [])

  const alertCount = stats?.alert_counts?.total || 0
  const canViewProgress = user?.role !== 'viewer'

  const handleViewProgress = () => navigate('/progress')

  return (
    <AppLayout alertCount={alertCount}>
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 24, color: '#1d2129' }}>
          首页概览
          {user?.role !== 'super_admin' && (
            <span style={{ fontSize: 14, color: '#86909c', marginLeft: 12, fontWeight: 400 }}>
              {user?.branch_name}
            </span>
          )}
        </h2>

        {loading ? (
          <Spin size="large" style={{ display: 'block', textAlign: 'center', marginTop: 100 }} />
        ) : (
          <>
            {/* 预警提示 */}
            {alertCount > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<BellOutlined />}
                message={`当前有 ${alertCount} 名党员的发展进度需要关注`}
                description={
                  Object.entries(ALERT_LABELS).map(([k, label]) => {
                    const cnt = stats?.alert_counts?.[k] || 0
                    return cnt > 0 ? `${label} ${cnt} 人` : null
                  }).filter(Boolean).join('　　')
                }
                style={{ marginBottom: 24 }}
                action={
                  <Button size="small" type="primary" onClick={handleViewProgress}>
                    查看详情
                  </Button>
                }
              />
            )}

            {/* 各阶段统计卡片 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {STAGE_CONFIG.map(({ key, label, icon, color }) => (
                <Col xs={12} sm={8} md={6} lg={4} key={key}>
                  <Card bordered={false} style={{ borderRadius: 8, textAlign: 'center' }}>
                    <Statistic
                      title={label || key}
                      value={stats?.stage_counts?.[key] || 0}
                      prefix={React.cloneElement(icon, { style: { color } })}
                      valueStyle={{ color }}
                    />
                  </Card>
                </Col>
              ))}
              <Col xs={12} sm={8} md={6} lg={4}>
                <Card bordered={false} style={{ borderRadius: 8, textAlign: 'center' }}>
                  <Statistic title="总人数" value={stats?.stage_counts?.total || 0} />
                </Card>
              </Col>
            </Row>

            {/* 各支部汇总（超管可见） */}
            {user?.role === 'super_admin' && stats?.branch_stats?.length > 0 && (
              <Card title="各支部概况" bordered={false} style={{ borderRadius: 8 }}>
                <Table
                  dataSource={stats.branch_stats}
                  rowKey="branch_id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '支部名称', dataIndex: 'branch_name' },
                    { title: '入党申请人', render: (_, r) => r.stage_counts?.['入党申请人'] || 0 },
                    { title: '确定为入党积极分子', render: (_, r) => r.stage_counts?.['积极分子'] || 0 },
                    { title: '确定为发展对象', render: (_, r) => r.stage_counts?.['发展对象'] || 0 },
                    { title: '接收为预备党员', render: (_, r) => r.stage_counts?.['预备党员'] || 0 },
                    { title: '正式党员', render: (_, r) => r.stage_counts?.['正式党员'] || 0 },
                    { title: '合计', dataIndex: 'total', render: v => <strong>{v}</strong> },
                  ]}
                />
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
