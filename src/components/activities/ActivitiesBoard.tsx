import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useLeadActivities, LeadActivity } from "@/hooks/use-lead-activities";
import { StepNavigation } from "./StepNavigation";
import { ActivityList } from "./ActivityList";
import { AddActivityDialog } from "./AddActivityDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivitiesBoardProps {
  leadId: string;
  currentPipelineId: string | null;
}

export function ActivitiesBoard({ leadId, currentPipelineId }: ActivitiesBoardProps) {
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LeadActivity | null>(null);

  const {
    pipelines,
    viewingPipelineId,
    activities,
    selectedActivity,
    isLoadingActivities,
    currentPipelineName,
    handlePipelineClick,
    handleActivityClick,
    handleAddActivity,
    handleDeleteActivity,
    handleToggleConcluida,
  } = useLeadActivities({ leadId, currentPipelineId });

  const handleEditActivity = useCallback((activity: LeadActivity) => {
    setEditingActivity(activity);
    setIsAddActivityOpen(true);
  }, []);

  const handleOpenAddDialog = useCallback(() => {
    setEditingActivity(null);
    setIsAddActivityOpen(true);
  }, []);

  const handleCloseAddDialog = useCallback((open: boolean) => {
    setIsAddActivityOpen(open);
    if (!open) {
      setEditingActivity(null);
    }
  }, []);

  const handleSubmitActivity = useCallback(async (activity: { titulo: string; tipo: string; data: Date; hora: string }) => {
    await handleAddActivity(activity, editingActivity?.id);
    setEditingActivity(null);
  }, [handleAddActivity, editingActivity?.id]);

  return (
    <div className="space-y-6">
      {/* Step Navigation */}
      <Card className="border-black/5">
        <CardContent className="p-4">
          <StepNavigation
            pipelines={pipelines}
            viewingPipelineId={viewingPipelineId}
            currentPipelineId={currentPipelineId}
            onPipelineClick={handlePipelineClick}
          />
        </CardContent>
      </Card>

      {/* Activities List */}
      <Card className="border-black/5">
        <CardContent className="p-4">
          {isLoadingActivities ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ActivityList
              activities={activities}
              selectedActivityId={selectedActivity?.id}
              onActivityClick={handleActivityClick}
              onToggleConcluida={handleToggleConcluida}
              onEditActivity={handleEditActivity}
              onDeleteActivity={handleDeleteActivity}
              onAddActivity={handleOpenAddDialog}
            />
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Activity Dialog */}
      <AddActivityDialog
        open={isAddActivityOpen}
        onOpenChange={handleCloseAddDialog}
        stepName={currentPipelineName}
        onAddActivity={handleSubmitActivity}
        editingActivity={editingActivity}
      />
    </div>
  );
}
