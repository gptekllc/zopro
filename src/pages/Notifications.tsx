import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  CreditCard, 
  XCircle, 
  FileCheck, 
  Loader2,
  Trash2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data: unknown;
}

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Fetch notifications
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching notifications:', error);
        toast.error('Failed to load notifications');
      } else {
        setNotifications(data || []);
      }
      setIsLoading(false);
    };

    fetchNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          toast.info(newNotification.title, {
            description: newNotification.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      toast.error('Failed to mark as read');
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    if (error) {
      toast.error('Failed to mark all as read');
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      toast.error('Failed to delete notification');
    } else {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment_received':
        return <CreditCard className="w-5 h-5 text-emerald-500" />;
      case 'payment_failed':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'quote_approved':
        return <FileCheck className="w-5 h-5 text-primary" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'payment_received':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Payment</Badge>;
      case 'payment_failed':
        return <Badge variant="destructive">Failed Payment</Badge>;
      case 'quote_approved':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Quote Approved</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    const data = notification.data as Record<string, string> | null;
    if (notification.type === 'payment_received' || notification.type === 'payment_failed') {
      navigate('/invoices');
    } else if (notification.type === 'quote_approved') {
      navigate('/quotes');
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter((n) => !n.is_read) 
    : notifications;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Notifications</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Stay updated on payments, quotes, and events
            </p>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="sm:size-default" onClick={markAllAsRead}>
                <CheckCheck className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Mark all as read</span>
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                variant="outline"
                size="sm"
                className="sm:size-default"
                onClick={async () => {
                  if (confirm('Are you sure you want to clear all notifications?')) {
                    const { error } = await supabase
                      .from('notifications')
                      .delete()
                      .eq('user_id', user!.id);
                    if (error) {
                      toast.error('Failed to clear notifications');
                    } else {
                      setNotifications([]);
                      toast.success('All notifications cleared');
                    }
                  }
                }}
              >
                <Trash2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Clear all</span>
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold">{notifications.length}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-amber-500/10 rounded-lg shrink-0">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold">{unreadCount}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Unread</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-emerald-500/10 rounded-lg shrink-0">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold">
                    {notifications.filter((n) => n.type === 'payment_received').length}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Payments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
                  <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold">
                    {notifications.filter((n) => n.type === 'quote_approved').length}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Approvals</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications List */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg sm:text-xl">Activity Feed</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Real-time updates on your business</CardDescription>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
                <TabsList className="h-8 sm:h-9">
                  <TabsTrigger value="all" className="text-xs sm:text-sm px-2.5 sm:px-3">All</TabsTrigger>
                  <TabsTrigger value="unread" className="text-xs sm:text-sm px-2.5 sm:px-3">
                    Unread
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="ml-1.5 sm:ml-2 text-[10px] sm:text-xs h-4 sm:h-5 px-1 sm:px-1.5">
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-muted-foreground">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  You'll see payment and quote updates here
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] sm:h-[500px] -mr-4 pr-4">
                <div className="space-y-2 sm:space-y-3">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-2 sm:gap-3 p-2.5 sm:p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                        !notification.is_read ? 'bg-primary/5 border-primary/20' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1 flex-wrap">
                          {getNotificationBadge(notification.type)}
                          {!notification.is_read && (
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="font-medium text-xs sm:text-sm md:text-base truncate">{notification.title}</p>
                        <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-1.5">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex gap-0.5 sm:gap-1 shrink-0">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Notifications;
