export type UserRole = 'admin' | 'head_chef' | 'section_head' | 'staff'
export type SubmissionStatus = 'pending' | 'approved' | 'flagged'

export interface Department {
  id: string
  name: string
  name_hi: string
  icon: string
  venue: string
}

export interface Station {
  id: string
  name: string
  department_id: string
  venue: string
  tablet_pin: string
  is_active: boolean
  department?: Department
}

export interface StaffMember {
  id: string
  name: string
  name_hi?: string
  role: UserRole
  department_id: string
  is_active: boolean
}

export interface SopCategory {
  id: string
  name: string
  name_hi: string
  icon: string
  sort_order: number
}

export interface Sop {
  id: string
  title: string
  title_hi: string
  category_id: string
  department_id: string
  pdf_path: string
  version: number
  pax_count?: number
  prep_time_minutes?: number
  tags: string[]
  community_notes?: Record<string, string>
  is_active: boolean
  category?: SopCategory
}

export interface ChecklistItem {
  label: string
  label_hi: string
  requires_photo: boolean
  type: 'check' | 'temp' | 'photo' | 'text'
}

export interface Checklist {
  id: string
  name: string
  name_hi: string
  type: string
  department_id: string
  scheduled_time: string
  items: ChecklistItem[]
  is_active: boolean
}

export interface Submission {
  id: string
  checklist_id: string
  station_id: string
  staff_name: string
  status: SubmissionStatus
  responses: { item_index: number; photo_path?: string; value?: string }[]
  submitted_at: string
  reviewed_at?: string
  checklist?: Checklist
}