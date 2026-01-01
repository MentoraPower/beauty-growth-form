import { useState } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function WorkspaceDropdown() {
  const { workspaces, currentWorkspace, switchWorkspace, createWorkspace, isLoading } = useWorkspace();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    
    setIsCreating(true);
    await createWorkspace(newWorkspaceName.trim());
    setIsCreating(false);
    setIsCreateDialogOpen(false);
    setNewWorkspaceName('');
  };

  if (isLoading) {
    return (
      <div className="h-[45px] flex items-center px-4">
        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <button className="h-8 flex items-center gap-2 px-2 ml-3 rounded-lg hover:bg-muted/30 transition-colors outline-none">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-sidebar">
              <div className="h-5 w-5 rounded-[4px] bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center">
                <span className="text-[9px] font-semibold text-white">
                  {currentWorkspace ? getInitials(currentWorkspace.name) : 'WS'}
                </span>
              </div>
              <span className="text-sm font-medium">{currentWorkspace?.name || 'Selecionar workspace'}</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <div className="px-2 py-1.5 mb-1">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-sidebar-accent">
              <div className="h-5 w-5 rounded-[4px] bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-semibold text-white">
                  {currentWorkspace ? getInitials(currentWorkspace.name) : 'WS'}
                </span>
              </div>
              <span className="text-sm font-medium">{currentWorkspace?.name || 'Workspace'}</span>
            </div>
          </div>
          <DropdownMenuSeparator />
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => switchWorkspace(workspace.id)}
              className="flex items-center gap-2"
            >
              <div className="h-5 w-5 rounded-[4px] bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-semibold text-white">
                  {getInitials(workspace.name)}
                </span>
              </div>
              <span className="flex-1">{workspace.name}</span>
              {currentWorkspace?.id === workspace.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar espaço de trabalho
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar novo espaço de trabalho</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome do espaço de trabalho"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateWorkspace} 
              disabled={!newWorkspaceName.trim() || isCreating}
            >
              {isCreating ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
