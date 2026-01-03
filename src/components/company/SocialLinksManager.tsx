import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Upload, Loader2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getDefaultPlatformIcon, getAvailablePlatforms } from '@/lib/platformIcons';
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

const SocialLinksManager = ({ companyId }: SocialLinksManagerProps) => {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

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

  const clearCustomIcon = (index: number) => {
    updateLink(index, { icon_url: null });
    toast.success('Custom icon removed');
  };

  const handleIconUpload = async (index: number, file: File) => {
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (PNG, JPG, GIF, SVG, or WebP)');
      return;
    }

    if (file.size > 500 * 1024) {
      toast.error('Icon must be less than 500KB');
      return;
    }

    setUploadingIndex(index);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${companyId}/${Date.now()}-${index}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('social-icons')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('social-icons')
        .getPublicUrl(fileName);

      updateLink(index, { icon_url: publicUrl });
      toast.success('Icon uploaded');
    } catch (error) {
      console.error('Error uploading icon:', error);
      toast.error('Failed to upload icon');
    } finally {
      setUploadingIndex(null);
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
            Add up to {MAX_LINKS} social links with custom icons. Toggle visibility for each document type.
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
        <div className="space-y-3">
          {links.map((link, index) => (
            <Card key={link.id || index} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {/* Icon Display/Upload */}
                  <div className="flex-shrink-0">
                    <Label className="text-xs text-muted-foreground mb-1 block">Icon</Label>
                    <div className="relative">
                      <label className="cursor-pointer">
                        <div className="w-12 h-12 border-2 border-dashed rounded-lg flex items-center justify-center hover:bg-muted/50 transition-colors overflow-hidden">
                          {uploadingIndex === index ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : getDisplayIcon(link) ? (
                            <img src={getDisplayIcon(link)!} alt={link.platform_name} className="w-8 h-8 object-contain" />
                          ) : (
                            <Upload className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleIconUpload(index, file);
                          }}
                        />
                      </label>
                      {/* Clear custom icon button */}
                      {link.icon_url && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            clearCustomIcon(index);
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Platform Name & URL */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Platform Name</Label>
                      <Input
                        list={`platforms-${index}`}
                        placeholder="e.g. Facebook, X, TikTok"
                        value={link.platform_name}
                        onChange={(e) => updateLink(index, { platform_name: e.target.value })}
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
                        onChange={(e) => updateLink(index, { url: e.target.value })}
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
                      onClick={() => removeLink(index)}
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
                      onCheckedChange={(checked) => updateLink(index, { show_on_invoice: checked })}
                    />
                    <Label className="text-sm cursor-pointer">Invoice</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={link.show_on_quote}
                      onCheckedChange={(checked) => updateLink(index, { show_on_quote: checked })}
                    />
                    <Label className="text-sm cursor-pointer">Quote</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={link.show_on_job}
                      onCheckedChange={(checked) => updateLink(index, { show_on_job: checked })}
                    />
                    <Label className="text-sm cursor-pointer">Job</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={link.show_on_email}
                      onCheckedChange={(checked) => updateLink(index, { show_on_email: checked })}
                    />
                    <Label className="text-sm cursor-pointer">Email</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
    </div>
  );
};

export default SocialLinksManager;
