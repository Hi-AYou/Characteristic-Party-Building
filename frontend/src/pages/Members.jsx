import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Space, Tag, Input, Select, Row, Col,
  Popconfirm, message, Tooltip, DatePicker, Popover,
  Checkbox, Modal, Form, Badge,
} from 'antd'
import {
  PlusOutlined, UploadOutlined, DownloadOutlined, SearchOutlined,
  EditOutlined, DeleteOutlined, EyeOutlined, SettingOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import AppLayout from '../components/Layout/AppLayout'
import MemberForm from '../components/MemberForm'
import ImportModal from '../components/ImportModal'
import useAuthStore from '../store/authStore'
import {
  getMembers, deleteMember, exportMembers,
  downloadTemplate, batchUpdateMembers,
} from '../api/membersApi'
import { getBranches } from '../api/branchesApi'

const { Option } = Select
const { RangePicker } = DatePicker

const STAGE_COLORS = {
  '无': 'default', '入党申请人': 'default', '积极分子': 'blue',
  '发展对象': 'orange', '预备党员': 'purple', '正式党员': 'green',
}

const POLITICAL_STATUS_OPTIONS = [
  '入党申请人', '入党积极分子', '发展对象', '中共预备党员', '正式党员',
]

// 培训班状态 Tag
function TrainingTag({ graduationDate, confirmedDate }) {
  if (graduationDate) return <Tag color="success">已结业</Tag>
  if (confirmedDate)  return <Tag color="processing">培训中</Tag>
  return <Tag color="default">未参加</Tag>
}

// 所有可用列定义
const ALL_COLUMNS_DEF = [
  { key: 'name',                            title: '姓名',          width: 80,  fixed: 'left', alwaysShow: true },
  { key: 'student_id',                      title: '学号',          width: 120, alwaysShow: true },
  { key: 'branch_name',                     title: '党支部',        width: 150, superAdminOnly: true },
  { key: 'department',                      title: '院系',          width: 120, ellipsis: true },
  { key: 'major',                           title: '专业',          width: 120, ellipsis: true },
  { key: 'education_type',                  title: '学历',          width: 70 },
  { key: 'enrollment_year',                 title: '入学年份',      width: 85 },
  { key: 'expected_graduation',             title: '拟毕业年月',    width: 100 },
  { key: 'current_stage',                   title: '当前阶段',      width: 105 },
  { key: 'political_status',                title: '政治面貌',      width: 110 },
  { key: 'application_date',                title: '递交申请书',    width: 110 },
  { key: 'youth_league_graduation_date',    title: '团校结业',      width: 100 },
  { key: 'youth_league_status',             title: '团校状态',      width: 90,  isTraining: true },
  { key: 'activist_confirmed_date',         title: '积极分子确立',  width: 110 },
  { key: 'activist_training_graduation_date', title: '积极分子培训结业', width: 130 },
  { key: 'activist_training_status',        title: '积极分子培训状态', width: 110, isTraining: true },
  { key: 'dev_target_confirmed_date',       title: '发展对象确立',  width: 110 },
  { key: 'dev_training_graduation_date',    title: '发展对象培训结业', width: 130 },
  { key: 'dev_training_status',             title: '发展对象培训状态', width: 110, isTraining: true },
  { key: 'probationary_date',               title: '预备党员日期',  width: 110 },
  { key: 'full_member_date',                title: '转正日期',      width: 100 },
  { key: 'phone',                           title: '联系电话',      width: 120, sensitive: true },
  { key: 'is_overseas',                     title: '是否海外',      width: 80 },
  { key: 'updated_at',                      title: '更新时间',      width: 100 },
  { key: 'updated_by_username',             title: '操作人',        width: 90 },
  { key: 'party_role_in_branch',            title: '党内职务',      width: 100 },
]

// 默认显示列
const DEFAULT_VISIBLE = new Set([
  'name', 'student_id', 'branch_name', 'current_stage',
  'application_date', 'activist_confirmed_date',
  'dev_target_confirmed_date', 'probationary_date',
  'updated_at', 'updated_by_username',
])

// 可批量修改的字段
const BATCH_FIELDS = [
  { value: 'application_date',               label: '递交入党申请书日期', type: 'date' },
  { value: 'youth_league_graduation_date',   label: '团校结业日期',       type: 'date' },
  { value: 'activist_confirmed_date',        label: '积极分子确立日期',   type: 'date' },
  { value: 'activist_training_graduation_date', label: '积极分子培训班结业日期', type: 'date' },
  { value: 'dev_target_confirmed_date',      label: '发展对象确立日期',   type: 'date' },
  { value: 'dev_training_graduation_date',   label: '发展对象培训班结业日期', type: 'date' },
  { value: 'probationary_date',              label: '预备党员日期',       type: 'date' },
  { value: 'full_member_date',               label: '正式党员日期',       type: 'date' },
  { value: 'expected_graduation',            label: '拟毕业年月',         type: 'month' },
  { value: 'political_status',               label: '政治面貌',           type: 'select' },
]

export default function Members() {
  const { user } = useAuthStore()
  const canEdit = user?.role !== 'viewer'
  const isSuperAdmin = user?.role === 'super_admin'

  const [members, setMembers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [branches, setBranches] = useState([])

  // 列显示控制
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE)
  const [colPopoverOpen, setColPopoverOpen] = useState(false)

  // 筛选条件
  const [filters, setFilters] = useState({
    search: '',
    branch_ids: [],
    stages: [],
    education_types: [],
    department: '',
    is_overseas: '',
    application_date_range: null,   // [dayjs, dayjs]
    graduation_range: null,         // [dayjs, dayjs]
  })

  // Modal 状态
  const [formVisible, setFormVisible] = useState(false)
  const [importVisible, setImportVisible] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [viewOnly, setViewOnly] = useState(false)

  // 批量操作
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [batchVisible, setBatchVisible] = useState(false)
  const [batchField, setBatchField] = useState(null)
  const [batchValue, setBatchValue] = useState(null)
  const [batchLoading, setBatchLoading] = useState(false)

  useEffect(() => {
    getBranches().then(res => setBranches(res.data))
  }, [])

  const buildParams = useCallback(() => {
    const p = {}
    if (filters.search) p.search = filters.search
    if (filters.branch_ids.length) p.branch_ids = filters.branch_ids.join(',')
    if (filters.stages.length) p.stages = filters.stages.join(',')
    if (filters.education_types.length) p.education_types = filters.education_types.join(',')
    if (filters.department) p.department = filters.department
    if (filters.is_overseas) p.is_overseas = filters.is_overseas
    if (filters.application_date_range?.[0]) {
      p.application_date_start = filters.application_date_range[0].format('YYYY-MM-DD')
      p.application_date_end   = filters.application_date_range[1].format('YYYY-MM-DD')
    }
    if (filters.graduation_range?.[0]) {
      p.graduation_start = filters.graduation_range[0].format('YYYY-MM')
      p.graduation_end   = filters.graduation_range[1].format('YYYY-MM')
    }
    return p
  }, [filters])

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMembers(buildParams())
      setMembers(res.data.members)
      setTotal(res.data.total)
    } catch {
      message.error('获取党员列表失败')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const handleDelete = async (id) => {
    try {
      await deleteMember(id)
      message.success('已删除')
      fetchMembers()
    } catch (err) {
      message.error(err.response?.data?.error || '删除失败')
    }
  }

  const handleExport = async () => {
    try {
      const res = await exportMembers(buildParams())
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `党员信息_${dayjs().format('YYYYMMDD')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('导出失败')
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await downloadTemplate()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = '党员信息导入模板.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('模板下载失败')
    }
  }

  // 批量修改
  const handleBatchUpdate = async () => {
    if (!batchField || batchValue === null || batchValue === undefined || batchValue === '') {
      return message.warning('请选择字段并填写新值')
    }
    setBatchLoading(true)
    try {
      let val = batchValue
      if (batchValue instanceof dayjs || (batchValue && batchValue.$d)) {
        const fieldDef = BATCH_FIELDS.find(f => f.value === batchField)
        val = fieldDef?.type === 'month'
          ? dayjs(batchValue).format('YYYY-MM')
          : dayjs(batchValue).format('YYYY-MM-DD')
      }
      const res = await batchUpdateMembers({ ids: selectedRowKeys, fields: { [batchField]: val } })
      message.success(res.data.message)
      setBatchVisible(false)
      setBatchField(null)
      setBatchValue(null)
      setSelectedRowKeys([])
      fetchMembers()
    } catch (err) {
      message.error(err.response?.data?.error || '批量修改失败')
    } finally {
      setBatchLoading(false)
    }
  }

  // 动态生成表格列
  const buildColumns = () => {
    const cols = []
    ALL_COLUMNS_DEF.forEach(def => {
      if (!visibleCols.has(def.key)) return
      if (def.superAdminOnly && !isSuperAdmin) return
      if (def.sensitive && !canEdit) return

      const col = {
        title: def.title,
        dataIndex: def.key,
        width: def.width,
        ellipsis: def.ellipsis,
        fixed: def.fixed,
        sorter: def.isTraining ? false : (a, b) => {
          const va = a[def.key] || ''
          const vb = b[def.key] || ''
          return String(va).localeCompare(String(vb))
        },
      }

      if (def.key === 'current_stage') {
        col.render = v => <Tag color={STAGE_COLORS[v] || 'default'}>{v}</Tag>
      } else if (def.key === 'is_overseas') {
        col.render = v => v ? <Tag color="cyan">是</Tag> : null
      } else if (def.key === 'updated_at') {
        col.render = v => v ? v.slice(0, 10) : ''
      } else if (def.key === 'youth_league_status') {
        col.dataIndex = undefined
        col.render = (_, r) => (
          <TrainingTag
            graduationDate={r.youth_league_graduation_date}
            confirmedDate={r.application_date}
          />
        )
      } else if (def.key === 'activist_training_status') {
        col.dataIndex = undefined
        col.render = (_, r) => (
          <TrainingTag
            graduationDate={r.activist_training_graduation_date}
            confirmedDate={r.activist_confirmed_date}
          />
        )
      } else if (def.key === 'dev_training_status') {
        col.dataIndex = undefined
        col.render = (_, r) => (
          <TrainingTag
            graduationDate={r.dev_training_graduation_date}
            confirmedDate={r.dev_target_confirmed_date}
          />
        )
      }

      cols.push(col)
    })

    // 操作列（始终显示）
    cols.push({
      title: '操作', fixed: 'right', width: canEdit ? 110 : 60,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看">
            <Button type="link" size="small" icon={<EyeOutlined />}
              onClick={() => { setEditingMember(record); setViewOnly(true); setFormVisible(true) }} />
          </Tooltip>
          {canEdit && (
            <>
              <Tooltip title="编辑">
                <Button type="link" size="small" icon={<EditOutlined />}
                  onClick={() => { setEditingMember(record); setViewOnly(false); setFormVisible(true) }} />
              </Tooltip>
              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
                <Button type="link" size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    })
    return cols
  }

  // 列控制 Popover 内容
  const colControlContent = (
    <div style={{ maxWidth: 360 }}>
      <div style={{ marginBottom: 8, fontWeight: 500 }}>选择显示的列</div>
      <Checkbox.Group
        value={[...visibleCols]}
        onChange={keys => setVisibleCols(new Set(keys))}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}
      >
        {ALL_COLUMNS_DEF.map(def => {
          if (def.superAdminOnly && !isSuperAdmin) return null
          if (def.sensitive && !canEdit) return null
          return (
            <Checkbox key={def.key} value={def.key} disabled={def.alwaysShow}>
              {def.title}
            </Checkbox>
          )
        })}
      </Checkbox.Group>
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <Button size="small" onClick={() => setVisibleCols(DEFAULT_VISIBLE)}>恢复默认</Button>
      </div>
    </div>
  )

  // 筛选栏
  const filterBar = (
    <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
      <Col flex="180px">
        <Input placeholder="搜索姓名/学号" prefix={<SearchOutlined />}
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          allowClear />
      </Col>
      {isSuperAdmin && (
        <Col flex="200px">
          <Select mode="multiple" placeholder="党支部" style={{ width: '100%' }}
            value={filters.branch_ids} maxTagCount={1}
            onChange={v => setFilters(f => ({ ...f, branch_ids: v }))} allowClear>
            {branches.map(b => <Option key={b.id} value={b.id}>{b.name}</Option>)}
          </Select>
        </Col>
      )}
      <Col flex="200px">
        <Select mode="multiple" placeholder="发展阶段" style={{ width: '100%' }}
          value={filters.stages} maxTagCount={1}
          onChange={v => setFilters(f => ({ ...f, stages: v }))} allowClear>
          {['入党申请人','积极分子','发展对象','预备党员','正式党员'].map(s =>
            <Option key={s} value={s}>{s}</Option>)}
        </Select>
      </Col>
      <Col flex="160px">
        <Select mode="multiple" placeholder="学历" style={{ width: '100%' }}
          value={filters.education_types} maxTagCount={2}
          onChange={v => setFilters(f => ({ ...f, education_types: v }))} allowClear>
          {['本科','硕士','博士'].map(s => <Option key={s} value={s}>{s}</Option>)}
        </Select>
      </Col>
      <Col flex="110px">
        <Select placeholder="是否海外" style={{ width: '100%' }}
          value={filters.is_overseas || undefined}
          onChange={v => setFilters(f => ({ ...f, is_overseas: v || '' }))} allowClear>
          <Option value="true">海外中</Option>
          <Option value="false">在国内</Option>
        </Select>
      </Col>
      <Col flex="120px">
        <Input placeholder="院系关键词" value={filters.department}
          onChange={e => setFilters(f => ({ ...f, department: e.target.value }))} allowClear />
      </Col>
      <Col flex="260px">
        <RangePicker placeholder={['申请书起始日', '申请书截止日']}
          style={{ width: '100%' }}
          value={filters.application_date_range}
          onChange={v => setFilters(f => ({ ...f, application_date_range: v }))} />
      </Col>
      <Col flex="220px">
        <RangePicker picker="month" placeholder={['拟毕业起', '拟毕业止']}
          style={{ width: '100%' }}
          value={filters.graduation_range}
          onChange={v => setFilters(f => ({ ...f, graduation_range: v }))} />
      </Col>
    </Row>
  )

  const batchFieldDef = BATCH_FIELDS.find(f => f.value === batchField)

  return (
    <AppLayout>
      <div style={{ padding: 24 }}>
        {/* 顶部操作栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>
            党员信息
            <span style={{ fontSize: 14, color: '#86909c', fontWeight: 400, marginLeft: 8 }}>
              共 {total} 人
            </span>
            {selectedRowKeys.length > 0 && (
              <Badge count={`已选 ${selectedRowKeys.length}`} color="#1677ff" style={{ marginLeft: 8 }} />
            )}
          </h2>
          <Space wrap>
            {selectedRowKeys.length > 0 && canEdit && (
              <Button onClick={() => setBatchVisible(true)}>
                批量修改（{selectedRowKeys.length} 人）
              </Button>
            )}
            {canEdit && (
              <>
                <Button type="primary" icon={<PlusOutlined />}
                  onClick={() => { setEditingMember(null); setViewOnly(false); setFormVisible(true) }}>
                  新增党员
                </Button>
                <Button icon={<FileExcelOutlined />} onClick={handleDownloadTemplate}>
                  下载模板
                </Button>
                <Button icon={<UploadOutlined />} onClick={() => setImportVisible(true)}>
                  导入 Excel
                </Button>
              </>
            )}
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出 Excel
            </Button>
            <Popover
              content={colControlContent}
              trigger="click"
              open={colPopoverOpen}
              onOpenChange={setColPopoverOpen}
              placement="bottomRight"
            >
              <Button icon={<SettingOutlined />}>列显示</Button>
            </Popover>
          </Space>
        </div>

        {filterBar}

        <Table
          dataSource={members}
          columns={buildColumns()}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          size="small"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
          bordered
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />

        {/* 党员表单 */}
        <MemberForm
          visible={formVisible}
          viewOnly={viewOnly}
          initialValues={editingMember}
          branches={branches}
          onClose={() => { setFormVisible(false); setEditingMember(null) }}
          onSuccess={() => { setFormVisible(false); setEditingMember(null); fetchMembers() }}
        />

        {/* 导入弹窗 */}
        <ImportModal
          visible={importVisible}
          branches={branches}
          onClose={() => setImportVisible(false)}
          onSuccess={() => { setImportVisible(false); fetchMembers() }}
        />

        {/* 批量修改弹窗 */}
        <Modal
          title={`批量修改 ${selectedRowKeys.length} 名党员信息`}
          open={batchVisible}
          onCancel={() => { setBatchVisible(false); setBatchField(null); setBatchValue(null) }}
          onOk={handleBatchUpdate}
          confirmLoading={batchLoading}
          okText="确认修改"
          cancelText="取消"
        >
          <Form layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item label="选择要修改的字段" required>
              <Select
                style={{ width: '100%' }}
                placeholder="请选择字段"
                value={batchField}
                onChange={v => { setBatchField(v); setBatchValue(null) }}
              >
                {BATCH_FIELDS.map(f => (
                  <Option key={f.value} value={f.value}>{f.label}</Option>
                ))}
              </Select>
            </Form.Item>
            {batchField && (
              <Form.Item label={`新值（${batchFieldDef?.label}）`} required>
                {batchFieldDef?.type === 'date' && (
                  <DatePicker
                    style={{ width: '100%' }}
                    format="YYYY-MM-DD"
                    value={batchValue}
                    onChange={setBatchValue}
                  />
                )}
                {batchFieldDef?.type === 'month' && (
                  <DatePicker
                    picker="month"
                    style={{ width: '100%' }}
                    format="YYYY-MM"
                    value={batchValue}
                    onChange={setBatchValue}
                  />
                )}
                {batchFieldDef?.type === 'select' && batchField === 'political_status' && (
                  <Select style={{ width: '100%' }} value={batchValue} onChange={setBatchValue}>
                    {POLITICAL_STATUS_OPTIONS.map(o => <Option key={o} value={o}>{o}</Option>)}
                  </Select>
                )}
              </Form.Item>
            )}
          </Form>
        </Modal>
      </div>
    </AppLayout>
  )
}
