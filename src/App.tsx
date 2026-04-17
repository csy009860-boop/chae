import React, { useState, useMemo, useEffect } from 'react';
// Force sync comment
import { 
  LayoutDashboard, 
  Briefcase, 
  Calendar as CalendarIcon, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Search, 
  Bell, 
  Users,
  User,
  CheckCircle2,
  Clock,
  ChevronRight,
  MoreVertical,
  PlusCircle,
  RotateCcw,
  Edit3,
  Save,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  ExternalLink,
  ArrowLeft,
  Maximize2,
  Monitor
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
import { Project, ProjectStatus, TeamMember } from './types';
import { cn } from './lib/utils';
import { format, differenceInDays, parseISO, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
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
  orderBy,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import CalendarView from './components/CalendarView';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'calendar' | 'team'>('dashboard');
  const [dashboardProjectTab, setDashboardProjectTab] = useState<'ongoing' | 'completed'>('ongoing');
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [isPreviewMode] = useState(() => {
    return new URLSearchParams(window.location.search).get('view') === 'preview';
  });
  const [sessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('sid');
    if (sid) return sid;
    
    // For dashboard, generate or retrieve from session storage
    let localSid = sessionStorage.getItem('preview_session_id');
    if (!localSid) {
      localSid = `sid_${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem('preview_session_id', localSid);
    }
    return localSid;
  });
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  // Database-Driven Sync (Receiver & Listener Logic)
  useEffect(() => {
    // 1. BroadcastChannel (Quick local sync fallback)
    const channel = new BroadcastChannel('draft_preview_sync');
    channel.onmessage = (event) => {
      if (event.data?.type === 'UPDATE_PREVIEW') {
        setActivePreviewUrl(event.data.url);
      }
    };

    // 2. LocalStorage Sync (Reliable local fallback)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `active_draft_${sessionId}` && e.newValue) {
        setActivePreviewUrl(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Firestore Sync (Ultimate cloud sync - works everywhere)
    const syncDocRef = doc(db, 'preview_sync', sessionId);
    const unsubscribeSync = onSnapshot(syncDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.url && data.url !== activePreviewUrl) {
          setActivePreviewUrl(data.url);
        }
      }
    });

    return () => {
      channel.close();
      window.removeEventListener('storage', handleStorage);
      unsubscribeSync();
    };
  }, [isPreviewMode, sessionId]);

  // Sync Global Broadcaster (Sender Logic)
  useEffect(() => {
    if (activePreviewUrl && !isPreviewMode) {
      // A. Update Firestore (Best for cross-tab/cross-origin)
      const syncDocRef = doc(db, 'preview_sync', sessionId);
      setDoc(syncDocRef, { 
        url: activePreviewUrl, 
        updatedAt: serverTimestamp() 
      }).catch(err => console.error("Sync Error:", err));

      // B. Update LocalStorage
      localStorage.setItem(`active_draft_${sessionId}`, activePreviewUrl);
      
      // C. Broadcast
      const channel = new BroadcastChannel('draft_preview_sync');
      channel.postMessage({ type: 'UPDATE_PREVIEW', url: activePreviewUrl });
      channel.close();
    }
  }, [activePreviewUrl, isPreviewMode, sessionId]);

  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [newMember, setNewMember] = useState<Partial<TeamMember>>({
    name: '',
    rank: '연구원',
    role: '팀원',
    cell: 'UX셀',
    contact: '',
    email: ''
  });

  // Firestore Listener
  useEffect(() => {
    const q = query(
      collection(db, 'projects'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Data migration: if taskCell is '공통', convert to all 3 cells. If string, convert to array.
        let taskCell = data.taskCell;
        if (taskCell === '공통') {
          taskCell = ['UX셀', '영상셀', '편집셀'];
        } else if (typeof taskCell === 'string') {
          taskCell = taskCell ? [taskCell] : [];
        } else if (!Array.isArray(taskCell)) {
          taskCell = [];
        }

        return {
          ...data,
          id: doc.id,
          taskCell
        } as Project;
      });
      setProjects(projectsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => unsubscribe();
  }, []);

  // Team Members Listener
  useEffect(() => {
    const q = query(collection(db, 'teamMembers'), orderBy('index', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember));
      setTeamMembers(data);
      
      // Auto-seed if empty
      if (snapshot.empty) {
        seedTeamMembers();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teamMembers');
    });
    return () => unsubscribe();
  }, []);

  const seedTeamMembers = async () => {
    // Basic check to prevent multiple triggerings if it's already running
    if (teamMembers.length > 5) return; 

    const members = [
      { index: 1, name: '신혜영', rank: '수석연구원', role: '팀장', cell: '공통', contact: '010-9595-3511', email: 'shy0622@hanmaceng.co.kr' },
      { index: 2, name: '정은혜', rank: '책임연구원', role: '셀장', cell: 'UX셀', contact: '010-3378-1154', email: 'b21339@hanmaceng.co.kr' },
      { index: 3, name: '김태식', rank: '책임연구원', role: '셀장', cell: '영상셀', contact: '010-9965-9940', email: 'b22046@hanmaceng.co.kr' },
      { index: 4, name: '최혜은', rank: '선임연구원', role: '셀장', cell: '편집셀', contact: '010-3453-2360', email: 'b23060@hanmaceng.co.kr' },
      { index: 5, name: '채선영', rank: '선임연구원', role: '팀원', cell: 'UX셀', contact: '010-9523-0055', email: 'b24027@hanmaceng.co.kr' },
      { index: 6, name: '최영환', rank: '선임연구원', role: '팀원', cell: '영상셀', contact: '010-2905-0933', email: 'cyhwan0933@hanmaceng.co.kr' },
      { index: 7, name: '윤봄이', rank: '선임연구원', role: '팀원', cell: '편집셀', contact: '010-8482-2633', email: 'b24016@hanmaceng.co.kr' },
      { index: 8, name: '이예진', rank: '선임연구원', role: '팀원', cell: '편집셀', contact: '010-9262-7530', email: 'b23028@hanmaceng.co.kr' },
      { index: 9, name: '허유나', rank: '선임연구원', role: '팀원', cell: 'UX셀', contact: '010-8870-9345', email: 'b22011@hanmaceng.co.kr' },
      { index: 10, name: '마희연', rank: '선임연구원', role: '팀원', cell: '편집셀', contact: '010-5336-9812', email: 'b23015@hanmaceng.co.kr' },
      { index: 11, name: '김수현', rank: '선임연구원', role: '팀원', cell: 'UX셀', contact: '010-5645-5153', email: 'b25027@hanmaceng.co.kr' },
      { index: 12, name: '박지영', rank: '선임연구원', role: '팀원', cell: '영상셀', contact: '010-9055-4775', email: 'm21438@hanmaceng.co.kr' },
      { index: 13, name: '권순호', rank: '연구원', role: '팀원', cell: '영상셀', contact: '010-4432-4117', email: 'b22003@hanmaceng.co.kr' },
      { index: 14, name: '정두휘', rank: '연구원', role: '팀원', cell: '영상셀', contact: '010-5521-6160', email: 'b23014@hanmaceng.co.kr' },
      { index: 15, name: '김정석', rank: '연구원', role: '팀원', cell: 'UX셀', contact: '010-5209-7757', email: 'b24049@hanmaceng.co.kr' },
      { index: 16, name: '정지윤', rank: '연구원', role: '팀원', cell: '편집셀', contact: '010-7132-6329', email: 'b25017@hanmaceng.co.kr' },
      { index: 17, name: '양숙영', rank: '연구원', role: '팀원', cell: '영상셀', contact: '010-7371-7662', email: 'b24012@hanmaceng.co.kr' }
    ];
    for (const m of members) {
      await addDoc(collection(db, 'teamMembers'), m);
    }
  };

  // New Project State
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '',
    status: 'ongoing',
    taskCell: [],
    collabTeam: '',
    collabManager: '',
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

  const filteredProjects = useMemo(() => {
    const filtered = projects.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pm.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort order: 진행중(ongoing) > 완료(completed) > 예정(upcoming) > 상시(regular)
    const statusOrder: Record<string, number> = {
      ongoing: 0,
      completed: 1,
      upcoming: 2,
      regular: 3
    };

    return filtered.sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 99;
      const orderB = statusOrder[b.status] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }, [projects, searchTerm]);

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
        taskCell: [],
        collabTeam: '',
        collabManager: '',
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

  const handleAddMember = async () => {
    if (!newMember.name || !newMember.email) return;
    try {
      const memberData = {
        ...newMember,
        index: (teamMembers.length > 0 ? Math.max(...teamMembers.map(m => m.index)) : 0) + 1,
      };
      await addDoc(collection(db, 'teamMembers'), memberData);
      setIsMemberModalOpen(false);
      setNewMember({
        name: '',
        rank: '연구원',
        role: '팀원',
        cell: 'UX셀',
        contact: '',
        email: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'teamMembers');
    }
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !editingMember.id) return;
    try {
      const { id, ...data } = editingMember;
      await updateDoc(doc(db, 'teamMembers', id), data);
      setIsEditMemberModalOpen(false);
      setEditingMember(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teamMembers/${editingMember.id}`);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'teamMembers', id));
      setIsEditMemberModalOpen(false);
      setEditingMember(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teamMembers/${id}`);
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

  if (isPreviewMode) {
    return (
      <div className="w-screen h-screen bg-slate-900 flex flex-col overflow-hidden">
        <div className="h-14 bg-slate-950 flex items-center justify-between px-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-white font-bold tracking-tight">실시간 시안 모니터 (연동됨)</h1>
          </div>
          <div className="flex items-center gap-4 text-slate-400 text-xs font-medium">
            대시보드와 동기화 중...
          </div>
        </div>
        <div className="flex-1 bg-slate-800 flex items-center justify-center p-8">
          {activePreviewUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src={activePreviewUrl} 
                alt="Preview Target" 
                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="text-slate-400 flex flex-col items-center gap-4">
              <Monitor size={48} strokeWidth={1.5} />
              <p className="font-medium">대시보드에서 시안을 선택해주세요</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-sleek-bg text-sleek-text-main">
      {/* Sidebar */}
      <aside className="w-80 bg-sleek-sidebar text-white flex flex-col shrink-0">
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
            active={currentView === 'dashboard' && !selectedProjectId} 
            onClick={() => { setCurrentView('dashboard'); setSelectedProjectId(null); setIsEditing(false); }}
          />
          <NavItem 
            icon={<CalendarIcon size={18} />} 
            label="캘린더" 
            active={currentView === 'calendar'} 
            onClick={() => { setCurrentView('calendar'); setSelectedProjectId(null); setIsEditing(false); }}
          />
          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Project List</div>
          {filteredProjects.map(p => (
            <div 
              key={p.id} 
              onClick={() => { setSelectedProjectId(p.id); setIsEditing(false); }}
              className={cn(
                "group flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer rounded-md transition-all",
                selectedProjectId === p.id ? "bg-slate-800 text-white font-bold border-r-4 border-sleek-primary rounded-r-none" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <StatusTag status={p.status} />
              <span className="truncate flex-1">{p.name}</span>
              {p.issues.length > 0 && (
                <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center text-[10px] text-rose-600 font-bold shrink-0">
                  {p.issues.length}
                </div>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity ml-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between gap-3 p-1">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 bg-sleek-primary rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
                P
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate text-white">공용 모드</p>
                <p className="text-[10px] text-slate-500 truncate">누구나 편집 가능</p>
              </div>
            </div>
            
            <button 
              onClick={() => { setCurrentView('team'); setSelectedProjectId(null); setIsEditing(false); }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all border shrink-0",
                currentView === 'team' 
                  ? "bg-slate-800 text-white border-slate-700 shadow-lg" 
                  : "text-slate-500 hover:text-slate-300 border-transparent hover:bg-slate-800/50"
              )}
            >
              <Users size={16} />
              <span className="text-xs font-bold">인원 관리</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedProject ? (
          <ProjectDetailView 
            project={selectedProject} 
            teamMembers={teamMembers}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onUpdate={handleUpdateProject}
            onBack={() => {
              setSelectedProjectId(null);
              setIsEditing(false);
            }}
            onPreview={setActivePreviewUrl}
          />
        ) : currentView === 'calendar' ? (
          <CalendarView 
            projects={projects} 
            teamMembers={teamMembers}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setCurrentView('dashboard');
              setIsEditing(false);
            }}
            onDeleteProject={handleDeleteProject}
          />
        ) : currentView === 'team' ? (
          <TeamMemberListView 
            members={teamMembers} 
            onAddClick={() => setIsMemberModalOpen(true)}
            onEditClick={(member) => {
              setEditingMember(member);
              setIsEditMemberModalOpen(true);
            }}
            onResetSeed={() => {
              // Only seed if drastically fewer members than expected
              if (teamMembers.length < 5) seedTeamMembers();
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto">
            {/* Header Stats */}
            <div className="grid grid-cols-6 gap-4 shrink-0">
              <StatCard 
                title="전체 업무" 
                value={stats.total} 
                color="var(--color-sleek-primary)" 
              />
              <StatCard 
                title="진행 프로젝트" 
                value={stats.ongoing} 
                color="var(--color-sleek-primary)" 
              />
              <StatCard 
                title="예정 프로젝트" 
                value={stats.upcoming} 
                color="var(--color-sleek-warning)" 
              />
              <StatCard 
                title="상시 프로젝트" 
                value={stats.regular} 
                color="var(--color-sleek-navy)" 
              />
              <StatCard 
                title="완료 프로젝트" 
                value={stats.completed} 
                color="var(--color-sleek-success)" 
              />
              <StatCard 
                title="이슈 사항" 
                value={stats.issue} 
                color="#dc2626" // red-600
              />
            </div>

            {/* Content Grid - Redesigned Layout */}
            <div className="flex gap-6">
              {/* Left Side: Ongoing & Completed Projects (Consolidated) */}
              <div className="w-1/2 flex flex-col">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setDashboardProjectTab('ongoing')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                          dashboardProjectTab === 'ongoing' ? "bg-sleek-primary text-white shadow-md" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        진행 프로젝트 ({stats.ongoing})
                      </button>
                      <button 
                        onClick={() => setDashboardProjectTab('completed')}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                          dashboardProjectTab === 'completed' ? "bg-green-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        완료 프로젝트 ({stats.completed})
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 p-6 overflow-y-auto">
                    <MiniSection 
                      title={dashboardProjectTab === 'ongoing' ? "진행 프로젝트 목록" : "완료 프로젝트 목록"}
                      hideHeader
                      items={projects.filter(p => p.status === dashboardProjectTab)} 
                      onClickItem={setSelectedProjectId} 
                      variant={dashboardProjectTab === 'ongoing' ? "primary" : "info"}
                      groupByCell
                    />
                  </div>
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
                    title="상시 프로젝트" 
                    count={stats.regular} 
                    items={projects.filter(p => p.status === 'regular')} 
                    onClickItem={setSelectedProjectId} 
                    variant="default"
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
                  <Label className="text-xs font-bold text-slate-500 uppercase">작업 셀 (중복 선택 가능)</Label>
                  <div className="flex flex-wrap gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {['UX셀', '영상셀', '편집셀'].map(cell => (
                      <div key={cell} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cell-${cell}`}
                          checked={(newProject.taskCell || []).includes(cell)}
                          onCheckedChange={(checked) => {
                            const current = newProject.taskCell || [];
                            if (checked) {
                              setNewProject({...newProject, taskCell: [...current, cell]});
                            } else {
                              setNewProject({...newProject, taskCell: current.filter(c => c !== cell)});
                            }
                          }}
                        />
                        <Label htmlFor={`cell-${cell}`} className="text-sm font-medium cursor-pointer">{cell}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">협업팀</Label>
                  <Input 
                    value={newProject.collabTeam} 
                    onChange={e => setNewProject({...newProject, collabTeam: e.target.value})}
                    placeholder="협업 부서/팀명"
                    className="h-11 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">협업 담당자</Label>
                  <Input 
                    value={newProject.collabManager} 
                    onChange={e => setNewProject({...newProject, collabManager: e.target.value})}
                    placeholder="협업 담당자 성함"
                    className="h-11 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">PM (책임자)</Label>
                  <Select 
                    value={newProject.pm} 
                    onValueChange={v => setNewProject({...newProject, pm: v})}
                  >
                    <SelectTrigger className="h-11 border-slate-200">
                      <SelectValue placeholder="PM 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map(m => (
                        <SelectItem key={m.id} value={m.name}>
                          {m.name} ({m.rank}/{m.cell})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    options={teamMembers.map(m => `${m.name} (${m.rank}/${m.cell})`)}
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
        <Dialog open={isMemberModalOpen} onOpenChange={setIsMemberModalOpen}>
          <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
            <DialogHeader className="p-8 bg-slate-900 text-white">
              <DialogTitle className="text-2xl font-bold tracking-tight">새로운 팀원 추가</DialogTitle>
              <p className="text-slate-400 text-sm mt-1">팀 데이터베이스에 새로운 인원을 등록합니다.</p>
            </DialogHeader>

            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto bg-white">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">이름</Label>
                  <Input 
                    value={newMember.name} 
                    onChange={e => setNewMember({...newMember, name: e.target.value})}
                    placeholder="성함을 입력하세요"
                    className="h-11 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">직급</Label>
                  <Select 
                    value={newMember.rank} 
                    onValueChange={v => setNewMember({...newMember, rank: v})}
                  >
                    <SelectTrigger className="h-11 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['수석연구원', '책임연구원', '선임연구원', '연구원'].map(rank => (
                        <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">역할</Label>
                  <Select 
                    value={newMember.role} 
                    onValueChange={v => setNewMember({...newMember, role: v})}
                  >
                    <SelectTrigger className="h-11 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['팀장', '셀장', '팀원'].map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">소속 셀</Label>
                  <Select 
                    value={newMember.cell} 
                    onValueChange={v => setNewMember({...newMember, cell: v})}
                  >
                    <SelectTrigger className="h-11 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['공통', 'UX셀', '영상셀', '편집셀'].map(cell => (
                        <SelectItem key={cell} value={cell}>{cell}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">연락처</Label>
                <Input 
                  value={newMember.contact} 
                  onChange={e => setNewMember({...newMember, contact: e.target.value})}
                  placeholder="010-0000-0000"
                  className="h-11 border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">이메일</Label>
                <Input 
                  type="email"
                  value={newMember.email} 
                  onChange={e => setNewMember({...newMember, email: e.target.value})}
                  placeholder="example@hanmaceng.co.kr"
                  className="h-11 border-slate-200"
                />
              </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsMemberModalOpen(false)} className="h-11 px-8 font-bold text-slate-500">취소</Button>
              <Button className="h-11 px-10 bg-sleek-primary hover:bg-blue-600 font-bold shadow-lg shadow-blue-200" onClick={handleAddMember}>팀원 추가하기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Member Modal */}
        <Dialog open={isEditMemberModalOpen} onOpenChange={setIsEditMemberModalOpen}>
          <DialogContent className="max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
            <DialogHeader className="p-8 bg-slate-900 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl font-bold tracking-tight">팀원 정보 수정</DialogTitle>
                  <p className="text-slate-400 text-sm mt-1">팀원의 정보를 수정하거나 삭제할 수 있습니다.</p>
                </div>
                <Button 
                  variant="destructive" 
                  size="icon"
                  className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white transition-all"
                  onClick={() => editingMember && handleDeleteMember(editingMember.id)}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </DialogHeader>

            {editingMember && (
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto bg-white">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">이름</Label>
                    <Input 
                      value={editingMember.name} 
                      onChange={e => setEditingMember({...editingMember, name: e.target.value})}
                      placeholder="성함을 입력하세요"
                      className="h-11 border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">직급</Label>
                    <Select 
                      value={editingMember.rank} 
                      onValueChange={v => setEditingMember({...editingMember, rank: v})}
                    >
                      <SelectTrigger className="h-11 border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['수석연구원', '책임연구원', '선임연구원', '연구원'].map(rank => (
                          <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">역할</Label>
                    <Select 
                      value={editingMember.role} 
                      onValueChange={v => setEditingMember({...editingMember, role: v})}
                    >
                      <SelectTrigger className="h-11 border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['팀장', '셀장', '팀원'].map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase">소속 셀</Label>
                    <Select 
                      value={editingMember.cell} 
                      onValueChange={v => setEditingMember({...editingMember, cell: v})}
                    >
                      <SelectTrigger className="h-11 border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['공통', 'UX셀', '영상셀', '편집셀'].map(cell => (
                          <SelectItem key={cell} value={cell}>{cell}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">연락처</Label>
                  <Input 
                    value={editingMember.contact} 
                    onChange={e => setEditingMember({...editingMember, contact: e.target.value})}
                    placeholder="010-0000-0000"
                    className="h-11 border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">이메일</Label>
                  <Input 
                    type="email"
                    value={editingMember.email} 
                    onChange={e => setEditingMember({...editingMember, email: e.target.value})}
                    placeholder="example@hanmaceng.co.kr"
                    className="h-11 border-slate-200"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setIsEditMemberModalOpen(false)} className="h-11 px-8 font-bold text-slate-500">취소</Button>
              <Button className="h-11 px-10 bg-sleek-primary hover:bg-blue-600 font-bold shadow-lg shadow-blue-200" onClick={handleUpdateMember}>저장하기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Synced Floating Preview Window */}
        <AnimatePresence mode="wait">
          {activePreviewUrl && (
            <PreviewWindow 
              url={activePreviewUrl} 
              onClose={() => setActivePreviewUrl(null)} 
              sessionId={sessionId}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function ProjectDetailView({ project, teamMembers, isEditing, setIsEditing, onUpdate, onBack, onPreview }: { 
  project: Project, 
  teamMembers: TeamMember[],
  isEditing: boolean, 
  setIsEditing: (v: boolean) => void,
  onUpdate: (p: Project) => void,
  onBack: () => void,
  onPreview: (url: string) => void
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
            <p className="text-xs text-slate-400">
              ID: {project.id} • {project.taskCell.join(', ')}
            </p>
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
              <DetailItem label="작업 셀" value={project.taskCell.join(', ')} isEditing={isEditing}>
                {isEditing ? (
                  <div className="flex flex-wrap gap-3 p-2 bg-slate-50 rounded border border-slate-100">
                    {['UX셀', '영상셀', '편집셀'].map(cell => (
                      <div key={cell} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`edit-cell-${cell}`}
                          checked={editData.taskCell.includes(cell)}
                          onCheckedChange={(checked) => {
                            const current = editData.taskCell;
                            if (checked) {
                              setEditData({...editData, taskCell: [...current, cell]});
                            } else {
                              setEditData({...editData, taskCell: current.filter(c => c !== cell)});
                            }
                          }}
                        />
                        <Label htmlFor={`edit-cell-${cell}`} className="text-xs font-medium cursor-pointer">{cell}</Label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {project.taskCell.length >= 2 ? (
                      <CellBadge taskCell={project.taskCell} />
                    ) : (
                      project.taskCell.map(cell => <CellBadge key={cell} taskCell={[cell]} />)
                    )}
                  </div>
                )}
              </DetailItem>
              <DetailItem label="협업팀" value={project.collabTeam || '-'} isEditing={isEditing}>
                <Input value={editData.collabTeam || ''} onChange={e => setEditData({...editData, collabTeam: e.target.value})} className="h-9" />
              </DetailItem>
              <DetailItem label="협업 담당자" value={project.collabManager || '-'} isEditing={isEditing}>
                <Input value={editData.collabManager || ''} onChange={e => setEditData({...editData, collabManager: e.target.value})} className="h-9" />
              </DetailItem>
              <DetailItem label="PM" value={project.pm} isEditing={isEditing}>
                <Select value={editData.pm} onValueChange={v => setEditData({...editData, pm: v})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(m => (
                      <SelectItem key={m.id} value={m.name}>
                        {m.name} ({m.rank}/{m.cell})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  options={teamMembers.map(m => `${m.name} (${m.rank}/${m.cell})`)}
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
                    <div 
                      onClick={() => onPreview(url)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon size={24} />
                        <span className="text-[10px] font-bold">시안 크게 보기</span>
                      </div>
                    </div>
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

function TeamMemberListView({ 
  members, 
  onAddClick,
  onEditClick,
  onResetSeed 
}: { 
  members: TeamMember[], 
  onAddClick: () => void,
  onEditClick: (member: TeamMember) => void,
  onResetSeed: () => void
}) {
  const [search, setSearch] = useState('');
  
  const filtered = members.filter(m => 
    m.name.includes(search) || 
    m.cell.includes(search) || 
    m.rank.includes(search) ||
    m.role.includes(search)
  );

  return (
    <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto bg-slate-50/30">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">인원 데이터베이스</h2>
          <p className="text-slate-500 text-sm mt-1">팀원들의 정보와 소속을 관리하고 분석합니다.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="이름, 셀, 직급 검색..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-10 w-64 bg-white border-slate-200"
            />
          </div>
          {members.length < 5 && (
            <Button variant="outline" onClick={onResetSeed} className="gap-2 font-bold border-slate-200">
              <RotateCcw size={16} /> 데이터 복구
            </Button>
          )}
          <Button 
            onClick={onAddClick}
            className="bg-sleek-primary hover:bg-blue-600 gap-2 font-bold shadow-lg shadow-blue-100"
          >
            <Plus size={18} /> 인원 추가
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">이름</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">직급</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">역할</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">소속 셀</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">연락처</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">이메일</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(member => (
                <tr key={member.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                        {member.name[0]}
                      </div>
                      <span className="font-bold text-slate-800 text-sm">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{member.rank}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{member.role}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-bold border-transparent px-2 h-5",
                      member.cell === 'UX셀' ? "bg-pink-50 text-pink-600" :
                      member.cell === '영상셀' ? "bg-purple-50 text-purple-600" :
                      member.cell === '편집셀' ? "bg-cyan-50 text-cyan-600" : "bg-indigo-50 text-indigo-600"
                    )}>
                      {member.cell}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">{member.contact}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-[200px]">{member.email}</td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      onClick={() => onEditClick(member)}
                    >
                      <Edit3 size={14} /> 
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function DetailList({ label, items, isEditing, onAdd, onRemove, isDanger = false, isLink = false, layout = 'list', inputWidth, options }: { 
  label: string, 
  items: string[], 
  isEditing: boolean, 
  onAdd: (v: string) => void,
  onRemove: (i: number) => void,
  isDanger?: boolean,
  isLink?: boolean,
  layout?: 'list' | 'grid',
  inputWidth?: string,
  options?: string[]
}) {
  const [input, setInput] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-slate-500">{label}</Label>
        {isEditing && (
          <div className="flex gap-2">
            {options ? (
              <Select value={input} onValueChange={(v) => { onAdd(v); setInput(''); }}>
                <SelectTrigger className="h-8 text-xs" style={{ width: inputWidth || '160px' }}>
                  <SelectValue placeholder="선택 추가..." />
                </SelectTrigger>
                <SelectContent>
                  {options.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
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
            )}
            {!options && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { onAdd(input); setInput(''); }}>
                <PlusCircle size={16} className="text-sleek-primary" />
              </Button>
            )}
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

function StatCard({ title, value, color }: { title: string, value: number, color: string }) {
  return (
    <div 
      className="bg-white p-5 rounded-xl shadow-sm border-l-4 transition-all"
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

function getDDay(startDateStr: string) {
  try {
    const today = startOfDay(new Date());
    const start = startOfDay(parseISO(startDateStr));
    const diff = differenceInDays(start, today);
    
    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  } catch (e) {
    return 'D-?';
  }
}

function PreviewWindow({ url, onClose, sessionId }: { url: string, onClose: () => void, sessionId: string }) {
  const isVideo = url.match(/\.(mp4|webm|ogg)$/i) || url.includes('youtube') || url.includes('vimeo');

  const openExternal = () => {
    // Open the current location with a special query param and pass SID
    const previewUrl = window.location.origin + `?view=preview&sid=${sessionId}`;
    window.open(previewUrl, 'DraftPreview', 'width=1200,height=800');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20, x: 0 }}
      animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      drag
      dragMomentum={false}
      className="fixed bottom-8 right-8 w-[400px] h-[550px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-200 z-[100] flex flex-col overflow-hidden"
    >
      <div className="h-12 bg-slate-900 flex items-center justify-between px-4 cursor-move shrink-0">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-blue-400" />
          <span className="text-sm font-bold text-white tracking-tight">시안 미리보기 (연동됨)</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={openExternal}
            className="p-1.5 text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            title="새 창으로 열기 (듀얼 모니터용)"
          >
            <Maximize2 size={16} />
          </button>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-hidden">
        {isVideo ? (
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <Video size={48} />
            <Button variant="outline" className="text-xs bg-white" onClick={() => window.open(url, '_blank')}>
              외부 창에서 보기
            </Button>
          </div>
        ) : (
          <img 
            src={url} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-md"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
      <div className="p-4 bg-white border-t border-slate-100 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">원본 소스</span>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[11px] font-bold text-sleek-primary hover:underline flex items-center gap-1"
          >
            원본 사이트 이동 <ExternalLink size={12} />
          </a>
        </div>
        <p className="text-[10px] text-slate-400 break-all bg-slate-50 p-2 rounded-lg border border-slate-100 max-h-16 overflow-y-auto">
          {url}
        </p>
      </div>
    </motion.div>
  );
}

function MiniSection({ 
  title, 
  count, 
  items, 
  variant = 'default', 
  groupByCell = false, 
  hideHeader = false,
  onClickItem 
}: { 
  title: string, 
  count?: number, 
  items: Project[], 
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'info',
  groupByCell?: boolean,
  hideHeader?: boolean,
  onClickItem: (id: string) => void 
}) {
  const variantStyles = {
    default: "bg-white border-transparent",
    primary: "bg-white border-blue-200 ring-2 ring-blue-100 shadow-blue-50",
    warning: "bg-white border-transparent",
    danger: "bg-white border-transparent",
    info: "bg-white border-green-200 ring-2 ring-green-50",
  };

  const titleStyles = {
    default: "text-slate-900",
    primary: "text-blue-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
    info: "text-green-700",
  };

  const dotColors = {
    default: "bg-slate-400",
    primary: "bg-blue-600",
    warning: "bg-amber-500",
    danger: "bg-red-600",
    info: "bg-green-600",
  };

  const badgeStyles = {
    default: "bg-slate-800 text-white",
    primary: "bg-blue-600 text-white",
    warning: "bg-amber-500 text-white",
    danger: "bg-rose-500 text-white",
    info: "bg-green-600 text-white",
  };

  const groupedItems = useMemo<[string, Project[]][]>(() => {
    const groups: Record<string, Project[]> = {};
    
    items.forEach(item => {
      // Logic: If taskCell has 2 or more items, group under '공통'. Otherwise group under the specific cell.
      const cellLabel = item.taskCell.length >= 2 ? '공통' : (item.taskCell[0] || '기타');
      
      if (!groups[cellLabel]) groups[cellLabel] = [];
      groups[cellLabel].push(item);
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
      "flex flex-col transition-all overflow-hidden",
      !hideHeader ? "bg-white rounded-xl border border-slate-200 shadow-sm min-h-[250px]" : "bg-transparent border-none shadow-none"
    )}>
      {!hideHeader && (
        <div className={cn(
          "p-4 border-b flex items-center gap-2 shrink-0",
          variant === 'danger' ? "bg-red-50 border-red-100" : "bg-slate-50/50 border-slate-100"
        )}>
          <div className={cn("w-1.5 h-1.5 rounded-full", dotColors[variant])} />
          <h4 className={cn(
            "text-sm font-bold tracking-tight",
            variant === 'danger' ? "text-red-700" : "text-slate-500"
          )}>
            {title} {count !== undefined && `(${count})`}
          </h4>
        </div>
      )}
      <div className={cn("flex-1", !hideHeader ? "p-6 overflow-y-auto" : "p-0")}>
        <div className="space-y-3">
          {groupedItems.map(([cell, cellItems]) => (
            <div key={cell} className="flex gap-1">
              {groupByCell && (
                <div className="flex flex-col items-end shrink-0 pt-3 relative min-w-[32px]">
                  <div className="flex items-center gap-1 mb-1 absolute right-[1px] top-3">
                    <span className={cn(
                      "text-[10px] font-bold text-slate-900 uppercase tracking-widest leading-none",
                      cell === '공통' ? "text-indigo-600" :
                      cell === '영상셀' ? "text-purple-600" :
                      cell === 'UX셀' ? "text-pink-600" :
                      cell === '편집셀' ? "text-cyan-600" : "text-slate-500"
                    )}>
                      {cell.replace('셀', '')}
                    </span>
                    <div className={cn(
                      "w-1 h-1 rounded-full",
                      cell === '공통' ? "bg-indigo-600" :
                      cell === '영상셀' ? "bg-purple-600" :
                      cell === 'UX셀' ? "bg-pink-600" :
                      cell === '편집셀' ? "bg-cyan-600" : "bg-slate-500"
                    )} />
                  </div>
                  <div className={cn(
                    "w-px flex-1 mt-3.5 mr-[1.5px] opacity-40",
                    cell === '공통' ? "bg-indigo-300" :
                    cell === '영상셀' ? "bg-purple-300" :
                    cell === 'UX셀' ? "bg-pink-300" :
                    cell === '편집셀' ? "bg-cyan-300" : "bg-slate-300"
                  )}></div>
                </div>
              )}
              <div className="flex-1 space-y-1">
                {cellItems.map((item, itemIndex) => {
                  const isIssue = variant === 'danger';
                  const isUpcoming = variant === 'warning';
                  const isRegular = variant === 'default';
                  const isOngoingOrCompleted = variant === 'primary' || variant === 'info';

                  return (
                    <div 
                      key={item.id} 
                      onClick={() => onClickItem(item.id)}
                      className={cn(
                        "flex flex-col gap-1 text-sm border-b border-transparent cursor-pointer hover:bg-slate-50/80 rounded-xl px-4 transition-all group",
                        isOngoingOrCompleted ? "py-4" : "py-1",
                        itemIndex !== cellItems.length - 1 && "border-slate-50"
                      )}
                    >
                      {/* Row 1: Project Name & Progress */}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {item.status === 'ongoing' && !isIssue && (
                            <div className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded shrink-0">
                              진행중
                            </div>
                          )}
                          {item.status === 'completed' && !isIssue && (
                            <div className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded shrink-0">
                              완료
                            </div>
                          )}
                          <span className={cn(
                            "truncate font-bold text-slate-800",
                            isOngoingOrCompleted ? "text-base" : "text-sm"
                          )}>
                            {isIssue && item.issues.length > 0 ? item.issues[0] : item.name}
                          </span>
                          {item.issues.length > 0 && !isIssue && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] font-bold text-red-500">이슈</span>
                              <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center text-[10px] text-red-500 font-bold">
                                {item.issues.length}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {variant !== 'danger' && variant !== 'warning' && (
                            <span className="text-[11px] font-medium text-sleek-primary/60">진행율</span>
                          )}
                          {!isIssue && (
                            <span className={cn(
                              "font-bold text-base",
                              item.status === 'completed' ? "text-green-600" : "text-sleek-primary"
                            )}>
                              {item.status === 'upcoming' ? getDDay(item.startDate) : `${item.progress}%`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Metadata (Limited for specific views) */}
                      {!isUpcoming && !isRegular && (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-4 flex-wrap mt-0.5">
                            {!isIssue && (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-400">작업셀</span>
                                <span className="text-[12px] text-slate-700 font-bold">
                                  {item.taskCell.join(', ') || '기타'}
                                </span>
                              </div>
                            )}
                            
                            {!isIssue && (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-400">PM</span>
                                <span className="text-[12px] text-slate-700 font-bold">{item.pm}</span>
                              </div>
                            )}

                            {!isIssue && (
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-400">담당자</span>
                                <span className="text-[12px] text-slate-500 font-bold truncate max-w-[250px]">
                                  {item.assignees.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>

                          {!isIssue && item.deadline && (
                            <div className="text-[11px] font-bold text-slate-500 shrink-0">
                              마감일 - {item.deadline}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {isIssue && (
                        <span className="text-[10px] text-slate-400 font-medium truncate block">
                          프로젝트: {item.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
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

function getCellColor(taskCell: string[]) {
  if (taskCell.length >= 2) return 'var(--color-cell-common)';
  const cell = taskCell[0];
  if (cell === 'UX셀') return 'var(--color-cell-ux)';
  if (cell === '영상셀') return 'var(--color-cell-video)';
  if (cell === '편집셀') return 'var(--color-cell-edit)';
  return 'var(--color-sleek-primary)';
}

function CellBadge({ taskCell, label: manualLabel }: { taskCell: string[], label?: string }) {
  const isCommon = taskCell.length >= 2;
  const label = manualLabel || (isCommon ? '공통' : (taskCell[0] || '기타'));
  
  const styles: Record<string, string> = {
    '공통': "bg-indigo-50 text-indigo-600 border-indigo-200",
    'UX셀': "bg-pink-50 text-pink-600 border-pink-200",
    '영상셀': "bg-purple-50 text-purple-600 border-purple-200",
    '편집셀': "bg-cyan-50 text-cyan-600 border-cyan-200",
    '기타': "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <Badge variant="outline" className={cn("text-[10px] font-bold h-6 px-2", styles[label] || styles['기타'])}>
      {manualLabel || taskCell.join(', ')}
    </Badge>
  );
}

function StatusTag({ status }: { status: ProjectStatus }) {
  const styles = {
    ongoing: "bg-blue-100 text-blue-700",
    upcoming: "bg-yellow-100 text-yellow-700",
    regular: "bg-slate-200 text-slate-800",
    issue: "bg-rose-50 text-rose-600",
    completed: "bg-green-100 text-green-700",
  };
  
  const label = getStatusLabel(status);

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", styles[status])}>
      {label}
    </span>
  );
}

function DynamicListInput({ label, items, onAdd, onRemove, placeholder = "추가...", options }: { 
  label: string, 
  items: string[], 
  onAdd: (val: string) => void, 
  onRemove: (i: number) => void,
  placeholder?: string,
  options?: string[]
}) {
  const [input, setInput] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</Label>
        <div className="flex gap-2">
          {options ? (
            <Select value={input} onValueChange={(v) => { onAdd(v); setInput(''); }}>
              <SelectTrigger className="h-9 text-xs w-40 border-slate-200">
                <SelectValue placeholder="참가자 선택..." />
              </SelectTrigger>
              <SelectContent>
                {options.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
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
          )}
          {!options && (
            <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:bg-emerald-50" onClick={() => { onAdd(input); setInput(''); }}>
              <PlusCircle size={18} className="text-sleek-primary" />
            </Button>
          )}
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
