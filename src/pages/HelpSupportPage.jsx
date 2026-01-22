import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  HelpCircle, Mail, MessageSquare, BookOpen, Shield, 
  CreditCard, User, Settings, Search, ChevronDown, ChevronUp, Crown
} from 'lucide-react';
import Footer from '@/components/Footer';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

const HelpSupportPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_premium, full_name, premium_expires_at')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile) {
            setUserProfile(profile);
            // Check if premium is active (not expired)
            const isPremiumActive = profile.is_premium && 
              (!profile.premium_expires_at || new Date(profile.premium_expires_at) > new Date());
            setIsPremium(isPremiumActive);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserProfile();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get current user if logged in
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      // Call the Supabase Edge Function to send support email
      const { data, error } = await supabase.functions.invoke('send-support-email', {
        body: {
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
          userId: userId
        }
      });

      if (error) {
        throw error;
      }

      const responseTime = isPremium 
        ? "We've received your message and will get back to you within 4-12 hours (Priority Support)."
        : "We've received your message and will get back to you within 24-48 hours.";
      
      toast({
        title: "Message Sent",
        description: responseTime,
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      console.error('Error sending support message:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const faqCategories = [
    {
      title: "Account & Profile",
      icon: User,
      questions: [
        {
          q: "How do I complete my profile?",
          a: "Go to your Profile page and fill in all required fields including photos, bio, and preferences. A complete profile increases your chances of finding a match."
        },
        {
          q: "How long does profile approval take?",
          a: "Profile approval typically takes 24-48 hours. You'll receive a notification once your profile is reviewed."
        },
        {
          q: "Can I change my email address?",
          a: "Yes, you can update your email in Account Settings. You'll need to verify the new email address."
        },
        {
          q: "How do I delete my account?",
          a: "Contact our support team to request account deletion. We'll process your request within 7 business days."
        }
      ]
    },
    {
      title: "Premium & Billing",
      icon: CreditCard,
      questions: [
        {
          q: "What are the benefits of Premium?",
          a: "Premium members get unlimited messages, see who liked them, read receipts, advanced filters, and priority support."
        },
        {
          q: "How do I cancel my Premium subscription?",
          a: "Go to Account Settings → Billing and click 'Cancel Subscription'. Your Premium access will continue until the end of your billing period."
        },
        {
          q: "Will I get a refund if I cancel?",
          a: "Refunds are handled on a case-by-case basis. Please review our Refund Policy or contact support for assistance."
        },
        {
          q: "How do I update my payment method?",
          a: "Navigate to Account Settings → Billing and update your payment information there."
        }
      ]
    },
    {
      title: "Matching & Discovery",
      icon: Search,
      questions: [
        {
          q: "How does the matching algorithm work?",
          a: "Our algorithm considers your preferences, values, cultural background, and relationship goals to suggest compatible matches."
        },
        {
          q: "Why am I not seeing many profiles?",
          a: "This could be due to your filters being too restrictive. Try adjusting your age range, distance, or other preferences in Discovery."
        },
        {
          q: "Can I see who viewed my profile?",
          a: "Yes, this is a Premium feature. Premium members can see who viewed their profile in the 'Who Viewed You' tab on the Matches page."
        },
        {
          q: "How do I save my search preferences?",
          a: "Premium members can save and load search preferences. Use the 'Save Search' button in the Discovery filters panel."
        }
      ]
    },
    {
      title: "Messaging & Communication",
      icon: MessageSquare,
      questions: [
        {
          q: "What is the message limit for free users?",
          a: "Free users can send up to 10 messages per day. Premium members have unlimited messaging."
        },
        {
          q: "How do read receipts work?",
          a: "Premium members can see when their messages are delivered and read. This is indicated by 'Delivered' and 'Seen' status in your conversations."
        },
        {
          q: "What should I do if someone sends inappropriate messages?",
          a: "Report the user immediately using the report button on their profile or in the conversation. Our safety team will review the report."
        },
        {
          q: "Can I block someone?",
          a: "Yes, you can block users from their profile page. Blocked users won't be able to message you or see your profile."
        }
      ]
    },
    {
      title: "Safety & Security",
      icon: Shield,
      questions: [
        {
          q: "How do you verify profiles?",
          a: "We verify profiles through document verification and manual review. Verified profiles display a verification badge."
        },
        {
          q: "What should I do if I encounter suspicious behavior?",
          a: "Report the user immediately and contact our safety team. We take all reports seriously and investigate promptly."
        },
        {
          q: "Is my personal information safe?",
          a: "Yes, we use industry-standard encryption and security measures. Please review our Privacy Policy for more details."
        },
        {
          q: "How do I report a user?",
          a: "Click the 'Report' button on their profile or in your conversation. Provide as much detail as possible to help us investigate."
        }
      ]
    }
  ];

  const quickLinks = [
    { title: "Account Settings", icon: Settings, path: "/account-settings" },
    { title: "Premium Features", icon: CreditCard, path: "/premium" },
    { title: "Community Guidelines", icon: BookOpen, path: "/community-guidelines" },
    { title: "Safety & Security", icon: Shield, path: "/safety" },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#E6B450] rounded-full mb-4">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-[#1F1F1F] mb-4">Help & Support</h1>
          <p className="text-lg text-[#706B67] max-w-2xl mx-auto">
            We're here to help! Find answers to common questions or contact our support team.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {quickLinks.map((link) => (
            <Button
              key={link.path}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 border-[#E6DCD2] hover:border-[#E6B450] hover:bg-[#FFFBEB]"
              onClick={() => navigate(link.path)}
            >
              <link.icon className="w-5 h-5 text-[#E6B450]" />
              <span className="text-sm font-medium text-[#1F1F1F]">{link.title}</span>
            </Button>
          ))}
        </div>

        {/* Contact Form */}
        <div className="max-w-2xl mx-auto mb-12">
          <Card className="border-[#E6DCD2]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#1F1F1F]">
                <Mail className="w-5 h-5 text-[#E6B450]" />
                Contact Support
                {isPremium && (
                  <Badge className="bg-[#E6B450] text-[#1F1F1F] font-bold ml-2">
                    <Crown className="w-3 h-3 mr-1" /> Priority
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isPremium 
                  ? "Send us a message and we'll get back to you within 4-12 hours (Priority Support)."
                  : "Send us a message and we'll get back to you within 24-48 hours."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-[#1F1F1F]">Your Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="mt-1 border-[#E6DCD2] focus:border-[#E6B450]"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-[#1F1F1F]">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="mt-1 border-[#E6DCD2] focus:border-[#E6B450]"
                    placeholder="your.email@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="subject" className="text-[#1F1F1F]">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="mt-1 border-[#E6DCD2] focus:border-[#E6B450]"
                    placeholder="What can we help you with?"
                  />
                </div>
                <div>
                  <Label htmlFor="message" className="text-[#1F1F1F]">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={5}
                    className="mt-1 border-[#E6DCD2] focus:border-[#E6B450]"
                    placeholder="Please provide as much detail as possible..."
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#E6B450] text-[#1F1F1F] hover:bg-[#D0A23D] font-bold"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-[#1F1F1F] mb-8 text-center">Frequently Asked Questions</h2>
          
          {faqCategories.map((category, categoryIndex) => (
            <Card key={categoryIndex} className="mb-6 border-[#E6DCD2]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#1F1F1F]">
                  <category.icon className="w-5 h-5 text-[#E6B450]" />
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${categoryIndex}-${index}`} className="border-[#E6DCD2]">
                      <AccordionTrigger className="text-left text-[#1F1F1F] hover:text-[#E6B450]">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-[#706B67] pt-2">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default HelpSupportPage;
