import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Eye, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { TimeEntry } from '@/hooks/useTimeEntries';

interface TimeEntryDialogProps {
  entry: TimeEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onSave: (data: { clock_in: string; clock_out: string | null; notes: string | null }) => Promise<void>;
  timezone?: string;
}

export function TimeEntryDialog({ entry, open, onOpenChange, canEdit, onSave, timezone }: TimeEntryDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    clockInDate: '',
    clockInTime: '',
    clockOutDate: '',
    clockOutTime: '',
    notes: '',
  });

  useEffect(() => {
    if (entry) {
      const clockIn = new Date(entry.clock_in);
      const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;
      
      setFormData({
        clockInDate: format(clockIn, 'yyyy-MM-dd'),
        clockInTime: format(clockIn, 'HH:mm'),
        clockOutDate: clockOut ? format(clockOut, 'yyyy-MM-dd') : '',
        clockOutTime: clockOut ? format(clockOut, 'HH:mm') : '',
        notes: entry.notes || '',
      });
      setIsEditing(false);
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry) return;
    
    setIsSaving(true);
    try {
      const clockIn = new Date(`${formData.clockInDate}T${formData.clockInTime}`);
      const clockOut = formData.clockOutDate && formData.clockOutTime 
        ? new Date(`${formData.clockOutDate}T${formData.clockOutTime}`)
        : null;
      
      await onSave({
        clock_in: clockIn.toISOString(),
        clock_out: clockOut ? clockOut.toISOString() : null,
        notes: formData.notes || null,
      });
      setIsEditing(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!entry) return null;

  const userName = entry.user?.full_name || 'Unknown User';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Pencil className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            {isEditing ? 'Edit Time Entry' : 'View Time Entry'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-muted-foreground">Technician</Label>
            <p className="font-medium">{userName}</p>
          </div>

          {timezone && (
            <div className="space-y-1">
              <Label className="text-muted-foreground">Timezone</Label>
              <p className="font-medium text-sm">{timezone}</p>
            </div>
          )}

          {isEditing ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Clock In Date</Label>
                  <Input
                    type="date"
                    value={formData.clockInDate}
                    onChange={(e) => setFormData({ ...formData, clockInDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clock In Time</Label>
                  <Input
                    type="time"
                    value={formData.clockInTime}
                    onChange={(e) => setFormData({ ...formData, clockInTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Clock Out Date</Label>
                  <Input
                    type="date"
                    value={formData.clockOutDate}
                    onChange={(e) => setFormData({ ...formData, clockOutDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Clock Out Time</Label>
                  <Input
                    type="time"
                    value={formData.clockOutTime}
                    onChange={(e) => setFormData({ ...formData, clockOutTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes..."
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Clock In</Label>
                  <p className="font-medium">
                    {format(new Date(entry.clock_in), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Clock Out</Label>
                  <p className="font-medium">
                    {entry.clock_out 
                      ? format(new Date(entry.clock_out), 'MMM d, yyyy h:mm a')
                      : 'Still active'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Notes</Label>
                {entry.notes ? (
                  <p className="text-sm bg-muted p-3 rounded-lg">{entry.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No notes</p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            {canEdit && !isEditing && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            {isEditing && (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}