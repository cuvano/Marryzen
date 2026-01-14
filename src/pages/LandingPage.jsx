import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Heart, Shield, CheckCircle, Users, Lock, Star, 
  MessageCircle, UserCheck, Search, BadgeCheck, LogIn 
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect authenticated users to dashboard
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/dashboard');
      }
    };
    checkAuth();
  }, [navigate]);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#FAF7F2]">
      <Helmet>
        <title>Marryzen | Serious Marriage Matchmaking Platform</title>
        <meta name="description" content="Marryzen is a private, values-based marriage matchmaking platform for serious, verified members seeking lifelong commitment." />
      </Helmet>

      {/* --- PUBLIC NAV BAR --- */}
      <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-md border-b border-[#E6DCD2] h-20 flex items-center shadow-sm transition-all">
          <div className="container mx-auto px-4 flex justify-between items-center">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                 <span className="text-2xl font-extrabold text-[#1F1F1F] tracking-tight">
                    Marryzen<span className="text-[#C85A72]">.</span>
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                  <Button variant="ghost" onClick={() => navigate('/login')} className="text-[#1F1F1F] font-bold hover:bg-[#FAF7F2] flex items-center">
                      <LogIn className="w-4 h-4 mr-2"/> <span className="hidden sm:inline">Log In</span>
                  </Button>
                  <Button onClick={() => navigate('/onboarding')} className="bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold rounded-full px-3 sm:px-6 text-sm sm:text-base shadow-md transition-transform hover:scale-105">
                      <span className="hidden sm:inline">Create My Marriage Profile</span>
                      <span className="sm:hidden">Sign Up</span>
                  </Button>
              </div>
          </div>
      </nav>
      
      {/* --- HERO SECTION --- */}
      <div className="relative z-10 container mx-auto px-4 pt-32 pb-16 md:pt-40 md:pb-20 separator-line">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-5xl mx-auto"
        >
          <h1 className="text-5xl md:text-7xl font-extrabold text-[#1F1F1F] mb-6 tracking-tight leading-tight">
            Marryzen
            <span className="block text-[#C85A72] mt-3 text-3xl md:text-5xl font-serif italic">Where Serious Marriages Begin</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-[#706B67] mb-10 max-w-3xl mx-auto leading-relaxed font-medium">
            A private, values-based marriage platform for those seeking lifelong commitment. 
            No casual dating. No endless swiping. Just real connections.
          </p>

          {/* Trust Bullets */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-12 text-[#333333] text-sm md:text-base font-semibold">
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-full border border-[#E6DCD2] shadow-sm">
                <Heart className="w-5 h-5 text-[#C85A72]" /> Serious Marriage Only
            </div>
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-full border border-[#E6DCD2] shadow-sm">
                <BadgeCheck className="w-5 h-5 text-[#E6B450]" /> Identity-Verified
            </div>
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-full border border-[#E6DCD2] shadow-sm">
                <Users className="w-5 h-5 text-[#E6B450]" /> Culture & Values Matching
            </div>
            <div className="flex items-center gap-2 bg-white px-5 py-3 rounded-full border border-[#E6DCD2] shadow-sm">
                <Shield className="w-5 h-5 text-[#C85A72]" /> Safe & Family-Approved
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Button 
              size="lg" 
              className="btn-primary-gold text-lg px-12 py-8 h-auto"
              onClick={() => navigate('/onboarding')}
            >
              Create My Marriage Profile
            </Button>
            <Button 
              size="lg" 
              variant="ghost" 
              className="btn-secondary-rose text-lg px-12 py-8 h-auto"
              onClick={() => scrollToSection('how-it-works')}
            >
              See How It Works
            </Button>
          </div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="relative max-w-5xl mx-auto rounded-[14px] overflow-hidden shadow-lg border border-[#E6DCD2]"
          >
             <img 
                className="w-full h-[400px] md:h-[600px] object-cover object-center" 
                alt="Happy couple celebrating their engagement" 
                src="https://horizons-cdn.hostinger.com/beeb441a-bd06-4d39-a2b1-757677af16cf/1cf7408d2dd92dd14b7f2e3a17f6e6c6.jpg" 
             />
          </motion.div>
        </motion.div>
      </div>

      {/* --- TRUST STRIP --- */}
      <div className="bg-[#F3E8D9] border-b border-[#E6DCD2] py-12">
        <div className="container mx-auto px-4 text-center">
            <p className="text-xl md:text-2xl font-serif italic text-[#1F1F1F] tracking-wide leading-relaxed">
                "Marryzen is built for real relationships, real families, and real futures."
            </p>
        </div>
      </div>

      {/* --- HOW MARRYZEN WORKS --- */}
      <section id="how-it-works" className="section-pad bg-[#FAF7F2] separator-line">
        <div className="container mx-auto px-4">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">How Marryzen Works</h2>
                <p className="text-[#706B67] text-lg max-w-2xl mx-auto">Your journey to marriage is simple, structured, and safe.</p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-8">
                {[
                    { title: "Create Real Profile", desc: "Share your values, family background, and what you're looking for.", icon: UserCheck, color: "text-[#E6B450]" },
                    { title: "Verify Identity", desc: "We check every profile to ensure you're meeting real people.", icon: BadgeCheck, color: "text-[#C85A72]" },
                    { title: "Get Compatibility Matches", desc: "Receive matches based on deep compatibility, not just looks.", icon: Heart, color: "text-[#E6B450]" },
                    { title: "Start Respectful Conversation", desc: "Connect with purpose. No games, just serious intent.", icon: MessageCircle, color: "text-[#C85A72]" }
                ].map((step, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        viewport={{ once: true }}
                        className="card-warm p-8 text-center"
                    >
                        <div className={`w-16 h-16 bg-[#FAF7F2] rounded-full flex items-center justify-center mx-auto mb-6 ${step.color} shadow-sm`}>
                            <step.icon size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-[#1F1F1F] mb-4">{step.title}</h3>
                        <p className="text-[#706B67] text-base leading-relaxed">{step.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>
      </section>

      {/* --- WHAT MAKES MARRYZEN DIFFERENT (HIGHLIGHT) --- */}
      <section className="section-pad bg-[#F9E7EB] separator-line">
        <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
                <div>
                    <h2 className="text-3xl md:text-5xl font-bold text-[#1F1F1F] mb-8 leading-tight">
                        What Makes <br/> <span className="text-[#C85A72] font-serif italic">Marryzen Different?</span>
                    </h2>
                    <div className="space-y-6">
                        {[
                            "Marriage-Only Focus (Absolutely no casual dating)",
                            "Identity & Intent Verification for every user",
                            "Value-Based Matching (Religion, Culture, Family)",
                            "Safe & Moderated Environment",
                            "Private & Respectful Community Standards"
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-4 text-[#333333]">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#C85A72] shrink-0 mt-1 border border-[#C85A72]/20 shadow-sm">
                                    <CheckCircle size={18} />
                                </div>
                                <span className="text-lg font-medium">{item}</span>
                            </div>
                        ))}
                    </div>
                    <Button 
                        className="mt-12 bg-[#FFFFFF] text-[#C85A72] hover:bg-[#FAFAF7] font-bold text-lg px-10 py-7 h-auto rounded-full border border-[#C85A72]/30 shadow-lg"
                        onClick={() => navigate('/onboarding')}
                    >
                        Experience the Difference
                    </Button>
                </div>
                <div className="relative">
                     <img className="relative rounded-[14px] shadow-xl w-full border-4 border-white" alt="Collage of happy couples who met on Marryzen" src="https://images.unsplash.com/photo-1516110554988-3fcddc17b640" />
                </div>
            </div>
        </div>
      </section>

      {/* --- WHO MARRYZEN IS FOR (SECONDARY) --- */}
      <section className="section-pad bg-[#F3E8D9] separator-line">
        <div className="container mx-auto px-4 text-center max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-12">Who Marryzen Is For</h2>
            <div className="flex flex-wrap justify-center gap-4">
                {[
                    "Singles strictly seeking marriage",
                    "Professionals ready for commitment",
                    "People valuing cultural traditions",
                    "Those tired of casual swiping apps",
                    "Individuals wanting a safe environment"
                ].map((text, i) => (
                    <div key={i} className="bg-white border border-[#E6DCD2] px-8 py-4 rounded-[14px] text-[#333333] text-lg font-medium shadow-sm hover:shadow-md transition-all cursor-default">
                        {text}
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* --- PREMIUM MEMBERSHIP PREVIEW (PRIMARY) --- */}
      <section className="section-pad bg-[#FAF7F2] separator-line">
        <div className="container mx-auto px-4">
             <div className="bg-[#F3E8D9] border border-[#E6DCD2] rounded-[14px] p-8 md:p-16 relative overflow-hidden shadow-sm">
                
                <div className="relative z-10 grid md:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-[#E6B450] text-white px-4 py-2 rounded-full text-sm font-bold mb-8 shadow-sm">
                            <Star size={16} fill="currentColor" /> Premium Membership
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-6">Upgrade Your Search for Love</h2>
                        <p className="text-[#333333] mb-8 text-xl leading-relaxed">Serious tools for serious members. Get the best chance of finding your partner.</p>
                        <ul className="grid gap-4 mb-10">
                            {[
                                "Unlimited Messaging & Chat",
                                "See Who Viewed Your Profile",
                                "Advanced Preference Filters",
                                "Priority Profile Placement",
                                "Read Receipts on Messages",
                                "Gold 'Serious Intent' Badge",
                                "Weekly Curated Introductions"
                            ].map((feat, i) => (
                                <li key={i} className="flex items-center gap-4 text-[#333333] text-lg">
                                    <CheckCircle className="text-[#C85A72] shrink-0" size={20} /> {feat}
                                </li>
                            ))}
                        </ul>
                        <Button onClick={() => navigate('/premium')} className="btn-primary-gold text-lg px-10 py-6 h-auto">
                            View Plans & Pricing
                        </Button>
                    </div>
                    <div className="flex justify-center">
                        <div className="bg-white p-8 rounded-[14px] max-w-sm w-full shadow-xl border border-[#E6DCD2] transform rotate-2">
                             <div className="flex items-center gap-4 mb-6 border-b border-[#FAF7F2] pb-6">
                                 <div className="w-16 h-16 rounded-full bg-[#F3E8D9]"></div>
                                 <div>
                                     <div className="h-4 w-32 bg-[#F3E8D9] rounded mb-3"></div>
                                     <div className="h-3 w-20 bg-[#FAF7F2] rounded"></div>
                                 </div>
                                 <div className="ml-auto">
                                    <div className="w-10 h-10 bg-[#E6B450] rounded-full flex items-center justify-center shadow-md">
                                        <Star size={20} className="text-white fill-white" />
                                    </div>
                                 </div>
                             </div>
                             <div className="space-y-4">
                                 <div className="h-3 w-full bg-[#FAF7F2] rounded"></div>
                                 <div className="h-3 w-full bg-[#FAF7F2] rounded"></div>
                                 <div className="h-3 w-3/4 bg-[#FAF7F2] rounded"></div>
                             </div>
                             <div className="mt-8 bg-[#FFF9E6] text-[#E6B450] text-center py-3 rounded-lg text-sm font-bold border border-[#E6B450]/30 uppercase tracking-wider">
                                 Premium Match
                             </div>
                        </div>
                    </div>
                </div>
             </div>
        </div>
      </section>

      {/* --- SAFETY & PRIVACY PROMISE (SAFETY BLUE) --- */}
      <section className="section-pad bg-[#EAF2F7] separator-line">
        <div className="container mx-auto px-4 text-center">
            <Shield className="w-16 h-16 text-[#C85A72] mx-auto mb-6 opacity-90" />
            <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-6">Our Safety & Privacy Promise</h2>
            <p className="text-[#333333] text-xl max-w-3xl mx-auto mb-12">We take your safety as seriously as your marriage search. Our platform is rigorously moderated.</p>
            
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {[
                    { icon: BadgeCheck, text: "Strict ID Verification" },
                    { icon: Search, text: "AI Content Moderation" },
                    { icon: Users, text: "Dedicated Safety Team" },
                    { icon: Shield, text: "Proactive Scam Detection" },
                    { icon: Lock, text: "Total Privacy Controls" }
                ].map((item, i) => (
                    <div key={i} className="bg-white p-8 rounded-[14px] flex flex-col items-center gap-5 shadow-sm border border-[#E6DCD2] hover:shadow-md transition-shadow">
                        <item.icon className="text-[#E6B450]" size={32} />
                        <span className="text-[#1F1F1F] font-semibold text-base">{item.text}</span>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* --- SUCCESS STORIES (HIGHLIGHT) --- */}
      <section className="section-pad bg-[#F9E7EB] separator-line">
        <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] text-center mb-16">Success Stories</h2>
            <div className="grid md:grid-cols-3 gap-8">
                {[
                    { quote: "I was about to give up on apps until I found Marryzen. It's completely different—serious people only. Found my husband in 3 months.", name: "Sarah & Ahmed", loc: "Matched in London" },
                    { quote: "Finally a platform that understands family values. Our parents were so happy we met here. Highly recommended for serious singles.", name: "Priya & Rahul", loc: "Matched in Toronto" },
                    { quote: "No games, no ghosting. Just real conversations about future goals. We're getting married next summer!", name: "Michael & Elena", loc: "Matched in New York" }
                ].map((story, i) => (
                    <div key={i} className="bg-white p-8 rounded-[14px] relative border border-[#E6DCD2] shadow-sm">
                        <div className="text-[#E6B450] text-5xl font-serif absolute top-4 left-6 opacity-60">"</div>
                        <p className="text-[#333333] text-lg italic mb-8 pt-6 relative z-10 leading-relaxed">{story.quote}</p>
                        <div className="border-t border-[#FAF7F2] pt-6">
                            <p className="text-[#1F1F1F] font-bold text-lg">{story.name}</p>
                            <p className="text-[#706B67] text-sm">{story.loc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* --- FINAL CTA --- */}
      <section className="section-pad bg-gradient-to-b from-[#F9E7EB] to-[#FAF7F2]">
         <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-[#1F1F1F] mb-6">Start Your Marriage Journey Today</h2>
            <p className="text-xl text-[#706B67] mb-12 max-w-3xl mx-auto leading-relaxed">
                Your partner is out there looking for you too. Don't wait for chance.
            </p>
            <Button 
                size="lg" 
                className="btn-primary-gold text-xl px-16 py-10 h-auto font-bold shadow-lg"
                onClick={() => navigate('/onboarding')}
            >
                Create My Marriage Profile
            </Button>
            <p className="mt-8 text-[#706B67] text-sm font-medium opacity-80">
                *By joining, you agree to our Code of Conduct. Serious intent required.
            </p>
         </div>
      </section>

    </div>
  );
};

export default LandingPage;