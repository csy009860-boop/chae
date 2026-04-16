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

export interface DashboardStats {
  ongoingCount: number;
  upcomingCount: number;
  regularCount: number;
  issueCount: number;
}
