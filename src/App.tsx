import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  Calendar, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Search, 
  Bell, 
  User,
  CheckCircle2,
  Clock,
  ChevronRight,
  MoreVertical,
  PlusCircle,
  Edit3,
  Save,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Progress } from './components/ui/progress';
import { ScrollArea } from './components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from './components/ui/dialog';
import { Label } from './components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './components/ui/select';
import { Checkbox } from './components/ui/checkbox';
import { Separator } from './components/ui/separator';
import { Project, ProjectStatus } from './types';
import { mockProjects } from './lib/mockData';
import { cn } from './lib/utils';
import { format } from 'date-fns';

export default function App() {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all');

  // New Project State
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '',
    status: 'ongoing',
    taskCell: '',
    deadline: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    progress: 0,
    pm: '',
    assignees: [],
    issues: [],
    tasks: [],
    draftConfirmed: false,
    attachments: [],
  });

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId) || null
  , [projects, selectedProjectId]);

  const stats = useMemo(() => ({
    total: projects.length,
    ongoing: projects.filter(p => p.status === 'ongoing').length,
    upcoming: projects.filter(p => p.status === 'upcoming').length,
    issue: projects.filter(p => p.status === 'issue').length,
    completed: projects.filter(p => p.status === 'completed').length,
  }), [projects]);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.pm.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddProject = () => {
    const project: Project = {
      ...newProject as Project,
      id: Math.random().toString(36).substr(2, 9),
      attachments: newProject.attachments || [],
    };
    setProjects([...projects, project]);
    setIsModalOpen(false);
    setNewProject({
      name: '',
      status: 'ongoing',
      taskCell: '',
      deadline: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      progress: 0,
      pm: '',
      assignees: [],
      issues: [],
      tasks: [],
      draftConfirmed: false,
      attachments: [],
    });
  };

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
    setIsEditing(false);
  };

  const handleDeleteProject = (id: string) => {
    setProjects(projects.filter(p => p.id !== id));
    if (selectedProjectId === id) setSelectedProjectId(null);
  };

  const handleAddItem = (field: 'assignees' | 'issues' | 'tasks' | 'attachments', value: string, target: Partial<Project>, setTarget: React.Dispatch<React.SetStateAction<any>>) => {
    if (!value) return;
    setTarget({
      ...target,
      [field]: [...(target[field] || []), value]
    });
  };

  const handleRemoveItem = (field: 'assignees' | 'issues' | 'tasks' | 'attachments', index: number, target: Partial<Project>, setTarget: React.Dispatch<React.SetStateAction<any>>) => {
    const newList = [...(target[field] || [])];
    newList.splice(index, 1);
    setTarget({
      ...target,
      [field]: newList
    });
  };

  return (
    <div className="flex h-screen bg-sleek-bg text-sleek-text-main">
      {/* Sidebar */}
      <aside className="w-60 bg-sleek-sidebar text-white flex flex-col shrink-0">
        <div className="p-6 pb-8">
          <span className="font-extrabold text-xl tracking-widest text-sleek-primary">DASHBOARD</span>
        </div>

        <div className="px-5 mb-4 flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Projects</span>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 w-6 p-0 border-dashed border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={14} />
          </Button>
        </div>

        <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
          <NavItem 
            icon={<LayoutDashboard size={18} />} 
            label="대시보드" 
            active={!selectedProjectId} 
            onClick={() => { setSelectedProjectId(null); setIsEditing(false); }}
          />
          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Recent Projects</div>
          {projects.slice(0, 10).map(p => (
            <div 
              key={p.id} 
              onClick={() => { setSelectedProjectId(p.id); setIsEditing(false); }}
              className={cn(
                "group flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer rounded-md transition-all",
                selectedProjectId === p.id ? "bg-slate-800 text-white font-bold border-r-4 border-sleek-primary rounded-r-none" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <span className="truncate">{p.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-xs font-bold">
              AD
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">관리자</p>
              <p className="text-[10px] text-slate-500 truncate">csy009860@gmail.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedProject ? (
          <ProjectDetailView 
            project={selectedProject} 
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onUpdate={handleUpdateProject}
            onBack={() => setSelectedProjectId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
            {/* Header Stats */}
            <div className="grid grid-cols-5 gap-4">
              <StatCard 
                title="전체 업무" 
                value={stats.total} 
                color="var(--color-sleek-primary)" 
                active={filterStatus === 'all'}
                onClick={() => setFilterStatus('all')}
              />
              <StatCard 
                title="진행 중" 
                value={stats.ongoing} 
                color="var(--color-sleek-success)" 
                active={filterStatus === 'ongoing'}
                onClick={() => setFilterStatus('ongoing')}
              />
              <StatCard 
                title="예정 업무" 
                value={stats.upcoming} 
                color="var(--color-sleek-warning)" 
                active={filterStatus === 'upcoming'}
                onClick={() => setFilterStatus('upcoming')}
              />
              <StatCard 
                title="완료 업무" 
                value={stats.completed} 
                color="var(--color-sleek-primary)" 
                active={filterStatus === 'completed'}
                onClick={() => setFilterStatus('completed')}
              />
              <StatCard 
                title="이슈 사항" 
                value={stats.issue} 
                color="var(--color-sleek-danger)" 
                active={filterStatus === 'issue'}
                onClick={() => setFilterStatus('issue')}
              />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-4 gap-4">
              <MiniSection 
                title="진행중 프로젝트" 
                count={stats.ongoing} 
                items={projects.filter(p => p.status === 'ongoing')} 
                onClickItem={setSelectedProjectId} 
                variant="primary"
                groupByCell
              />
              <MiniSection 
                title="예정 프로젝트" 
                count={stats.upcoming} 
                items={projects.filter(p => p.status === 'upcoming')} 
                onClickItem={setSelectedProjectId} 
                variant="warning"
                groupByCell
              />
              <MiniSection 
                title="상시 업무" 
                count={projects.filter(p => p.status === 'regular').length} 
                items={projects.filter(p => p.status === 'regular')} 
                onClickItem={setSelectedProjectId} 
                variant="info"
                groupByCell
              />
              <MiniSection 
                title="이슈 사항" 
                count={projects.filter(p => p.issues.length > 0).length} 
                items={projects.filter(p => p.issues.length > 0).slice(0, 4)} 
                onClickItem={setSelectedProjectId} 
                variant="danger"
              />
            </div>

            {/* Details Table Area */}
            <div className="min-h-[400px] flex-1 bg-white rounded-xl shadow-sm border border-sleek-border p-6 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-base">전체 프로젝트 리스트</h3>
                <div className="flex items-center gap-4">
                  {filterStatus !== 'all' && (
                    <Badge variant="outline" className="h-8 gap-2 pl-3 pr-1 bg-blue-50 text-blue-700 border-blue-200">
                      필터: {filterStatus === 'ongoing' ? '진행중' : filterStatus === 'upcoming' ? '예정' : filterStatus === 'issue' ? '이슈' : '완료'}
                      <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-blue-100" onClick={() => setFilterStatus('all')}>
                        <X size={12} />
                      </Button>
                    </Badge>
                  )}
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <Input 
                      placeholder="검색..." 
                      className="h-10 pl-10 text-sm bg-slate-50 border-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-sleek-bg text-sleek-text-sub">
                      <th className="text-left p-3 font-semibold">작업명</th>
                      <th className="text-left p-3 font-semibold">상태</th>
                      <th className="text-left p-3 font-semibold">작업 셀</th>
                      <th className="text-left p-3 font-semibold">마감일</th>
                      <th className="text-left p-3 font-semibold">진행율</th>
                      <th className="text-left p-3 font-semibold">PM</th>
                      <th className="text-left p-3 font-semibold">이슈</th>
                      <th className="text-left p-3 font-semibold">시안</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map(p => (
                      <tr 
                        key={p.id} 
                        className={cn(
                          "border-b border-sleek-bg hover:bg-slate-50 transition-colors cursor-pointer",
                          filterStatus !== 'all' && p.status === filterStatus ? "bg-blue-50/50" : filterStatus !== 'all' ? "opacity-40" : ""
                        )}
                        onClick={() => setSelectedProjectId(p.id)}
                      >
                        <td className="p-3 font-medium text-slate-800">{p.name}</td>
                        <td className="p-3">
                          <StatusTag status={p.status} />
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] font-bold border-slate-200 text-slate-500">
                            {p.taskCell}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-500">{p.deadline || '-'}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-sleek-primary transition-all duration-500" 
                                style={{ width: `${p.progress}%`, backgroundColor: p.status === 'issue' ? 'var(--color-sleek-danger)' : p.status === 'completed' ? 'var(--color-sleek-success)' : undefined }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">{p.progress}%</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-sleek-primary flex items-center justify-center text-[10px] text-white font-bold">
                              {p.pm[0]}
                            </div>
                            <span className="font-medium text-slate-700">{p.pm}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className={cn("text-xs px-2 h-5", p.issues.length > 0 && "bg-red-100 text-red-600")}>
                            {p.issues.length}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {p.draftConfirmed ? (
                            <CheckCircle2 size={18} className="text-sleek-primary" />
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* Add Project Dialog (Improved UI) */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="w-[1000px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
            <div className="bg-sleek-sidebar p-8 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tight">새 프로젝트 생성</DialogTitle>
                <p className="text-slate-400 text-sm mt-1">프로젝트의 기본 정보와 구성 요소를 입력하여 관리를 시작하세요.</p>
              </DialogHeader>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">프로젝트명</Label>
                  <Input 
                    value={newProject.name} 
                    onChange={e => setNewProject({...newProject, name: e.target.value})}
                    placeholder="프로젝트 이름을 입력하세요"
                    className="h-11 border-slate-200 focus:ring-sleek-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">작업 상태</Label>
                  <Select 
                    value={newProject.status} 
                    onValueChange={v => setNewProject({...newProject, status: v as ProjectStatus})}
                  >
                    <SelectTrigger className="h-11 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ongoing">진행중</SelectItem>
                      <SelectItem value="upcoming">예정</SelectItem>
                      <SelectItem value="regular">상시</SelectItem>
                      <SelectItem value="issue">이슈</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">작업 셀</Label>
                  <Select 
                    value={newProject.taskCell} 
                    onValueChange={v => setNewProject({...newProject, taskCell: v})}
                  >
                    <SelectTrigger className="h-11 border-slate-200">
                      <SelectValue placeholder="셀 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UX셀">UX셀</SelectItem>
                      <SelectItem value="영상셀">영상셀</SelectItem>
                      <SelectItem value="편집셀">편집셀</SelectItem>
                      <SelectItem value="공통">공통</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">PM (책임자)</Label>
                  <Input 
                    value={newProject.pm} 
                    onChange={e => setNewProject({...newProject, pm: e.target.value})}
                    placeholder="프로젝트 매니저 성함"
                    className="h-11 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">시작일</Label>
                  <Input 
                    type="date" 
                    value={newProject.startDate} 
                    onChange={e => setNewProject({...newProject, startDate: e.target.value})}
                    className="h-11 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">종료일</Label>
                  <Input 
                    type="date" 
                    value={newProject.endDate} 
                    onChange={e => setNewProject({...newProject, endDate: e.target.value})}
                    className="h-11 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">마감일 (직접 입력)</Label>
                  <Input 
                    type="text" 
                    value={newProject.deadline} 
                    onChange={e => setNewProject({...newProject, deadline: e.target.value})}
                    placeholder="예: 2024-12-31 또는 상시"
                    className="h-11 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">진행율 (%)</Label>
                  <div className="flex items-center gap-4">
                    <Input 
                      type="number" 
                      min="0" max="100"
                      value={newProject.progress} 
                      onChange={e => setNewProject({...newProject, progress: parseInt(e.target.value)})}
                      className="h-11 w-24 border-slate-200"
                    />
                    <Progress value={newProject.progress} className="flex-1 h-2" />
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Dynamic Lists Section */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <DynamicListInput 
                    label="담당자 추가" 
                    items={newProject.assignees || []} 
                    onAdd={(v) => handleAddItem('assignees', v, newProject, setNewProject)} 
                    onRemove={(i) => handleRemoveItem('assignees', i, newProject, setNewProject)}
                  />
                  <DynamicListInput 
                    label="진행 업무 추가" 
                    items={newProject.tasks || []} 
                    onAdd={(v) => handleAddItem('tasks', v, newProject, setNewProject)} 
                    onRemove={(i) => handleRemoveItem('tasks', i, newProject, setNewProject)}
                  />
                </div>
                <div className="space-y-6">
                  <DynamicListInput 
                    label="이슈 사항 추가" 
                    items={newProject.issues || []} 
                    onAdd={(v) => handleAddItem('issues', v, newProject, setNewProject)} 
                    onRemove={(i) => handleRemoveItem('issues', i, newProject, setNewProject)}
                  />
                  <DynamicListInput 
                    label="첨부 파일 (이미지/동영상 URL)" 
                    items={newProject.attachments || []} 
                    onAdd={(v) => handleAddItem('attachments', v, newProject, setNewProject)} 
                    onRemove={(i) => handleRemoveItem('attachments', i, newProject, setNewProject)}
                    placeholder="URL을 입력하세요"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <Checkbox 
                  id="draft-add" 
                  checked={newProject.draftConfirmed}
                  onCheckedChange={(v) => setNewProject({...newProject, draftConfirmed: !!v})}
                  className="w-5 h-5 border-slate-300 data-[state=checked]:bg-sleek-primary"
                />
                <Label htmlFor="draft-add" className="text-sm font-semibold cursor-pointer text-slate-700">시안 확인 완료 여부</Label>
              </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="h-11 px-8 font-bold text-slate-500">취소</Button>
              <Button className="h-11 px-10 bg-sleek-primary hover:bg-blue-600 font-bold shadow-lg shadow-blue-200" onClick={handleAddProject}>프로젝트 생성하기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function ProjectDetailView({ project, isEditing, setIsEditing, onUpdate, onBack }: { 
  project: Project, 
  isEditing: boolean, 
  setIsEditing: (v: boolean) => void,
  onUpdate: (p: Project) => void,
  onBack: () => void
}) {
  const [editData, setEditData] = useState<Project>(project);

  const handleSave = () => {
    onUpdate(editData);
  };

  const handleAddItem = (field: 'assignees' | 'issues' | 'tasks' | 'attachments', value: string) => {
    if (!value) return;
    setEditData({
      ...editData,
      [field]: [...(editData[field] || []), value]
    });
  };

  const handleRemoveItem = (field: 'assignees' | 'issues' | 'tasks' | 'attachments', index: number) => {
    const newList = [...(editData[field] || [])];
    newList.splice(index, 1);
    setEditData({
      ...editData,
      [field]: newList
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <header className="h-16 border-b border-slate-100 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-400 hover:text-slate-600">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{project.name}</h2>
            <p className="text-xs text-slate-400">ID: {project.id} • {project.taskCell}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={() => { setIsEditing(false); setEditData(project); }} className="gap-2 text-slate-500">
                <X size={16} /> 취소
              </Button>
              <Button onClick={handleSave} className="bg-sleek-primary hover:bg-blue-600 gap-2">
                <Save size={16} /> 저장하기
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="bg-slate-800 hover:bg-slate-900 gap-2">
              <Edit3 size={16} /> 정보 수정
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Basic Info Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">기본 정보</h3>
              <StatusTag status={isEditing ? editData.status : project.status} />
            </div>
            
            <div className="grid grid-cols-3 gap-8">
              <DetailItem label="프로젝트명" value={project.name} isEditing={isEditing}>
                <Input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="h-9" />
              </DetailItem>
              <DetailItem label="작업 상태" value={getStatusLabel(project.status)} isEditing={isEditing}>
                <Select value={editData.status} onValueChange={v => setEditData({...editData, status: v as ProjectStatus})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ongoing">진행중</SelectItem>
                    <SelectItem value="upcoming">예정</SelectItem>
                    <SelectItem value="regular">상시</SelectItem>
                    <SelectItem value="issue">이슈</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                  </SelectContent>
                </Select>
              </DetailItem>
              <DetailItem label="작업 셀" value={project.taskCell} isEditing={isEditing}>
                <Select value={editData.taskCell} onValueChange={v => setEditData({...editData, taskCell: v})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UX셀">UX셀</SelectItem>
                    <SelectItem value="영상셀">영상셀</SelectItem>
                    <SelectItem value="편집셀">편집셀</SelectItem>
                    <SelectItem value="공통">공통</SelectItem>
                  </SelectContent>
                </Select>
              </DetailItem>
              <DetailItem label="PM" value={project.pm} isEditing={isEditing}>
                <Input value={editData.pm} onChange={e => setEditData({...editData, pm: e.target.value})} className="h-9" />
              </DetailItem>
              <DetailItem label="마감일" value={project.deadline} isEditing={isEditing}>
                <Input value={editData.deadline} onChange={e => setEditData({...editData, deadline: e.target.value})} className="h-9" />
              </DetailItem>
              <DetailItem label="진행율" value={`${project.progress}%`} isEditing={isEditing}>
                <div className="flex items-center gap-3">
                  <Input type="number" value={editData.progress} onChange={e => setEditData({...editData, progress: parseInt(e.target.value)})} className="h-9 w-20" />
                  <Progress value={editData.progress} className="flex-1 h-1.5" />
                </div>
              </DetailItem>
              <DetailItem label="시작일" value={project.startDate} isEditing={isEditing}>
                <Input type="date" value={editData.startDate} onChange={e => setEditData({...editData, startDate: e.target.value})} className="h-9" />
              </DetailItem>
              <DetailItem label="종료일" value={project.endDate} isEditing={isEditing}>
                <Input type="date" value={editData.endDate} onChange={e => setEditData({...editData, endDate: e.target.value})} className="h-9" />
              </DetailItem>
              <DetailItem label="시안 확인" value={project.draftConfirmed ? "완료" : "미완료"} isEditing={isEditing}>
                <div className="flex items-center gap-2">
                  <Checkbox checked={editData.draftConfirmed} onCheckedChange={v => setEditData({...editData, draftConfirmed: !!v})} />
                  <span className="text-sm">시안 확인 완료</span>
                </div>
              </DetailItem>
            </div>
          </section>

          <Separator className="bg-slate-50" />

          {/* Lists Section */}
          <div className="grid grid-cols-2 gap-12">
            <section className="space-y-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">인력 및 업무</h3>
              <div className="space-y-8">
                <DetailList 
                  label="담당자" 
                  items={isEditing ? editData.assignees : project.assignees} 
                  isEditing={isEditing}
                  onAdd={(v) => handleAddItem('assignees', v)}
                  onRemove={(i) => handleRemoveItem('assignees', i)}
                  layout="grid"
                />
                <DetailList 
                  label="진행 업무" 
                  items={isEditing ? editData.tasks : project.tasks} 
                  isEditing={isEditing}
                  onAdd={(v) => handleAddItem('tasks', v)}
                  onRemove={(i) => handleRemoveItem('tasks', i)}
                />
              </div>
            </section>

            <section className="space-y-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">이슈 및 첨부파일</h3>
              <div className="space-y-8">
                <DetailList 
                  label="이슈 사항" 
                  items={isEditing ? editData.issues : project.issues} 
                  isEditing={isEditing}
                  onAdd={(v) => handleAddItem('issues', v)}
                  onRemove={(i) => handleRemoveItem('issues', i)}
                  isDanger
                />
                <DetailList 
                  label="첨부 파일" 
                  items={isEditing ? (editData.attachments || []) : (project.attachments || [])} 
                  isEditing={isEditing}
                  onAdd={(v) => handleAddItem('attachments', v)}
                  onRemove={(i) => handleRemoveItem('attachments', i)}
                  isLink
                />
              </div>
            </section>
          </div>

          {/* Media Preview Section */}
          {(project.attachments && project.attachments.length > 0) && (
            <section className="space-y-6 pt-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">시안확인</h3>
              <div className="grid grid-cols-3 gap-4">
                {project.attachments.map((url, i) => (
                  <div key={i} className="group relative aspect-video bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                    {url.match(/\.(mp4|webm|ogg)$/i) || url.includes('youtube') || url.includes('vimeo') ? (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Video size={32} />
                      </div>
                    ) : (
                      <img src={url} alt={`Attachment ${i}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    )}
                    <a 
                      href={url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      <ExternalLink size={24} />
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function DetailItem({ label, value, isEditing, children }: { label: string, value: string | number, isEditing: boolean, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</Label>
      {isEditing ? children : <p className="text-sm font-semibold text-slate-700">{value}</p>}
    </div>
  );
}

function DetailList({ label, items, isEditing, onAdd, onRemove, isDanger = false, isLink = false, layout = 'list' }: { 
  label: string, 
  items: string[], 
  isEditing: boolean, 
  onAdd: (v: string) => void,
  onRemove: (i: number) => void,
  isDanger?: boolean,
  isLink?: boolean,
  layout?: 'list' | 'grid'
}) {
  const [input, setInput] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-slate-500">{label}</Label>
        {isEditing && (
          <div className="flex gap-2">
            <Input 
              size={1}
              className="h-8 text-xs w-32" 
              placeholder="추가..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  onAdd(input);
                  setInput('');
                }
              }}
            />
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { onAdd(input); setInput(''); }}>
              <PlusCircle size={16} className="text-sleek-primary" />
            </Button>
          </div>
        )}
      </div>
      <div className={cn(layout === 'grid' ? "flex flex-wrap gap-2" : "space-y-2")}>
        {items.map((item, i) => (
          <div key={i} className={cn(
            "flex items-center justify-between transition-all border",
            layout === 'grid' ? "p-1.5 px-3 rounded-full text-xs" : "p-3 rounded-xl text-sm",
            isDanger ? "bg-red-50 border-red-100 text-red-700" : "bg-slate-50 border-slate-100 text-slate-700"
          )}>
            <div className="flex items-center gap-2 overflow-hidden">
              {isLink ? <FileText size={14} className="shrink-0" /> : <CheckCircle2 size={14} className="shrink-0" />}
              <span className="truncate">{item}</span>
            </div>
            {isEditing && (
              <button onClick={() => onRemove(i)} className="ml-2 text-slate-400 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            )}
            {isLink && !isEditing && (
              <a href={item} target="_blank" rel="noopener noreferrer" className="ml-2 text-sleek-primary hover:underline">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-300 italic">등록된 항목이 없습니다.</p>}
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-md cursor-pointer transition-all duration-200 text-sm",
        active 
          ? "bg-slate-800 text-white font-bold border-r-4 border-sleek-primary rounded-r-none" 
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      )}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatCard({ title, value, color, active = false, onClick }: { title: string, value: number, color: string, active?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white p-5 rounded-xl shadow-sm border-l-4 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5",
        active ? "ring-2 ring-sleek-primary ring-offset-2" : ""
      )}
      style={{ borderLeftColor: color }}
    >
      <p className="text-xs font-bold text-sleek-text-sub uppercase tracking-wider mb-2">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function getStatusLabel(status: ProjectStatus) {
  const labels = {
    ongoing: "진행중",
    upcoming: "예정",
    regular: "상시",
    issue: "이슈",
    completed: "완료",
  };
  return labels[status];
}

function MiniSection({ title, count, items, variant = 'default', groupByCell = false, onClickItem }: { 
  title: string, 
  count: number, 
  items: Project[], 
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'info',
  groupByCell?: boolean,
  onClickItem: (id: string) => void 
}) {
  const variantStyles = {
    default: "bg-white border-slate-100",
    primary: "bg-white border-blue-200 ring-2 ring-blue-100 shadow-blue-50",
    warning: "bg-white border-amber-200 ring-2 ring-amber-50",
    danger: "bg-white border-red-200 ring-2 ring-red-50",
    info: "bg-white border-slate-200 ring-2 ring-slate-50",
  };

  const titleStyles = {
    default: "text-slate-800",
    primary: "text-blue-700",
    warning: "text-amber-700",
    danger: "text-red-700",
    info: "text-slate-700",
  };

  const badgeStyles = {
    default: "bg-slate-100 text-slate-600",
    primary: "bg-blue-600 text-white",
    warning: "bg-amber-500 text-white",
    danger: "bg-red-500 text-white",
    info: "bg-slate-600 text-white",
  };

  const groupedItems = useMemo<Record<string, Project[]>>(() => {
    if (!groupByCell) return { '전체': items };
    const groups: Record<string, Project[]> = {};
    items.forEach(item => {
      const cell = item.taskCell || '기타';
      if (!groups[cell]) groups[cell] = [];
      groups[cell].push(item);
    });
    return groups;
  }, [items, groupByCell]);

  return (
    <div className={cn(
      "p-6 rounded-xl shadow-sm min-h-[200px] flex flex-col border transition-all",
      variantStyles[variant],
      variant === 'primary' && "scale-[1.02] shadow-md z-10"
    )}>
      <div className="flex items-center justify-between mb-4">
        <h4 className={cn("text-sm font-bold uppercase tracking-tight", titleStyles[variant])}>{title}</h4>
        <Badge className={cn("text-xs px-2.5 h-6 font-bold", badgeStyles[variant])}>
          {count}
        </Badge>
      </div>
      <div className="flex-1 -mx-2 px-2">
        <div className="space-y-4">
          {(Object.entries(groupedItems) as [string, Project[]][]).map(([cell, cellItems]) => (
            <div key={cell} className="space-y-1.5">
              {groupByCell && (
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-px flex-1 bg-slate-100"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cell}</span>
                  <div className="h-px flex-1 bg-slate-100"></div>
                </div>
              )}
              {cellItems.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => onClickItem(item.id)}
                  className="flex items-center justify-between text-sm py-2 border-b border-black/5 last:border-0 cursor-pointer hover:bg-slate-50 rounded px-2 transition-colors"
                >
                  <span className="truncate pr-2 font-semibold text-slate-700">{item.name}</span>
                  {variant !== 'danger' && (
                    <span className={cn(
                      "font-bold shrink-0 text-sleek-primary"
                    )}>
                      {item.status === 'upcoming' ? `D-${Math.floor(Math.random() * 30)}` : `${item.progress}%`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
          {items.length === 0 && (
            <div className="h-32 flex items-center justify-center">
              <p className="text-sm text-slate-300 italic">데이터 없음</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: ProjectStatus }) {
  const styles = {
    ongoing: "bg-green-100 text-green-700",
    upcoming: "bg-yellow-100 text-yellow-700",
    regular: "bg-blue-100 text-blue-700",
    issue: "bg-red-100 text-red-700",
    completed: "bg-emerald-100 text-emerald-700",
  };
  
  const label = getStatusLabel(status);

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", styles[status])}>
      {label}
    </span>
  );
}

function DynamicListInput({ label, items, onAdd, onRemove, placeholder = "추가..." }: { 
  label: string, 
  items: string[], 
  onAdd: (val: string) => void, 
  onRemove: (i: number) => void,
  placeholder?: string
}) {
  const [input, setInput] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</Label>
        <div className="flex gap-2">
          <Input 
            size={1}
            className="h-9 text-xs w-32 border-slate-200" 
            placeholder={placeholder} 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onAdd(input);
                setInput('');
              }
            }}
          />
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:bg-emerald-50" onClick={() => { onAdd(input); setInput(''); }}>
            <PlusCircle size={18} className="text-sleek-primary" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {items.map((item, i) => (
          <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] px-2 py-1 gap-1 group">
            <span className="max-w-[120px] truncate">{item}</span>
            <X size={12} className="cursor-pointer hover:text-red-500 transition-colors" onClick={() => onRemove(i)} />
          </Badge>
        ))}
        {items.length === 0 && <span className="text-[10px] text-slate-300 italic">항목 없음</span>}
      </div>
    </div>
  );
}
