import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { 
  Heart, Shield, CheckCircle, Users, Lock, Star, 
  MessageCircle, UserCheck, Search, BadgeCheck, LogIn 
} from 'lucide-react';

// Sample profiles shown on the landing page. STYLIZED MOCKUPS, NOT real users
// — per exec consult (privacy + growth) all major dating apps (Tinder, Bumble,
// Hinge, Muzz, Salams, Christian Mingle, eHarmony) use synthetic illustrations
// rather than real users to avoid: (1) liability from outing a marriage-seeker
// on a public URL their employer/family can find; (2) GDPR Art. 9 special-
// category-data exposure (religion); (3) breach of our own "private and only
// visible to matches" representation. The "Representative profiles" disclaimer
// below the grid reinforces the privacy positioning faith users care about.
//
// Photos sourced from Unsplash (free for commercial use under the Unsplash
// License). Selected by an exec-style research pass to match the diversity
// quota below and avoid stock-photo cliches (no glam-shot vibe; warm, natural
// portraits that read as real people).
//
// Photographer attribution (recommended, not legally required by Unsplash):
//   Sarah  — @christianbuehner   David  — @ostape
//   Aisha  — @blenkov            Yusuf  — @djoshyy
//   Maria  — @christianbuehner   Daniel — @itfeelslikefilm
//
// Long-term: for full control + zero external dependency, mirror to your own
// CDN (horizons-cdn.hostinger.com — same CDN that hosts the hero engagement
// photo). Until then, Unsplash IDs are stable (the file behind an ID rarely
// gets replaced) so this is durable enough for v1.
//
// Diversity quota: 3M/3F, 3+ religious affiliations, age range 27-34, mix US +
// international city, 4+ visible ethnicities. Re-balance to match your real
// user base as it grows.
const SAMPLE_PROFILES = [
  {
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=750&fit=crop&crop=faces&q=80',
    name: 'Sarah',
    age: 29,
    faithLabel: 'Christian • Practicing',
    city: 'Brooklyn, NY',
    occupation: 'Pediatric Nurse',
    bio: 'Sunday service, weekday hikes, and a soft spot for golden retrievers.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=750&fit=crop&crop=faces&q=80',
    name: 'David',
    age: 32,
    faithLabel: 'Catholic • Practicing',
    city: 'Chicago, IL',
    occupation: 'Software Engineer',
    bio: 'Looking for a teammate, not just a date. Faith and family come first.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1596664427764-1a29079a6b6e?w=600&h=750&fit=crop&crop=faces&q=80',
    name: 'Aisha',
    age: 27,
    faithLabel: 'Muslim • Practicing',
    city: 'London, UK',
    occupation: 'Architecture Student',
    bio: 'Iftar with family, weekend museum trips, building something meaningful.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=600&h=750&fit=crop&crop=faces&q=80',
    name: 'Yusuf',
    age: 34,
    faithLabel: 'Muslim • Practicing',
    city: 'Houston, TX',
    occupation: 'Civil Engineer',
    bio: 'Quietly ambitious, family-oriented, ready for the next chapter.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&h=750&fit=crop&crop=faces&q=80',
    name: 'Maria',
    age: 30,
    faithLabel: 'Catholic • Practicing',
    city: 'Madrid, Spain',
    occupation: 'Marketing Manager',
    bio: 'Mass on Sundays, paella on Saturdays. Seeking a partner for the long road.',
  },
  {
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=750&fit=crop&crop=faces&q=80',
    name: 'Daniel',
    age: 31,
    faithLabel: 'Christian • Evangelical',
    city: 'Austin, TX',
    occupation: 'High School Teacher',
    bio: 'Bible study, BBQ, and looking for a wife to walk this life with.',
  },
];

// Single sample-profile card. Image lazy-loads; entrance animation staggers.
const SampleProfileCard = ({ photo, name, age, faithLabel, city, occupation, bio, delay = 0 }) => {
  const prefersReduced = useReducedMotion();
  return (
  <motion.div
    initial={prefersReduced ? false : { opacity: 0, y: 24 }}
    whileInView={prefersReduced ? undefined : { opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-50px' }}
    transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay, ease: 'easeOut' }}
    className="bg-white rounded-[14px] border border-[#E6DCD2] shadow-sm hover:shadow-md transition-all overflow-hidden group"
  >
    <div className="relative aspect-[4/5] overflow-hidden bg-[#F3E8D9]">
      <img
        src={photo}
        alt={`Sample profile illustration: ${name}, ${age}, ${city}`}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent h-2/5 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h3 className="text-xl font-bold leading-tight">{name}, {age}</h3>
        <p className="text-sm opacity-90 mt-0.5">{city}</p>
      </div>
    </div>
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs bg-[#F9E7EB] text-[#C85A72] px-2.5 py-1 rounded-full font-semibold">
          {faithLabel}
        </span>
        <span className="text-xs bg-[#F3E8D9] text-[#1F1F1F] px-2.5 py-1 rounded-full font-medium">
          {occupation}
        </span>
      </div>
      <p className="text-sm text-[#706B67] italic leading-snug">
        &ldquo;{bio}&rdquo;
      </p>
    </div>
  </motion.div>
  );
};

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
          <h1 className="text-3xl sm:text-4xl sm:text-5xl md:text-7xl font-extrabold text-[#1F1F1F] mb-6 tracking-tight leading-tight">
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
             <img loading="lazy" decoding="async" 
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

      {/* --- INSIDE MARRYZEN (sample profile cards) --- */}
      <section id="inside-marryzen" className="section-pad bg-[#FAF7F2] separator-line">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-4">
              What Your Matches Look Like
            </h2>
            <p className="text-lg text-[#706B67] max-w-2xl mx-auto">
              Faith-first, verified members seeking lifelong commitment — across denominations, cities, and stages of life.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {SAMPLE_PROFILES.map((p, i) => (
              <SampleProfileCard key={p.name} {...p} delay={i * 0.06} />
            ))}
          </div>

          <p className="text-center text-sm text-[#706B67] mt-10 italic opacity-80">
            Illustrative examples, not real members. Actual member profiles are private and visible only to mutual matches.
          </p>
        </div>
      </section>

      {/* --- HOW MARRYZEN WORKS --- */}
      <section id="how-it-works" className="section-pad bg-[#F3E8D9] separator-line">
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
                     <img loading="lazy" decoding="async" className="relative rounded-[14px] shadow-xl w-full border-4 border-white" alt="Collage of happy couples who met on Marryzen" src="https://images.unsplash.com/photo-1516110554988-3fcddc17b640" />
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
                        <div className="text-[#E6B450] text-3xl sm:text-4xl sm:text-5xl font-serif absolute top-4 left-6 opacity-60">"</div>
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#1F1F1F] mb-6">Start Your Marriage Journey Today</h2>
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
