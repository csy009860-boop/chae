import React, { useState, useMemo, useEffect } from 'react';
// Force sync comment
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
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Project, ProjectStatus } from './types';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { 
  db, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all');

  // Firestore Listener
  useEffect(() => {
    const q = query(
      collection(db, 'projects'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Project[];
      setProjects(projectsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => unsubscribe();
  }, []);

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
    regular: projects.filter(p => p.status === 'regular').length,
    issue: projects.filter(p => p.issues.length > 0).length,
    completed: projects.filter(p => p.status === 'completed').length,
  }), [projects]);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.pm.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddProject = async () => {
    try {
      const projectData = {
        ...newProject,
        uid: 'public',
        createdAt: new Date().toISOString(),
        attachments: newProject.attachments || [],
      };
      await addDoc(collection(db, 'projects'), projectData);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    try {
      const { id, ...data } = updatedProject;
      await updateDoc(doc(db, 'projects', id), data);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${updatedProject.id}`);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      if (selectedProjectId === id) setSelectedProjectId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
    }
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
          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Project List</div>
          {filteredProjects.map(p => (
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
            <div className="w-8 h-8 bg-sleek-primary rounded-full flex items-center justify-center text-xs font-bold text-white">
              P
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-white">공용 모드</p>
              <p className="text-[10px] text-slate-500 truncate">누구나 편집 가능</p>
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
            <div className="grid grid-cols-6 gap-4 shrink-0">
              <StatCard 
                title="전체 업무" 
                value={stats.total} 
                color="var(--color-sleek-primary)" 
                active={filterStatus === 'all'}
                onClick={() => setFilterStatus('all')}
              />
              <StatCard 
                title="진행 프로젝트" 
                value={stats.ongoing} 
                color="var(--color-sleek-success)" 
                active={filterStatus === 'ongoing'}
                onClick={() => setFilterStatus('ongoing')}
              />
              <StatCard 
                title="예정 프로젝트" 
                value={stats.upcoming} 
                color="var(--color-sleek-warning)" 
                active={filterStatus === 'upcoming'}
                onClick={() => setFilterStatus('upcoming')}
              />
              <StatCard 
                title="상시 업무" 
                value={stats.regular} 
                color="var(--color-sleek-info)" 
                active={filterStatus === 'regular'}
                onClick={() => setFilterStatus('regular')}
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

            {/* Content Grid - Redesigned Layout */}
            <div className="flex gap-6">
              {/* Left Side: Ongoing & Completed Projects (50%) */}
              <div className="w-1/2 flex flex-col gap-6">
                <div>
                  <MiniSection 
                    title="진행중 프로젝트" 
                    count={stats.ongoing} 
                    items={projects.filter(p => p.status === 'ongoing')} 
                    onClickItem={setSelectedProjectId} 
                    variant="primary"
                    groupByCell
                  />
                </div>
                <div>
                  <MiniSection 
                    title="완료 업무" 
                    count={stats.completed} 
                    items={projects.filter(p => p.status === 'completed')} 
                    onClickItem={setSelectedProjectId} 
                    variant="default"
                    groupByCell
                  />
                </div>
              </div>

              {/* Right Side: Issues, Upcoming, Regular (50%) */}
              <div className="w-1/2 flex flex-col gap-6">
                <div>
                  <MiniSection 
                    title="이슈 사항" 
                    count={stats.issue} 
                    items={projects.filter(p => p.issues.length > 0)} 
                    onClickItem={setSelectedProjectId} 
                    variant="danger"
                  />
                </div>
                <div>
                  <MiniSection 
                    title="예정 프로젝트" 
                    count={stats.upcoming} 
                    items={projects.filter(p => p.status === 'upcoming')} 
                    onClickItem={setSelectedProjectId} 
                    variant="warning"
                    groupByCell
                  />
                </div>
                <div>
                  <MiniSection 
                    title="상시 업무" 
                    count={stats.regular} 
                    items={projects.filter(p => p.status === 'regular')} 
                    onClickItem={setSelectedProjectId} 
                    variant="info"
                    groupByCell
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Project Dialog (Improved UI) */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[1200px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
            <div className="bg-sleek-sidebar p-8 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tight">새 프로젝트 생성</DialogTitle>
                <p className="text-slate-400 text-sm mt-1">프로젝트의 기본 정보와 구성 요소를 입력하여 관리를 시작하세요.</p>
              </DialogHeader>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                <div className="space-y-2 md:col-span-2">
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

      <div className="flex-1 overflow-y-auto p-8 bg-white">
        <div className="w-full space-y-10">
          {/* Basic Info Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-8">
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1 h-4 bg-sleek-primary rounded-full" />
                기본 정보
              </h3>
              <StatusTag status={isEditing ? editData.status : project.status} />
            </div>
            
            <div className="grid grid-cols-3 gap-x-12 gap-y-8">
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
          <div className="grid grid-cols-2 gap-8">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-8">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-4">
                <div className="w-1 h-4 bg-sleek-primary rounded-full" />
                인력 및 업무
              </h3>
              <div className="space-y-10">
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
                  inputWidth="400px"
                />
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-8">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-4">
                <div className="w-1 h-4 bg-sleek-primary rounded-full" />
                이슈 및 첨부파일
              </h3>
              <div className="space-y-10">
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
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-8">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-4">
                <div className="w-1 h-4 bg-sleek-primary rounded-full" />
                시안확인
              </h3>
              <div className="grid grid-cols-3 gap-6">
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
      </div>
    </div>
  );
}

function DetailItem({ label, value, isEditing, children }: { label: string, value: string | number, isEditing: boolean, children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">{label}</Label>
      <div className={cn(
        "transition-all",
        !isEditing && "bg-white rounded-lg p-3 border border-slate-100 hover:border-slate-300 hover:shadow-sm"
      )}>
        {isEditing ? children : <p className="text-sm font-bold text-slate-700">{value}</p>}
      </div>
    </div>
  );
}

function DetailList({ label, items, isEditing, onAdd, onRemove, isDanger = false, isLink = false, layout = 'list', inputWidth }: { 
  label: string, 
  items: string[], 
  isEditing: boolean, 
  onAdd: (v: string) => void,
  onRemove: (i: number) => void,
  isDanger?: boolean,
  isLink?: boolean,
  layout?: 'list' | 'grid',
  inputWidth?: string
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
              className="h-8 text-xs" 
              style={{ width: inputWidth || '128px' }}
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

  const groupedItems = useMemo<[string, Project[]][]>(() => {
    if (!groupByCell) return [['전체', items]];
    const groups: Record<string, Project[]> = {};
    items.forEach(item => {
      const cell = item.taskCell || '기타';
      if (!groups[cell]) groups[cell] = [];
      groups[cell].push(item);
    });

    // Sort groups by specific order: 공통 > 영상셀 > UX셀 > 편집셀
    const order = ['공통', '영상셀', 'UX셀', '편집셀'];
    const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedEntries;
  }, [items, groupByCell]);

  return (
    <div className={cn(
      "p-4 rounded-xl shadow-sm flex flex-col border transition-all min-h-[250px]",
      variantStyles[variant],
      variant === 'primary' && "shadow-md z-10"
    )}>
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h4 className={cn("text-sm font-bold uppercase tracking-tight", titleStyles[variant])}>{title}</h4>
        <Badge className={cn("text-xs px-2.5 h-6 font-bold", badgeStyles[variant])}>
          {count}
        </Badge>
      </div>
      <div className="flex-1 -mx-2 px-2">
        <div className="space-y-1">
          {groupedItems.map(([cell, cellItems], groupIndex, groupArray) => (
            <div key={cell} className="space-y-0">
              {groupByCell && (
                <div className="flex items-center gap-2 py-1 mt-1">
                  <div className="h-px flex-1 bg-slate-100"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">{cell}</span>
                  <div className="h-px flex-1 bg-slate-100"></div>
                </div>
              )}
              {cellItems.map((item, itemIndex) => (
                <div 
                  key={item.id} 
                  onClick={() => onClickItem(item.id)}
                  className={cn(
                    "flex flex-col gap-1 text-sm py-2 border-b border-slate-100 cursor-pointer hover:bg-slate-50/50 rounded-sm px-2 transition-colors",
                    itemIndex === cellItems.length - 1 && "border-b-0"
                  )}
                >
                  {/* Row 1: Project Name & Progress */}
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={cn(
                        "truncate font-bold text-slate-800",
                        variant === 'primary' ? "text-lg" : "text-sm"
                      )}>
                        {variant === 'danger' && item.issues.length > 0 ? item.issues[0] : item.name}
                      </span>
                      {item.issues.length > 0 && variant !== 'danger' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] font-bold text-red-600">이슈</span>
                          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-[10px] text-red-600 font-bold">
                            {item.issues.length}
                          </div>
                        </div>
                      )}
                    </div>
                    {variant !== 'danger' && (
                      <div className="flex items-center gap-2 shrink-0">
                        {variant !== 'warning' && (
                          <span className="text-[11px] font-medium text-sleek-primary/60">진행율</span>
                        )}
                        <span className="font-bold text-sleek-primary text-base">
                          {item.status === 'upcoming' ? `D-${Math.floor(Math.random() * 30)}` : `${item.progress}%`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Status, Cell, PM, Assignees, Deadline (Only for Ongoing Projects) */}
                  {variant === 'primary' && (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4 flex-wrap">
                        <StatusTag status={item.status} />
                        <Badge variant="outline" className="text-[10px] font-bold border-slate-200 text-slate-500 h-6 px-2">
                          {item.taskCell}
                        </Badge>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-400">PM</span>
                          <span className="text-[12px] text-slate-700 font-bold">{item.pm}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-400">담당자</span>
                          <span className="text-[12px] text-slate-700 font-bold truncate max-w-[150px]">
                            {item.assignees.join(', ')}
                          </span>
                        </div>
                      </div>

                      {item.deadline && (
                        <div className="text-[11px] font-bold text-slate-700 shrink-0">
                          마감일 - {item.deadline}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {variant === 'danger' && (
                    <span className="text-[10px] text-slate-400 font-medium truncate block">
                      프로젝트: {item.name}
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
