// Force sync comment
export type ProjectStatus = 'ongoing' | 'upcoming' | 'regular' | 'issue' | 'completed';

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  taskCell: string[];
  collabTeam?: string;
  collabManager?: string;
  deadline: string;
  startDate: string;
  endDate: string;
  progress: number;
  pm: string;
  assignees: string[];
  issues: string[];
  tasks: string[];
  draftConfirmed: boolean;
  attachments?: string[];
  uid: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  index: number;
  name: string;
  rank: string;
  role: string;
  cell: string;
  contact: string;
  email: string;
}

export interface DashboardStats {
  ongoingCount: number;
  upcomingCount: number;
  regularCount: number;
  issueCount: number;
}

export type ScheduleType = 'vacation' | 'meeting' | 'seminar' | 'interview';
export type VacationType = 'annual' | 'half' | 'time';

export interface TeamSchedule {
  id: string;
  type: ScheduleType;
  subType?: VacationType;
  title: string;
  startDate: string;
  endDate: string;
  time?: string;
  participants: string[];
  cell: string;
  uid: string;
  createdAt: string;
}
