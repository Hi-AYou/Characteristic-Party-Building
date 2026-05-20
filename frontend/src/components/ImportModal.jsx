import React, { useState } from 'react'
import { Modal, Upload, Button, Select, message, Alert, Table, Progress } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import useAuthStore from '../store/authStore'
import { importMembers } from '../api/membersApi'

const { Option } = Select
const { Dragger } = Upload

export default function ImportModal({ visible, branches, onClose, onSuccess }) {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const [file, setFile] = useState(null)
  const [branchId, setBranchId] = useState(isSuperAdmin ? null : user?.branch_id)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleUpload = async () => {
    if (!file) return message.warning('请先选择文件')
    if (isSuperAdmin && !branchId) return message.warning('请选择导入的党支部')

    setLoading(true)
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    if (isSuperAdmin) fd.append('branch_id', branchId)

    try {
      const res = await importMembers(fd)
      setResult(res.data)
      if (res.data.errors?.length === 0) {
        message.success(res.data.message)
        onSuccess()
      } else {
        message.warning(`${res.data.message}，有 ${res.data.errors.length} 行出错`)
      }
    } catch (err) {
      message.error(err.response?.data?.error || '导入失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setResult(null)
    onClose()
  }

  return (
    <Modal
      title="导入 Excel 党员信息"
      open={visible}
      onCancel={handleClose}
      width={640}
      footer={null}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        message="说明"
        description="Excel 第一行为字段名，支持的列名包括：姓名、学号、性别、院系、专业、出生日期、学历层次、入学年份、联系电话、邮箱、党支部内职务、是否海外交流、递交入党申请书日期、积极分子确立日期等。未识别的列将保留在扩展字段中。"
        style={{ marginBottom: 16 }}
      />

      {isSuperAdmin && (
        <Select
          placeholder="选择导入的党支部"
          style={{ width: '100%', marginBottom: 16 }}
          value={branchId}
          onChange={setBranchId}
        >
          {branches.map(b => <Option key={b.id} value={b.id}>{b.name}</Option>)}
        </Select>
      )}

      <Dragger
        accept=".xlsx,.xls,.csv"
        beforeUpload={(f) => { setFile(f); return false }}
        onRemove={() => setFile(null)}
        maxCount={1}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p>点击或拖拽 Excel/CSV 文件到此区域</p>
        <p style={{ color: '#86909c', fontSize: 12 }}>支持 .xlsx .xls .csv 格式</p>
      </Dragger>

      <div style={{ textAlign: 'right', marginTop: 16 }}>
        <Button onClick={handleClose} style={{ marginRight: 8 }}>取消</Button>
        <Button type="primary" loading={loading} onClick={handleUpload} disabled={!file}>
          开始导入
        </Button>
      </div>

      {result && (
        <div style={{ marginTop: 16 }}>
          <Alert
            type={result.errors?.length ? 'warning' : 'success'}
            message={result.message}
            showIcon
          />
          {result.errors?.length > 0 && (
            <Table
              size="small"
              style={{ marginTop: 8 }}
              dataSource={result.errors}
              rowKey={(r, i) => i}
              pagination={{ pageSize: 5 }}
              columns={[
                { title: '行号', dataIndex: 'row', width: 60 },
                { title: '原因', dataIndex: 'reason' },
              ]}
            />
          )}
        </div>
      )}
    </Modal>
  )
}
