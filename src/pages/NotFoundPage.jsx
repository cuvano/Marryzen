// src/pages/NotFoundPage.jsx
//
// Phase 38 — 404 page refresh (2026-06-13)
//
// Board-approved copy: "This page doesn't exist — but your match might."
// Dual CTAs: Join (primary, conversion-driving) + Home (secondary, navigation).
// Institutional voice — no founder signature for low-stakes 404s.
//
// No search box (no content corpus to search yet).
// No "Oops" or "our team is lost" (violates voice rules: solo founder, no team).

import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Heart, ArrowRight, Home } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
      <Helmet>
        <title>Page not found — Marryzen</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      {/* Note: title uses real U+2014 em-dash (NOT &mdash;) — Helmet renders
          entities literally inside <title> in some build configs. */}

      <div className="text-center max-w-xl">
        <div className="w-20 h-20 rounded-full bg-[#F9E7EB] flex items-center justify-center mx-auto mb-6">
          <Heart className="w-10 h-10 text-[#C85A72]" />
        </div>

        <p className="text-sm font-semibold tracking-widest text-[#706B67] uppercase mb-3">404</p>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#1F1F1F] mb-4 tracking-tight leading-tight">
          This page doesn&rsquo;t exist
          <span className="block text-[#C85A72] italic font-serif mt-2">but your match might.</span>
        </h1>

        <p className="text-[#706B67] mb-10 text-base sm:text-lg leading-relaxed">
          The link you followed may be broken, moved, or never existed. Take a moment with us, then keep going.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center">
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center px-7 py-3.5 bg-[#E6B450] hover:bg-[#D0A23D] text-[#1F1F1F] font-bold rounded-full transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#E6B450] focus:ring-offset-2 focus:ring-offset-[#FAF7F2]"
          >
            Join Marryzen <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-7 py-3.5 bg-white hover:bg-[#FAFAF7] text-[#1F1F1F] font-bold rounded-full border border-[#E6DCD2] transition-colors focus:outline-none focus:ring-2 focus:ring-[#C85A72] focus:ring-offset-2 focus:ring-offset-[#FAF7F2]"
          >
            <Home className="w-4 h-4 mr-2" /> Back to home
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-[#E6DCD2] text-sm text-[#706B67]">
          <p className="mb-2">Looking for something specific?</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 font-medium">
            {/* All quick-links below are PUBLIC routes (no auth gate).
                /help was removed — it lives inside <AuthenticatedLayout />
                and would bounce logged-out 404 visitors to /login. */}
            <Link to="/login" className="text-[#C85A72] hover:underline">Log in</Link>
            <Link to="/safety" className="text-[#C85A72] hover:underline">Safety</Link>
            <Link to="/privacy" className="text-[#C85A72] hover:underline">Privacy</Link>
            <Link to="/community-guidelines" className="text-[#C85A72] hover:underline">Community guidelines</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
