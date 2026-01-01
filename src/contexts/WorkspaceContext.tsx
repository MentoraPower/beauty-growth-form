import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnimatePresence } from 'framer-motion';
import { WorkspaceLoadingOverlay } from '@/components/workspace/WorkspaceLoadingOverlay';

interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  isSwitching: boolean;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  refetchWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const WORKSPACE_STORAGE_KEY = 'current_workspace_id';

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setIsLoading(false);
        return;
      }

      // Get workspaces where user is a member
      const { data: memberData } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);

      if (!memberData || memberData.length === 0) {
        // User has no workspaces, add them to default workspace
        const defaultWorkspaceId = '00000000-0000-0000-0000-000000000001';
        
        // Check if default workspace exists
        const { data: defaultWs } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', defaultWorkspaceId)
          .maybeSingle();

        if (defaultWs) {
          // Add user as member
          await supabase.from('workspace_members').insert({
            workspace_id: defaultWorkspaceId,
            user_id: user.id,
            role: 'member'
          });
          
          setWorkspaces([defaultWs]);
          setCurrentWorkspace(defaultWs);
          localStorage.setItem(WORKSPACE_STORAGE_KEY, defaultWs.id);
        }
        setIsLoading(false);
        return;
      }

      const workspaceIds = memberData.map(m => m.workspace_id);
      
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds)
        .order('created_at', { ascending: true });

      if (wsData) {
        setWorkspaces(wsData);
        
        // Restore last selected workspace or use first one
        const savedId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
        const savedWorkspace = wsData.find(w => w.id === savedId);
        const selected = savedWorkspace || wsData[0];
        
        if (selected) {
          setCurrentWorkspace(selected);
          localStorage.setItem(WORKSPACE_STORAGE_KEY, selected.id);
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchWorkspaces();
    });

    return () => subscription.unsubscribe();
  }, [fetchWorkspaces]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace && workspace.id !== currentWorkspace?.id) {
      setIsSwitching(true);
      setCurrentWorkspace(workspace);
      localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
      // Small delay to show the loading overlay before reload
      setTimeout(() => {
        window.location.href = '/crm';
      }, 300);
    }
  }, [workspaces, currentWorkspace]);

  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Create workspace
      const { data: newWorkspace, error: wsError } = await supabase
        .from('workspaces')
        .insert({ name, created_by: user.id })
        .select()
        .single();

      if (wsError || !newWorkspace) {
        console.error('Error creating workspace:', wsError);
        return null;
      }

      // Add creator as owner
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: newWorkspace.id,
          user_id: user.id,
          role: 'owner'
        });

      if (memberError) {
        console.error('Error adding member:', memberError);
        // Rollback workspace creation
        await supabase.from('workspaces').delete().eq('id', newWorkspace.id);
        return null;
      }

      // Add to list and select immediately
      setWorkspaces(prev => [...prev, newWorkspace]);
      setCurrentWorkspace(newWorkspace);
      localStorage.setItem(WORKSPACE_STORAGE_KEY, newWorkspace.id);
      
      // Show loading and reload
      setIsSwitching(true);
      setTimeout(() => {
        window.location.href = '/crm';
      }, 300);
      
      return newWorkspace;
    } catch (error) {
      console.error('Error creating workspace:', error);
      return null;
    }
  }, []);

  const refetchWorkspaces = useCallback(async () => {
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      currentWorkspace,
      isLoading,
      isSwitching,
      switchWorkspace,
      createWorkspace,
      refetchWorkspaces
    }}>
      <AnimatePresence>
        {isSwitching && <WorkspaceLoadingOverlay />}
      </AnimatePresence>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
