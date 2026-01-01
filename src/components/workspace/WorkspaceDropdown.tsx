import { useState } from 'react';
import { ChevronDown, Plus, Check, Building2 } from 'lucide-react';
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-[45px] flex items-center gap-2 px-4 hover:bg-muted/50 transition-colors outline-none">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{currentWorkspace?.name || 'Selecionar workspace'}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => switchWorkspace(workspace.id)}
              className="flex items-center justify-between"
            >
              <span>{workspace.name}</span>
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
