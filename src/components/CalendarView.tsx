import React, { useState, useMemo, useEffect } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO,
  isWithinInterval
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Users, 
  Briefcase, 
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  X,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Project, TeamSchedule, ScheduleType, VacationType } from '@/types';
import { db, auth } from '@/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// Korean Holidays (2024-2025)
const HOLIDAYS: Record<string, string> = {
  '2024-01-01': '신정',
  '2024-02-09': '설날',
  '2024-02-10': '설날',
  '2024-02-11': '설날',
  '2024-02-12': '대체공휴일',
  '2024-03-01': '삼일절',
  '2024-04-10': '국회의원 선거',
  '2024-05-05': '어린이날',
  '2024-05-06': '대체공휴일',
  '2024-05-15': '부처님 오신 날',
  '2024-06-06': '현충일',
  '2024-08-15': '광복절',
  '2024-09-16': '추석',
  '2024-09-17': '추석',
  '2024-09-18': '추석',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '성탄절',
  '2025-01-01': '신정',
  '2025-01-28': '설날',
  '2025-01-29': '설날',
  '2025-01-30': '설날',
  '2025-03-01': '삼일절',
  '2025-03-03': '대체공휴일',
  '2025-05-05': '어린이날',
  '2025-05-06': '부처님 오신 날',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석',
  '2025-10-06': '추석',
  '2025-10-07': '추석',
  '2025-10-08': '대체공휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',
};

function getCellColor(taskCell: string[]) {
  if (taskCell.length >= 2) return 'var(--color-cell-common)';
  const cell = taskCell[0];
  if (cell === 'UX셀') return 'var(--color-cell-ux)';
  if (cell === '영상셀') return 'var(--color-cell-video)';
  if (cell === '편집셀') return 'var(--color-cell-edit)';
  return 'var(--color-sleek-primary)';
}

function getCellBgColor(taskCell: string[]) {
  if (taskCell.length >= 2) return 'rgba(99, 102, 241, 0.1)'; // common
  const cell = taskCell[0];
  if (cell === 'UX셀') return 'rgba(236, 72, 153, 0.1)'; // ux
  if (cell === '영상셀') return 'rgba(139, 92, 246, 0.1)'; // video
  if (cell === '편집셀') return 'rgba(6, 182, 212, 0.1)'; // edit
  return 'rgba(59, 130, 246, 0.1)';
}

function getCellTextColor(taskCell: string[]) {
  if (taskCell.length >= 2) return '#4f46e5'; // common
  const cell = taskCell[0];
  if (cell === 'UX셀') return '#db2777'; // ux
  if (cell === '영상셀') return '#7c3aed'; // video
  if (cell === '편집셀') return '#0891b2'; // edit
  return '#2563eb';
}

