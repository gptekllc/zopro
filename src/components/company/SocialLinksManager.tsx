import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Loader2, Save, GripVertical, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDefaultPlatformIcon, getAvailablePlatforms, PLATFORM_ICONS } from '@/lib/platformIcons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SocialLink {
  id?: string;
  platform_name: string;
  url: string;
  icon_url: string | null;
  show_on_invoice: boolean;
  show_on_quote: boolean;
  show_on_job: boolean;
  show_on_email: boolean;
  display_order: number;
}

interface SocialLinksManagerProps {
  companyId: string;
}

const MAX_LINKS = 7;

// Sortable Card Component
const SortableLinkCard = ({
  link,
  index,
  onUpdate,
  onRemove,
  onOpenIconPicker,
  getDisplayIcon,
}: {
  link: SocialLink;
  index: number;
  onUpdate: (index: number, updates: Partial<SocialLink>) => void;
  onRemove: (index: number) => void;
  onOpenIconPicker: (index: number) => void;
  getDisplayIcon: (link: SocialLink) => string | null;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id || `new-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 flex items-center cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </div>

          {/* Icon Display */}
          <div className="flex-shrink-0">
            <Label className="text-xs text-muted-foreground mb-1 block">Icon</Label>
            <button
              type="button"
              onClick={() => onOpenIconPicker(index)}
              className="w-12 h-12 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors"
              title="Pick platform icon"
            >
              {getDisplayIcon(link) ? (
                <img src={getDisplayIcon(link)!} alt={link.platform_name} className="w-8 h-8 object-contain" />
              ) : (
                <Image className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {/* Platform Name & URL */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Platform Name</Label>
              <Input
                list={`platforms-${index}`}
                placeholder="e.g. Facebook, X, TikTok"
                value={link.platform_name}
                onChange={(e) => onUpdate(index, { platform_name: e.target.value })}
              />
              <datalist id={`platforms-${index}`}>
                {getAvailablePlatforms().map((platform) => (
                  <option key={platform} value={platform} />
                ))}
              </datalist>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">URL</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={link.url}
                onChange={(e) => onUpdate(index, { url: e.target.value })}
              />
            </div>
          </div>

          {/* Delete Button */}
          <div className="flex-shrink-0 flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Visibility Toggles */}
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={link.show_on_invoice}
              onCheckedChange={(checked) => onUpdate(index, { show_on_invoice: checked })}
            />
            <Label className="text-sm cursor-pointer">Invoice</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={link.show_on_quote}
              onCheckedChange={(checked) => onUpdate(index, { show_on_quote: checked })}
            />
            <Label className="text-sm cursor-pointer">Quote</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={link.show_on_job}
              onCheckedChange={(checked) => onUpdate(index, { show_on_job: checked })}
            />
            <Label className="text-sm cursor-pointer">Job</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={link.show_on_email}
              onCheckedChange={(checked) => onUpdate(index, { show_on_email: checked })}
            />
            <Label className="text-sm cursor-pointer">Email</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Icon Picker Dialog
const IconPickerDialog = ({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (platformName: string, iconUrl: string) => void;
}) => {
  const platforms = Object.entries(PLATFORM_ICONS);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Platform Icon</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          <div className="grid grid-cols-4 gap-3">
            {platforms.map(([name, iconUrl]) => (
              <button
                key={name}
                type="button"
                onClick={() => onSelect(name, iconUrl)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <img src={iconUrl} alt={name} className="w-8 h-8 object-contain" />
                <span className="text-xs text-muted-foreground capitalize truncate w-full text-center">
                  {name}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

const SocialLinksManager = ({ companyId }: SocialLinksManagerProps) => {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerIndex, setIconPickerIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchLinks();
  }, [companyId]);

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('company_social_links')
        .select('*')
        .eq('company_id', companyId)
        .order('display_order');

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('Error fetching social links:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLink = () => {
    if (links.length >= MAX_LINKS) {
      toast.error(`Maximum ${MAX_LINKS} social links allowed`);
      return;
    }

    setLinks([
      ...links,
      {
        platform_name: '',
        url: '',
        icon_url: null,
        show_on_invoice: true,
        show_on_quote: true,
        show_on_job: true,
        show_on_email: true,
        display_order: links.length,
      },
    ]);
  };

  const removeLink = async (index: number) => {
    const link = links[index];
    if (link.id) {
      try {
        const { error } = await supabase
          .from('company_social_links')
          .delete()
          .eq('id', link.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error deleting link:', error);
        toast.error('Failed to delete link');
        return;
      }
    }
    setLinks(links.filter((_, i) => i !== index));
    toast.success('Social link removed');
  };

  const updateLink = (index: number, updates: Partial<SocialLink>) => {
    setLinks(links.map((link, i) => (i === index ? { ...link, ...updates } : link)));
  };

  const getDisplayIcon = (link: SocialLink): string | null => {
    // Custom uploaded icon takes priority
    if (link.icon_url) return link.icon_url;
    // Otherwise, use default platform icon
    return getDefaultPlatformIcon(link.platform_name);
  };

  const openIconPicker = (index: number) => {
    setIconPickerIndex(index);
    setIconPickerOpen(true);
  };

  const handleIconSelect = (platformName: string, iconUrl: string) => {
    if (iconPickerIndex !== null) {
      // Set platform name and clear custom icon (will use default)
      updateLink(iconPickerIndex, { 
        platform_name: platformName.charAt(0).toUpperCase() + platformName.slice(1),
        icon_url: null 
      });
    }
    setIconPickerOpen(false);
    setIconPickerIndex(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLinks((items) => {
        const oldIndex = items.findIndex((item) => (item.id || `new-${items.indexOf(item)}`) === active.id);
        const newIndex = items.findIndex((item) => (item.id || `new-${items.indexOf(item)}`) === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const saveLinks = async () => {
    setSaving(true);
    try {
      // Validate all links have platform name and URL
      for (const link of links) {
        if (!link.platform_name.trim() || !link.url.trim()) {
          toast.error('All links must have a platform name and URL');
          setSaving(false);
          return;
        }
      }

      // Delete existing links and insert new ones
      await supabase
        .from('company_social_links')
        .delete()
        .eq('company_id', companyId);

      if (links.length > 0) {
        const linksToInsert = links.map((link, index) => ({
          company_id: companyId,
          platform_name: link.platform_name,
          url: link.url,
          icon_url: link.icon_url,
          show_on_invoice: link.show_on_invoice,
          show_on_quote: link.show_on_quote,
          show_on_job: link.show_on_job,
          show_on_email: link.show_on_email,
          display_order: index,
        }));

        const { error } = await supabase
          .from('company_social_links')
          .insert(linksToInsert);

        if (error) throw error;
      }

      toast.success('Social links saved');
      fetchLinks();
    } catch (error) {
      console.error('Error saving links:', error);
      toast.error('Failed to save social links');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Social Media Links</h3>
          <p className="text-sm text-muted-foreground">
            Add up to {MAX_LINKS} social links. Drag to reorder. Pick from defaults or upload custom icons.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLink}
          disabled={links.length >= MAX_LINKS}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Link
        </Button>
      </div>

      {links.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-2">No social links added yet</p>
          <Button type="button" variant="outline" size="sm" onClick={addLink}>
            <Plus className="w-4 h-4 mr-1" />
            Add Your First Link
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={links.map((link, index) => link.id || `new-${index}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {links.map((link, index) => (
                <SortableLinkCard
                  key={link.id || `new-${index}`}
                  link={link}
                  index={index}
                  onUpdate={updateLink}
                  onRemove={removeLink}
                  onOpenIconPicker={openIconPicker}
                  getDisplayIcon={getDisplayIcon}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {links.length > 0 && (
        <Button type="button" onClick={saveLinks} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Social Links
        </Button>
      )}

      <IconPickerDialog
        open={iconPickerOpen}
        onClose={() => {
          setIconPickerOpen(false);
          setIconPickerIndex(null);
        }}
        onSelect={handleIconSelect}
      />
    </div>
  );
};

export default SocialLinksManager;
