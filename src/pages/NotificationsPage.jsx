import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  Bell, Heart, MessageSquare, UserPlus, CheckCircle, XCircle, Award, 
  Settings, Mail, Smartphone, Loader2, ArrowLeft, Trash2
} from 'lucide-react';
import Footer from '@/components/Footer';
import { formatDistanceToNow } from 'date-fns';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState({
    email_enabled: true,
    push_enabled: true,
    email_match: true,
    email_message: true,
    email_intro: true,
    email_profile: true,
    email_reward: true,
  });
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchNotifications();
    fetchSettings();
    
    // Subscribe to realtime notifications
    const channel = supabase
      .channel('notifications_page')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications' 
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load notifications", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to fetch notification settings from user_preferences table
      // If table doesn't exist, use localStorage as fallback
      try {
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('notification_settings')
          .eq('user_id', user.id)
          .maybeSingle();

        if (prefs?.notification_settings) {
          setSettings({ ...settings, ...prefs.notification_settings });
        }
      } catch (dbError) {
        // If table doesn't exist, try localStorage
        const savedSettings = localStorage.getItem(`notification_settings_${user.id}`);
        if (savedSettings) {
          setSettings({ ...settings, ...JSON.parse(savedSettings) });
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to save to user_preferences table, fallback to localStorage
      try {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            notification_settings: settings
          }, { onConflict: 'user_id' });

        if (error) throw error;
        toast({ title: "Success", description: "Notification settings saved!" });
      } catch (dbError) {
        // Fallback to localStorage if table doesn't exist
        localStorage.setItem(`notification_settings_${user.id}`, JSON.stringify(settings));
        toast({ title: "Success", description: "Notification settings saved locally!" });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_match':
        return <Heart className="w-5 h-5 text-[#C85A72]" />;
      case 'new_message':
        return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'intro_request':
        return <UserPlus className="w-5 h-5 text-[#E6B450]" />;
      case 'profile_approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'profile_rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'referral_reward':
        return <Award className="w-5 h-5 text-[#E6B450]" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'new_match':
        return 'bg-pink-50 border-pink-200';
      case 'new_message':
        return 'bg-blue-50 border-blue-200';
      case 'intro_request':
        return 'bg-yellow-50 border-yellow-200';
      case 'profile_approved':
        return 'bg-green-50 border-green-200';
      case 'profile_rejected':
        return 'bg-red-50 border-red-200';
      case 'referral_reward':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.read) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id);
      
      if (!error) {
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
      }
    }

    // Route based on notification type
    const metadata = notification.metadata || {};
    
    switch (notification.type) {
      case 'new_match':
        navigate('/matches');
        break;
      case 'new_message':
        if (metadata.conversation_id) {
          navigate(`/chat/${metadata.conversation_id}`);
        } else {
          navigate('/chat');
        }
        break;
      case 'intro_request':
        if (metadata.profile_id) {
          navigate(`/profile/${metadata.profile_id}`);
        } else {
          navigate('/discovery');
        }
        break;
      case 'profile_approved':
      case 'profile_rejected':
        navigate('/profile');
        break;
      case 'referral_reward':
        navigate('/rewards');
        break;
      default:
        // Stay on notifications page
        break;
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast({ title: "Success", description: "All notifications marked as read" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to mark all as read", variant: "destructive" });
    }
  };

  const deleteNotification = async (id, e) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast({ title: "Success", description: "Notification deleted" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete notification", variant: "destructive" });
    }
  };

  const filteredNotifications = () => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'matches':
        return notifications.filter(n => n.type === 'new_match');
      case 'messages':
        return notifications.filter(n => n.type === 'new_message');
      case 'rewards':
        return notifications.filter(n => n.type === 'referral_reward');
      default:
        return notifications;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#E6B450]" />
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered = filteredNotifications();

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-[#1F1F1F] mb-2 flex items-center gap-2">
            <Bell className="text-[#C85A72]" />
            Notifications
          </h1>
          <p className="text-[#706B67]">Stay updated with your matches, messages, and rewards</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
            <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6">
            {/* Actions Bar */}
            {filtered.length > 0 && (
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                >
                  Mark All as Read
                </Button>
              </div>
            )}

            {/* Notifications List */}
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                  </h3>
                  <p className="text-gray-500">
                    {activeTab === 'unread' 
                      ? 'You\'re all caught up!' 
                      : 'You\'ll see notifications here when you have new matches, messages, or rewards.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filtered.map(notification => (
                  <Card 
                    key={notification.id}
                    className={`cursor-pointer hover:shadow-md transition-all border-2 ${
                      !notification.read ? 'border-[#E6B450] bg-[#FFFBEB]' : 'border-[#E6DCD2]'
                    } ${getNotificationColor(notification.type)}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-[#1F1F1F]">{notification.title}</h3>
                                {!notification.read && (
                                  <Badge className="bg-blue-500 text-white text-xs">New</Badge>
                                )}
                              </div>
                              <p className="text-sm text-[#706B67] mb-2">{notification.body}</p>
                              <span className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <button
                              onClick={(e) => deleteNotification(notification.id, e)}
                              className="p-1 hover:bg-red-100 rounded-full transition-colors"
                              title="Delete notification"
                            >
                              <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Notification Settings */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#E6B450]" />
              Notification Settings
            </CardTitle>
            <CardDescription>Choose how you want to receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Global Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#FAF7F2] rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[#706B67]" />
                  <div>
                    <Label className="text-[#1F1F1F] font-medium">Email Notifications</Label>
                    <p className="text-xs text-[#706B67]">Receive notifications via email</p>
                  </div>
                </div>
                <Switch 
                  checked={settings.email_enabled} 
                  onCheckedChange={(checked) => setSettings({ ...settings, email_enabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-[#FAF7F2] rounded-lg">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-[#706B67]" />
                  <div>
                    <Label className="text-[#1F1F1F] font-medium">Push Notifications</Label>
                    <p className="text-xs text-[#706B67]">Receive push notifications in browser</p>
                  </div>
                </div>
                <Switch 
                  checked={settings.push_enabled} 
                  onCheckedChange={(checked) => setSettings({ ...settings, push_enabled: checked })}
                />
              </div>
            </div>

            {/* Notification Type Preferences */}
            {settings.email_enabled && (
              <div className="pt-4 border-t border-[#E6DCD2]">
                <h4 className="font-medium text-[#1F1F1F] mb-4">Email Notification Types</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-[#C85A72]" />
                      <Label>New Matches</Label>
                    </div>
                    <Switch 
                      checked={settings.email_match} 
                      onCheckedChange={(checked) => setSettings({ ...settings, email_match: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-600" />
                      <Label>New Messages</Label>
                    </div>
                    <Switch 
                      checked={settings.email_message} 
                      onCheckedChange={(checked) => setSettings({ ...settings, email_message: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-[#E6B450]" />
                      <Label>Introduction Requests</Label>
                    </div>
                    <Switch 
                      checked={settings.email_intro} 
                      onCheckedChange={(checked) => setSettings({ ...settings, email_intro: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <Label>Profile Status Updates</Label>
                    </div>
                    <Switch 
                      checked={settings.email_profile} 
                      onCheckedChange={(checked) => setSettings({ ...settings, email_profile: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-[#E6B450]" />
                      <Label>Reward Updates</Label>
                    </div>
                    <Switch 
                      checked={settings.email_reward} 
                      onCheckedChange={(checked) => setSettings({ ...settings, email_reward: checked })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4">
              <Button 
                onClick={saveSettings}
                className="bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D]"
              >
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Footer />
      </div>
    </div>
  );
};

export default NotificationsPage;