export default function CalendarView({ projects, onSelectProject, onDeleteProject }: { 
  projects: Project[], 
  onSelectProject: (id: string) => void,
  onDeleteProject: (id: string) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'project' | 'team'>('project');
  const [selectedCells, setSelectedCells] = useState<string[]>(['UX셀', '영상셀', '편집셀']);
  const [teamSchedules, setTeamSchedules] = useState<TeamSchedule[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [hoveredScheduleId, setHoveredScheduleId] = useState<string | null>(null);
  const [selectedCalendarProject, setSelectedCalendarProject] = useState<Project | null>(null);
  const [selectedCalendarSchedule, setSelectedCalendarSchedule] = useState<TeamSchedule | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number, y: number } | null>(null);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  const [newSchedule, setNewSchedule] = useState<Partial<TeamSchedule>>({
    type: 'vacation',
    subType: 'annual',
    title: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    participants: [],
    cell: 'UX셀'
  });

  useEffect(() => {
    const q = query(collection(db, 'teamSchedules'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamSchedule));
      setTeamSchedules(data);
    });
    return () => unsubscribe();
  }, []);

  const renderHeader = () => {
    const getFilterStyle = (cell: string, isActive: boolean) => {
      if (!isActive) return "text-slate-500 bg-transparent border-transparent";
      
      const colors: Record<string, string> = {
        'UX셀': "bg-pink-50 text-pink-600 border-pink-200",
        '영상셀': "bg-purple-50 text-purple-600 border-purple-200",
        '편집셀': "bg-cyan-50 text-cyan-600 border-cyan-200",
      };
      return colors[cell] || "bg-blue-50 text-blue-600 border-blue-200";
    };

    return (
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft size={18} />
            </Button>
            <h2 className="text-xl font-bold min-w-[150px] text-center">
              {format(currentMonth, 'yyyy년 MM월')}
            </h2>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight size={18} />
            </Button>
            <Button variant="ghost" className="ml-2 text-slate-500 font-bold h-9" onClick={() => setCurrentMonth(new Date())}>오늘</Button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('project')}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'project' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Briefcase size={16} /> 프로젝트 일정
            </button>
            <button 
              onClick={() => setViewMode('team')}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2",
                viewMode === 'team' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Users size={16} /> 팀원 일정
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <Filter size={14} className="text-slate-400" />
            <div className="flex items-center gap-1">
              {['UX셀', '영상셀', '편집셀'].map(cell => {
                const isActive = selectedCells.includes(cell);
                return (
                  <label 
                    key={cell} 
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all cursor-pointer",
                      getFilterStyle(cell, isActive)
                    )}
                  >
                    <Checkbox 
                      checked={isActive}
                      className={cn(isActive && "border-current")}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedCells([...selectedCells, cell]);
                        else setSelectedCells(selectedCells.filter(c => c !== cell));
                      }}
                    />
                    <span className="text-xs font-bold">{cell}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {viewMode === 'team' && (
            <Button className="bg-blue-600 hover:bg-blue-700 font-bold gap-2 h-9" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} /> 일정 추가
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day, i) => (
          <div key={day} className={cn(
            "text-center text-xs font-bold uppercase tracking-widest py-2",
            i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"
          )}>
            {day}
          </div>
        ))}
      </div>
    );
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // If common (2+ cells), show if any of selected cells are included
      return p.taskCell.some(cell => selectedCells.includes(cell));
    });
  }, [projects, selectedCells]);

  const filteredTeamSchedules = useMemo(() => {
    return teamSchedules.filter(s => selectedCells.includes(s.cell));
  }, [teamSchedules, selectedCells]);

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const rows = Math.ceil(calendarDays.length / 7);

    return (
      <div 
        className="flex-1 grid grid-cols-7 border-t border-l border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white"
        style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {calendarDays.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const holiday = HOLIDAYS[dateStr];
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isSunday = day.getDay() === 0;
          const isSaturday = day.getDay() === 6;

          // Find items for this day
          const dayProjects = viewMode === 'project' ? filteredProjects.filter(p => {
            const start = parseISO(p.startDate);
            const end = parseISO(p.endDate);
            return isWithinInterval(day, { start, end });
          }) : [];

          const daySchedules = viewMode === 'team' ? filteredTeamSchedules.filter(s => {
            const start = parseISO(s.startDate);
            const end = parseISO(s.endDate);
            return isWithinInterval(day, { start, end });
          }) : [];

          return (
            <div 
              key={dateStr}
              className={cn(
                "border-r border-b border-slate-200 transition-colors flex flex-col relative group/cell",
                !isCurrentMonth ? "bg-slate-50/50" : "bg-white",
                isToday && "bg-blue-50/30"
              )}
              style={{ height: '100%', minHeight: '120px' }}
            >
              <div className="flex justify-between items-start pt-1.5 px-2 mb-1">
                <span className={cn(
                  "text-xs font-bold transition-colors",
                  isToday ? "w-6 h-6 bg-blue-600 text-white flex items-center justify-center rounded-full" : 
                  holiday || isSunday ? "text-red-500" : 
                  isSaturday ? "text-blue-500" : 
                  "text-slate-500",
                  !isCurrentMonth && "opacity-20"
                )}>
                  {format(day, 'd')}
                </span>
                {holiday && (
                  <span className="text-[9px] font-bold text-red-400 leading-none mt-1">{holiday}</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-[1px]">
                  {viewMode === 'project' ? (
                    dayProjects.map(p => {
                      const isHovered = hoveredProjectId === p.id;
                      return (
                        <div 
                          key={p.id}
                          onMouseEnter={() => setHoveredProjectId(p.id)}
                          onMouseLeave={() => setHoveredProjectId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCalendarProject(p);
                            setPopupPosition({ x: e.clientX, y: e.clientY });
                          }}
                          className={cn(
                            "text-[10px] px-2 py-1.5 font-bold truncate border-l-[3px] cursor-pointer transition-all w-full",
                            isHovered ? "brightness-75 z-10" : "opacity-100"
                          )}
                          style={{ 
                            backgroundColor: getCellBgColor(p.taskCell),
                            color: getCellTextColor(p.taskCell),
                            borderLeftColor: getCellColor(p.taskCell)
                          }}
                        >
                          {p.name}
                        </div>
                      );
                    })
                  ) : (
                    daySchedules.map(s => {
                      const isHovered = hoveredScheduleId === s.id;
                      return (
                        <div 
                          key={s.id}
                          onMouseEnter={() => setHoveredScheduleId(s.id)}
                          onMouseLeave={() => setHoveredScheduleId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCalendarSchedule(s);
                            setPopupPosition({ x: e.clientX, y: e.clientY });
                          }}
                          className={cn(
                            "text-[10px] px-2 py-1.5 font-bold truncate border-l-[3px] w-full cursor-pointer transition-all",
                            isHovered ? "brightness-75 z-10" : "opacity-100",
                            s.type === 'vacation' ? "bg-rose-50 text-rose-700 border-rose-500" :
                            s.type === 'meeting' ? "bg-indigo-50 text-indigo-700 border-indigo-500" :
                            s.type === 'seminar' ? "bg-emerald-50 text-emerald-700 border-emerald-500" :
                            "bg-amber-50 text-amber-700 border-amber-500"
                          )}
                        >
                          {s.type === 'vacation' ? `[${s.subType === 'annual' ? '연차' : s.subType === 'half' ? '반차' : '시차'}]` : `[${s.type === 'meeting' ? '회의' : s.type === 'seminar' ? '세미나' : '면접'}]`} {s.title}
                          {s.time && <span className="ml-1 opacity-70">({s.time})</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleSaveSchedule = async () => {
    if (!newSchedule.title) return;
    try {
      if (isEditingSchedule && newSchedule.id) {
        const { id, ...data } = newSchedule;
        await updateDoc(doc(db, 'teamSchedules', id), data);
      } else {
        await addDoc(collection(db, 'teamSchedules'), {
          ...newSchedule,
          uid: auth.currentUser?.uid || 'public',
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setIsEditingSchedule(false);
      setNewSchedule({
        type: 'vacation',
        subType: 'annual',
        title: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        participants: [],
        cell: 'UX셀'
      });
    } catch (error) {
      console.error("Error saving schedule:", error);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'teamSchedules', id));
      setSelectedCalendarSchedule(null);
    } catch (error) {
      console.error("Error deleting schedule:", error);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 bg-slate-50/50 h-full overflow-hidden relative" onClick={() => {
      setSelectedCalendarProject(null);
      setSelectedCalendarSchedule(null);
    }}>
      {renderHeader()}
      <div className="flex-1 flex flex-col min-h-0">
        {renderDays()}
        {renderCells()}
      </div>

      {/* Project Detail Popup */}
      {selectedCalendarProject && popupPosition && (
        <div 
          className="fixed z-[100] w-64 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 animate-in fade-in zoom-in duration-200"
          style={{ 
            left: Math.min(popupPosition.x, window.innerWidth - 280), 
            top: Math.min(popupPosition.y, window.innerHeight - 200) 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-800 truncate pr-4">{selectedCalendarProject.name}</h4>
            <button 
              onClick={() => setSelectedCalendarProject(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400 font-bold w-12">일시</span>
              <span className="text-slate-600 font-medium">
                {selectedCalendarProject.startDate} ~ {selectedCalendarProject.endDate}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400 font-bold w-12">작업셀</span>
              <div className="flex gap-1">
                {selectedCalendarProject.taskCell.map(cell => {
                  const colors: Record<string, string> = {
                    'UX셀': "bg-pink-50 text-pink-600",
                    '영상셀': "bg-purple-50 text-purple-600",
                    '편집셀': "bg-cyan-50 text-cyan-600",
                  };
                  return (
                    <span key={cell} className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", colors[cell] || "bg-slate-50 text-slate-600")}>
                      {cell}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="w-full text-xs font-bold bg-slate-800 hover:bg-slate-900"
              onClick={() => {
                onSelectProject(selectedCalendarProject.id);
                setSelectedCalendarProject(null);
              }}
            >
              프로젝트 상세
            </Button>
          </div>
        </div>
      )}

      {/* Team Schedule Detail Popup */}
      {selectedCalendarSchedule && popupPosition && (
        <div 
          className="fixed z-[100] w-64 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 animate-in fade-in zoom-in duration-200"
          style={{ 
            left: Math.min(popupPosition.x, window.innerWidth - 280), 
            top: Math.min(popupPosition.y, window.innerHeight - 200) 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-slate-800 truncate pr-4">{selectedCalendarSchedule.title}</h4>
            <button 
              onClick={() => setSelectedCalendarSchedule(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400 font-bold w-12">일시</span>
              <span className="text-slate-600 font-medium">
                {selectedCalendarSchedule.startDate === selectedCalendarSchedule.endDate 
                  ? selectedCalendarSchedule.startDate 
                  : `${selectedCalendarSchedule.startDate} ~ ${selectedCalendarSchedule.endDate}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400 font-bold w-12">종류</span>
              <Badge variant="secondary" className="text-[10px] font-bold bg-slate-100 text-slate-600 border-none">
                {selectedCalendarSchedule.type === 'vacation' 
                  ? (selectedCalendarSchedule.subType === 'annual' ? '연차' : selectedCalendarSchedule.subType === 'half' ? '반차' : '시차')
                  : (selectedCalendarSchedule.type === 'meeting' ? '회의' : selectedCalendarSchedule.type === 'seminar' ? '세미나' : '면접')}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-100"
              onClick={() => handleDeleteSchedule(selectedCalendarSchedule.id)}
            >
              삭제
            </Button>
            <Button 
              size="sm" 
              className="flex-1 text-xs font-bold bg-slate-800 hover:bg-slate-900"
              onClick={() => {
                setNewSchedule(selectedCalendarSchedule);
                setIsEditingSchedule(true);
                setIsModalOpen(true);
                setSelectedCalendarSchedule(null);
              }}
            >
              수정
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) {
          setIsEditingSchedule(false);
          setNewSchedule({
            type: 'vacation',
            subType: 'annual',
            title: '',
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(new Date(), 'yyyy-MM-dd'),
            participants: [],
            cell: 'UX셀'
          });
        }
      }}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 bg-slate-900 text-white">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <CalendarIcon className="text-blue-400" /> {isEditingSchedule ? '팀원 일정 수정' : '팀원 일정 추가'}
            </DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">일정 구분</Label>
                <Select 
                  value={newSchedule.type} 
                  onValueChange={(v: ScheduleType) => setNewSchedule({...newSchedule, type: v})}
                >
                  <SelectTrigger className="h-11 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation" className="font-bold">연차/휴가</SelectItem>
                    <SelectItem value="meeting" className="font-bold">회의</SelectItem>
                    <SelectItem value="seminar" className="font-bold">세미나</SelectItem>
                    <SelectItem value="interview" className="font-bold">면접</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">소속 셀</Label>
                <Select 
                  value={newSchedule.cell} 
                  onValueChange={(v) => setNewSchedule({...newSchedule, cell: v})}
                >
                  <SelectTrigger className="h-11 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UX셀" className="font-bold">UX셀</SelectItem>
                    <SelectItem value="영상셀" className="font-bold">영상셀</SelectItem>
                    <SelectItem value="편집셀" className="font-bold">편집셀</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newSchedule.type === 'vacation' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">휴가 종류</Label>
                <Select 
                  value={newSchedule.subType} 
                  onValueChange={(v: VacationType) => setNewSchedule({...newSchedule, subType: v})}
                >
                  <SelectTrigger className="h-11 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual" className="font-bold">연차</SelectItem>
                    <SelectItem value="half" className="font-bold">반차</SelectItem>
                    <SelectItem value="time" className="font-bold">시차</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">일정 제목 / 이름</Label>
              <Input 
                className="h-11 font-bold" 
                placeholder="예: 홍길동 연차, 주간 회의 등"
                value={newSchedule.title}
                onChange={(e) => setNewSchedule({...newSchedule, title: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">시작일</Label>
                <Input 
                  type="date" 
                  className="h-11 font-bold"
                  value={newSchedule.startDate}
                  onChange={(e) => {
                    const date = e.target.value;
                    setNewSchedule({
                      ...newSchedule, 
                      startDate: date,
                      endDate: newSchedule.type !== 'vacation' ? date : newSchedule.endDate
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">종료일</Label>
                <Input 
                  type="date" 
                  className="h-11 font-bold"
                  disabled={newSchedule.type !== 'vacation'}
                  value={newSchedule.endDate}
                  onChange={(e) => setNewSchedule({...newSchedule, endDate: e.target.value})}
                />
              </div>
            </div>

            {newSchedule.subType === 'time' && newSchedule.type === 'vacation' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">시차 시간</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    className="h-11 pl-10 font-bold" 
                    placeholder="예: 14:00 - 16:00"
                    value={newSchedule.time}
                    onChange={(e) => setNewSchedule({...newSchedule, time: e.target.value})}
                  />
                </div>
              </div>
            )}

            {(newSchedule.type === 'meeting' || newSchedule.type === 'seminar' || newSchedule.type === 'interview') && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">참석 인원</Label>
                <Input 
                  className="h-11 font-bold" 
                  placeholder="참석자 이름을 쉼표로 구분하여 입력"
                  value={newSchedule.participants?.join(', ')}
                  onChange={(e) => setNewSchedule({...newSchedule, participants: e.target.value.split(',').map(s => s.trim())})}
                />
              </div>
            )}
          </div>

          <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="h-11 px-8 font-bold text-slate-500">취소</Button>
            <Button className="h-11 px-10 bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-200" onClick={handleSaveSchedule}>
              {isEditingSchedule ? '일정 수정하기' : '일정 등록하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
